import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClassListEditor } from '../class-list-editor/class-list-editor';
import { loadClassList, makeGroups } from '../../../tools/class-list';
import { toggleFullscreen } from '../tool-fullscreen';

const TEAM_NAMES = ['Kartallar', 'Yıldızlar', 'Roketler', 'Kaşifler', 'Şimşekler', 'Pandalar', 'Yunuslar', 'Aslanlar', 'Bilgeler', 'Gökkuşağı'];
const TEAM_EMOJI = ['🦅', '⭐', '🚀', '🧭', '⚡', '🐼', '🐬', '🦁', '🦉', '🌈'];

@Component({
  selector: 'app-group-maker',
  imports: [RouterLink, ClassListEditor],
  template: `
    <div class="tool-page container wide animate-fade-in">
      <div class="tool-topbar">
        <a routerLink="/araclar" class="tool-back">← Araçlar</a>
        <h1>👥 Grup Oluşturucu</h1>
        <button type="button" class="btn sm outline" (click)="fullscreen()">⛶ Tam ekran</button>
      </div>

      <div class="tool-layout">
        <div class="tool-stage groups-stage" #stage>
          <div class="gm-controls">
            <span>Grup sayısı</span>
            <button type="button" class="icon-btn" (click)="setCount(count() - 1)">−</button>
            <strong>{{ count() }}</strong>
            <button type="button" class="icon-btn" (click)="setCount(count() + 1)">+</button>
            <button type="button" class="btn primary" [disabled]="names().length < 2" (click)="make()">🎲 Grupları oluştur</button>
          </div>
          @if (groups().length) {
            <div class="gm-grid">
              @for (g of groups(); track $index; let i = $index) {
                <div class="gm-group card" [style.--hue]="i * 47">
                  <h3>{{ emoji[i % emoji.length] }} {{ teams[i % teams.length] }}</h3>
                  <ul>
                    @for (n of g; track n) { <li>{{ n }}</li> }
                  </ul>
                </div>
              }
            </div>
          } @else {
            <div class="tool-empty"><p>Listeyi ekle, grup sayısını seç ve "Grupları oluştur"a bas.</p></div>
          }
        </div>
        <aside class="tool-side">
          <app-class-list-editor [(names)]="names" />
        </aside>
      </div>
    </div>
  `,
})
export class GroupMaker {
  stage = viewChild<ElementRef<HTMLElement>>('stage');
  readonly teams = TEAM_NAMES;
  readonly emoji = TEAM_EMOJI;
  names = signal<string[]>(loadClassList());
  count = signal(4);
  groups = signal<string[][]>([]);

  setCount(n: number) {
    this.count.set(Math.max(2, Math.min(10, n)));
  }

  make() {
    this.groups.set(makeGroups(this.names(), this.count()));
  }

  fullscreen() {
    toggleFullscreen(this.stage()?.nativeElement);
  }
}
