import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TOOLS, TOOL_CATEGORIES } from '../tool-catalog';

@Component({
  selector: 'app-tools-hub',
  imports: [RouterLink],
  template: `
    <div class="tools-hub container wide animate-fade-in">
      <header class="th-hero">
        <span class="th-badge">🧰 Akıllı tahta ve sınıf için</span>
        <h1>Sınıf Araçları</h1>
        <p>Üyelik gerekmeden tahtada açıp kullanabileceğin araçlar. Sınıf listen yalnızca bu cihazda saklanır.</p>
      </header>

      @for (cat of categories; track cat.id) {
        <section class="th-section">
          <h2>{{ cat.title }}</h2>
          <div class="th-grid">
            @for (t of toolsOf(cat.id); track t.id) {
              <a class="th-card card card-hover" [routerLink]="t.link">
                <span class="th-emoji">{{ t.emoji }}</span>
                <strong>{{ t.title }}</strong>
                <small>{{ t.description }}</small>
                <span class="th-cta">Aç →</span>
              </a>
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class ToolsHub {
  readonly categories = TOOL_CATEGORIES;
  toolsOf(cat: string) {
    return TOOLS.filter((t) => t.category === cat);
  }
}
