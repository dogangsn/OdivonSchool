import { Component, computed, input } from '@angular/core';
import { BOOK_MILESTONES, REGIONS, mapProgress, provincesOf } from '../../games/bookworm';

/** The 81-il reading map, region by region; opened iller are colored. */
@Component({
  selector: 'app-province-map',
  template: `
    <div class="pm">
      <div class="pm-head">
        <strong>{{ title() }}</strong>
        <span>{{ progress().opened.size }}/81 il · {{ books() }} kitap @if (progress().laps) { · {{ progress().laps }}. tur tamam 🎉 }</span>
      </div>
      <div class="pm-bar"><div [style.width.%]="(progress().opened.size / 81) * 100"></div></div>
      @if (books() < 81 * (progress().laps + 1)) {
        <p class="pm-next">Sıradaki il: <strong>{{ progress().next.name }}</strong></p>
      }
      <div class="pm-regions">
        @for (r of regions; track r.id) {
          <section class="pm-region" [class.done]="progress().completedRegions.includes(r.id)">
            <h4>{{ r.emoji }} {{ r.name }} @if (progress().completedRegions.includes(r.id)) { <span class="pm-badge">Rozet ✓</span> }</h4>
            <div class="pm-tiles">
              @for (p of provinces(r.id); track p.plate) {
                <span class="pm-tile" [class.open]="progress().opened.has(p.plate)" [title]="p.name">
                  <b>{{ p.plate < 10 ? '0' + p.plate : p.plate }}</b>{{ p.name }}
                </span>
              }
            </div>
          </section>
        }
      </div>
      @if (showMilestones()) {
        <div class="pm-milestones">
          @for (m of milestones; track m.books) {
            <span class="pm-ms" [class.got]="books() >= m.books">{{ m.emoji }} {{ m.title }} <small>{{ m.books }} kitap</small></span>
          }
        </div>
      }
    </div>
  `,
})
export class ProvinceMap {
  books = input.required<number>();
  title = input('Kitaplarla Türkiye');
  showMilestones = input(false);
  readonly regions = REGIONS;
  readonly milestones = BOOK_MILESTONES;
  readonly provinces = provincesOf;
  progress = computed(() => mapProgress(this.books()));
}
