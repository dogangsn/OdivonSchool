import { Component, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom, take } from 'rxjs';
import { AuthService } from '../../../../core/services/auth';
import { GameProgressService } from '../../../../core/services/game-progress';
import { ReadingService } from '../../../../core/services/reading';
import { GameMistake, GameOutcome, GameReward } from '../../../../games/game-models';
import {
  AlignState,
  ReadingStats,
  WordStatus,
  alignWords,
  buildPassage,
  cleanWord,
  currentToken,
  heardWords,
  initialAlign,
  isFinished,
  listenerStatuses,
  readingFeedback,
  readingStars,
  readingStats,
  speedLevel,
  tokenHeard,
  tokenStatuses,
} from '../../../../games/reading-align';
import { SPEED_BANDS, readingTextById } from '../../../../games/reading-texts';
import { sfx, speak, speechSupported } from '../../../../games/sound';

type Phase = 'intro' | 'reading' | 'confirm' | 'done';
type Mode = 'speech' | 'listener';

/** The parts of the Web Speech API this page uses (not in TypeScript's DOM lib). */
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative;
}
interface RecognitionEvent {
  resultIndex: number;
  results: { readonly length: number; [index: number]: RecognitionResult };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Recognizers report a word a little after it was said. */
const RECOGNIZER_LAG_MS = 700;
const RESTART_DELAY_MS = 150;

const NOTE_UNSUPPORTED = 'Bu tarayıcı sesi yazıya çeviremiyor; bir büyüğün dinleyip takıldığın kelimelere dokunsun.';
const NOTE_DENIED = 'Mikrofona izin verilmedi. Sorun değil: bir büyüğün dinleyip takıldığın kelimelere dokunsun.';
const NOTE_NO_MIC = 'Mikrofon bulunamadı. Bir büyüğün dinleyip takıldığın kelimelere dokunsun.';
const NOTE_NETWORK = 'Ses tanıma için internet bağlantısı gerekiyor. Şimdilik bir büyüğün dinleyip takıldığın kelimelere dokunsun.';

/**
 * Sesli Okuma Koçu: the child reads a passage aloud; the browser's speech
 * recognizer (tr-TR) follows along and colours each word. Without speech
 * recognition (Firefox, many iPads) or microphone permission, a listener
 * (parent or teacher) taps the words the child stumbles on instead.
 * Audio is never recorded or stored by the app.
 */
@Component({
  selector: 'app-reader',
  imports: [RouterLink],
  templateUrl: './reader.html',
  styleUrl: './reader.scss',
})
export class Reader implements OnDestroy {
  private route = inject(ActivatedRoute);
  private progress = inject(GameProgressService);
  private auth = inject(AuthService);
  private readingSvc = inject(ReadingService);

  textId = input<string | null>(null);

  readonly text = computed(() => readingTextById(this.textId() ?? this.route.snapshot.paramMap.get('textId') ?? ''));
  readonly passage = computed(() => buildPassage(this.text()?.text ?? ''));
  readonly band = computed(() => SPEED_BANDS[this.text()?.grade ?? 1]);
  readonly canSpeak = speechSupported();
  readonly speechAvailable = recognitionCtor() !== null;

  mode = signal<Mode>(this.speechAvailable ? 'speech' : 'listener');
  note = signal<string | null>(this.speechAvailable ? null : NOTE_UNSUPPORTED);
  phase = signal<Phase>('intro');
  listening = signal(false);
  elapsedMs = signal(0);

  private align = signal<AlignState>(initialAlign(buildPassage('')));
  /** Dinleyici modu: tapped words and where the child stopped. */
  marked = signal<ReadonlySet<number>>(new Set());
  lastRead = signal<number>(-1);

  stats = signal<ReadingStats | null>(null);
  finalStatuses = signal<WordStatus[]>([]);
  outcome = signal<GameOutcome | null>(null);
  reward = signal<GameReward | null>(null);

