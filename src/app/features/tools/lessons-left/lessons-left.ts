import { Component, ElementRef, OnDestroy, computed, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DEFAULT_DAY, DayPlan, buildSlots, dayStatus, formatMinutes } from '../../../tools/lessons';
import { toggleFullscreen } from '../tool-fullscreen';

const KEY = 'odivon_tools_day_plan';

function loadPlan(): DayPlan {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_DAY, ...JSON.parse(raw) } : DEFAULT_DAY;
  } catch {
    return DEFAULT_DAY;
  }
}

@Component({
  selector: 'app-lessons-left',
  imports: [RouterLink],
  templateUrl: './lessons-left.html',
})
export class LessonsLeft implements OnDestroy {
  stage = viewChild<ElementRef<HTMLElement>>('stage');
  plan = signal<DayPlan>(loadPlan());
  now = signal(this.nowMinutes());
  editing = signal(false);
  readonly fmt = formatMinutes;

  slots = computed(() => buildSlots(this.plan()));
  status = computed(() => dayStatus(this.plan(), this.now()));
  clock = computed(() => formatMinutes(Math.floor(this.now())));

  private tick = setInterval(() => this.now.set(this.nowMinutes()), 5000);

  update<K extends keyof DayPlan>(key: K, value: string) {
    const next = { ...this.plan(), [key]: key === 'start' ? value : Math.max(0, parseInt(value, 10) || 0) };
    this.plan.set(next as DayPlan);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // not persisted
    }
  }

  isCurrent(i: number) {
    const s = this.slots()[i];
    const n = this.now();
    return n >= s.startMin && n < s.endMin;
  }

  isPast(i: number) {
    return this.now() >= this.slots()[i].endMin;
  }

  fullscreen() {
    toggleFullscreen(this.stage()?.nativeElement);
  }

  ngOnDestroy() {
    clearInterval(this.tick);
  }

  private nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  }
}
