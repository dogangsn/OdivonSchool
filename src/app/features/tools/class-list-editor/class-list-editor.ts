import { Component, input, model, signal } from '@angular/core';
import { parseNames, saveClassList } from '../../../tools/class-list';

/** Textarea for the class list, shared by Şans Çarkı and Grup Oluşturucu. */
@Component({
  selector: 'app-class-list-editor',
  template: `
    <div class="cl-editor card">
      <div class="cl-head">
        <strong>📋 Sınıf listesi ({{ names().length }})</strong>
        <button type="button" class="btn sm outline" (click)="open.set(!open())">
          {{ open() ? 'Kapat' : 'Düzenle' }}
        </button>
      </div>
      @if (open()) {
        <textarea
          rows="8"
          [value]="draft()"
          (input)="draft.set($any($event.target).value)"
          placeholder="Her satıra bir ad yazın veya virgülle ayırın"
        ></textarea>
        <div class="cl-actions">
          <button type="button" class="btn sm primary" (click)="save()">Kaydet</button>
          <button type="button" class="btn sm outline" (click)="useSample()">Örnek liste</button>
        </div>
        <p class="cl-note">{{ hint() }}</p>
      }
    </div>
  `,
})
export class ClassListEditor {
  names = model.required<string[]>();
  hint = input('Liste yalnızca bu tarayıcıda saklanır.');
  open = signal(false);
  draft = signal('');

  ngOnInit() {
    this.draft.set(this.names().join('\n'));
    if (this.names().length === 0) this.open.set(true);
  }

  save() {
    const list = parseNames(this.draft());
    this.names.set(list);
    saveClassList(list);
    this.draft.set(list.join('\n'));
    this.open.set(false);
  }

  useSample() {
    this.draft.set(['Ada', 'Ali', 'Asya', 'Berk', 'Defne', 'Efe', 'Elif', 'Emir', 'Mira', 'Kerem', 'Zeynep', 'Yusuf'].join('\n'));
  }
}