  statuses = computed<WordStatus[]>(() => {
    const passage = this.passage();
    if (this.phase() === 'done') return this.finalStatuses();
    if (this.mode() === 'listener') {
      const marked = this.marked();
      if (this.phase() === 'confirm') return listenerStatuses(passage.tokens.length, marked, this.lastRead());
      return passage.tokens.map((_, i) => (marked.has(i) ? 'wrong' : 'pending'));
    }
    return tokenStatuses(passage, this.align());
  });
  current = computed(() =>
    this.mode() === 'speech' && this.phase() === 'reading' ? currentToken(this.passage(), this.align()) : -1
  );
  readCount = computed(() => this.statuses().filter((s) => s !== 'pending').length);
  feedback = computed(() => {
    const s = this.stats();
    return s ? readingFeedback(s, this.band()) : '';
  });
  level = computed(() => {
    const s = this.stats();
    return s ? speedLevel(s.wcpm, this.band()) : 'growing';
  });
  stars = computed(() => this.outcome()?.stars ?? 0);
  timeLabel = computed(() => formatDuration(this.elapsedMs()));

  private recognition: Recognition | null = null;
  private active = false;
  private finalText = '';
  private interimText = '';
  private startedAt = 0;
  private firstHeardAt: number | null = null;
  private lastProgressAt: number | null = null;
  private endedAt = 0;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- Start / stop ---------------------------------------------------------

  start() {
    if (!this.text()) return;
    this.stopRecognition();
    this.align.set(initialAlign(this.passage()));
    this.marked.set(new Set());
    this.lastRead.set(this.passage().tokens.length - 1);
    this.stats.set(null);
    this.outcome.set(null);
    this.reward.set(null);
    this.finalText = '';
    this.interimText = '';
    this.firstHeardAt = null;
    this.lastProgressAt = null;
    this.startedAt = Date.now();
    this.elapsedMs.set(0);
    this.phase.set('reading');
    this.startTicker();
    if (this.mode() === 'speech') {
      this.active = true;
      this.startRecognition();
    }
  }

  /** "Bitir" while reading. */
  stop() {
    if (this.phase() !== 'reading') return;
    if (this.mode() === 'listener') {
      this.endedAt = Date.now();
      this.stopTicker();
      this.phase.set('confirm');
      return;
    }
    this.finishSpeech();
  }

  useListener() {
    this.switchToListener(null);
  }

  useSpeech() {
    if (!this.speechAvailable) return;
    this.mode.set('speech');
    this.note.set(null);
    this.reset();
  }

  reset() {
    this.stopRecognition();
    this.stopTicker();
    this.phase.set('intro');
  }

  // ---- Dinleyici modu --------------------------------------------------------

  tapWord(i: number) {
    if (this.mode() !== 'listener') return;
    if (this.phase() === 'reading') {
      const next = new Set(this.marked());
      next.has(i) ? next.delete(i) : next.add(i);
      this.marked.set(next);
    } else if (this.phase() === 'confirm') {
      this.lastRead.set(i);
    }
  }

  readAll() {
    this.lastRead.set(this.passage().tokens.length - 1);
  }

  confirmListener() {
    if (this.phase() !== 'confirm') return;
    const statuses = listenerStatuses(this.passage().tokens.length, this.marked(), this.lastRead());
    void this.complete(statuses, this.endedAt - this.startedAt, []);
  }

  // ---- Speech recognition ----------------------------------------------------

  private startRecognition() {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      this.switchToListener(NOTE_UNSUPPORTED);
      return;
    }
    try {
      const rec = this.recognition ?? new Ctor();
      rec.lang = 'tr-TR';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => this.onResult(e);
      rec.onerror = (e) => this.onError(e.error);
      rec.onend = () => this.onEnd();
      this.recognition = rec;
      rec.start();
      this.listening.set(true);
    } catch (err) {
      console.warn('[Reader] speech recognition could not start:', err);
      this.recognition = null;
      this.switchToListener(NOTE_UNSUPPORTED);
    }
  }

