import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WordSearch, answerCells, buildWordSearch, parseWords } from '../../../tools/word-search';

@Component({
  selector: 'app-word-search-maker',
  imports: [RouterLink],
  templateUrl: './word-search-maker.html',
})
export class WordSearchMaker {
  title = signal('Kelime Avı');
  text = signal('kalem\nsilgi\ndefter\nkitap\nçanta\ncetvel\nboya\nmakas');
  size = signal(12);
  diagonal = signal(true);
  backwards = signal(false);
  showAnswers = signal(false);
  puzzle = signal<WordSearch | null>(null);

  words = computed(() => parseWords(this.text()));
  answers = computed(() => answerCells(this.puzzle()?.placed ?? []));
  placedWords = computed(() => (this.puzzle()?.placed ?? []).map((p) => p.word).sort((a, b) => a.localeCompare(b, 'tr')));

  constructor() {
    this.generate();
  }

  generate() {
    this.puzzle.set(
      buildWordSearch(this.words(), { size: this.size(), diagonal: this.diagonal(), backwards: this.backwards() })
    );
  }

  setSize(v: string) {
    this.size.set(Math.max(6, Math.min(20, parseInt(v, 10) || 12)));
    this.generate();
  }

  print() {
    window.print();
  }
}