  private onResult(e: RecognitionEvent) {
    if (!this.active) return;
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const said = r[0]?.transcript ?? '';
      if (r.isFinal) this.finalText += ` ${said}`;
      else interim += ` ${said}`;
    }
    this.interimText = interim;
    this.realign();
  }

  private realign() {
    const passage = this.passage();
    const words = heardWords(`${this.finalText} ${this.interimText}`);
    const now = Date.now();
    if (words.length && this.firstHeardAt === null) this.firstHeardAt = now;
    const prev = this.align();
    const next = alignWords(passage, words);
    if (next.pointer > prev.pointer) this.lastProgressAt = now;
    this.align.set(next);
    if (isFinished(passage, next)) this.finishSpeech();
  }

  private onError(error: string) {
    if (!this.active) return;
    switch (error) {
      case 'not-allowed':
      case 'service-not-allowed':
        this.switchToListener(NOTE_DENIED);
        break;
      case 'audio-capture':
        this.switchToListener(NOTE_NO_MIC);
        break;
      case 'network':
      case 'language-not-supported':
        this.switchToListener(error === 'network' ? NOTE_NETWORK : NOTE_UNSUPPORTED);
        break;
      default:
        // 'no-speech' and 'aborted': onend restarts listening.
        break;
    }
  }

  /** Chrome stops after a pause; keep listening while the child reads. */
  private onEnd() {
    this.listening.set(false);
    if (!this.active || this.phase() !== 'reading' || this.mode() !== 'speech') return;
    // Results of the ended session start again from index 0: keep what was final.
    if (this.interimText.trim()) {
      this.finalText += ` ${this.interimText}`;
      this.interimText = '';
    }
    this.restartTimer = setTimeout(() => {
      if (this.active) this.startRecognition();
    }, RESTART_DELAY_MS);
  }

  private stopRecognition() {
    this.active = false;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    const rec = this.recognition;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        // already stopped
      }
    }
    this.recognition = null;
    this.listening.set(false);
  }

  private switchToListener(reason: string | null) {
    this.stopRecognition();
    this.stopTicker();
    this.mode.set('listener');
    this.note.set(reason);
    this.phase.set('intro');
  }

  private finishSpeech() {
    if (this.phase() !== 'reading') return;
    this.stopRecognition();
    this.stopTicker();
    const now = Date.now();
    const start = this.firstHeardAt ? Math.max(this.startedAt, this.firstHeardAt - RECOGNIZER_LAG_MS) : this.startedAt;
    const end = this.lastProgressAt ?? now;
    const passage = this.passage();
    const state = this.align();
    void this.complete(tokenStatuses(passage, state), Math.max(1000, end - start), tokenHeard(passage, state));
  }

  // ---- Result ----------------------------------------------------------------

  private async complete(statuses: WordStatus[], durationMs: number, heard: (string | null)[]) {
    const text = this.text();
    if (!text) return;
    const passage = this.passage();
    const stats = readingStats(passage, statuses, durationMs);
    this.finalStatuses.set(statuses);
    this.stats.set(stats);
    this.phase.set('done');
    sfx.finish();

    // One mistake per struggled word (same order as stats.struggled).
    const seen = new Set<string>();
    const mistakes: GameMistake[] = [];
    statuses.forEach((s, i) => {
      const token = passage.tokens[i];
      if ((s !== 'wrong' && s !== 'skipped') || seen.has(token.norm)) return;
      seen.add(token.norm);
      const word = cleanWord(token.display);
      if (word) mistakes.push({ prompt: word, correctAnswer: word, given: heard[i] ?? null });
    });
    const outcome: GameOutcome = {
      gameType: 'reading',
      gameKey: text.id,
      title: `Sesli Okuma · ${text.title}`,
      subject: 'Türkçe',
      grade: text.grade,
      score: stats.wcpm,
      stars: readingStars(stats.accuracy, stats.wcpm, this.band(), stats.correct),
      correct: stats.correct,
      total: stats.totalWords,
      durationMs: stats.durationMs,
      mistakes,
    };
    this.outcome.set(outcome);
    const reward = await this.progress.complete(outcome);
    this.reward.set(reward);
    if (!reward.saved || stats.correct === 0) return;
    const user = await firstValueFrom(this.auth.appUser$.pipe(take(1)));
    if (user) {
      await this.readingSvc.record(user, {
        textId: text.id,
        wcpm: stats.wcpm,
        accuracy: stats.accuracy,
        struggled: stats.struggled,
        at: Date.now(),
      });
    }
  }

  hear(word: string) {
    speak(word);
  }

  formatDuration(ms: number): string {
    return formatDuration(ms);
  }

  // ---- Timer -----------------------------------------------------------------

  private startTicker() {
    this.stopTicker();
    this.ticker = setInterval(() => this.elapsedMs.set(Date.now() - this.startedAt), 250);
  }

  private stopTicker() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  ngOnDestroy() {
    this.stopRecognition();
    this.stopTicker();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // optional
    }
  }
}

/** 75 000 → "1:15" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
