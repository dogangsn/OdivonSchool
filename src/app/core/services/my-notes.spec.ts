import { cleanDraft, parseNoteBody } from './my-notes';

describe('parseNoteBody', () => {
  it('turns markers into headings, lists and Akılda Kalsın boxes', () => {
    const blocks = parseNoteBody('# Kesirler\nBir bütünün\neşit parçası.\n\n- pay\n- payda\n! Payda sıfır olamaz');
    expect(blocks).toEqual([
      { kind: 'heading', text: 'Kesirler' },
      { kind: 'text', text: 'Bir bütünün\neşit parçası.' },
      { kind: 'list', items: ['pay', 'payda'] },
      { kind: 'remember', text: 'Payda sıfır olamaz' },
    ]);
  });

  it('keeps a lone "!" or "#" as text and ignores blank input', () => {
    expect(parseNoteBody('')).toEqual([]);
    expect(parseNoteBody('!\n#')).toEqual([{ kind: 'text', text: '!\n#' }]);
  });
});

describe('cleanDraft', () => {
  it('trims fields and drops values the rules reject', () => {
    const d = cleanDraft({
      title: '  Not  ',
      subject: ' Matematik ',
      grade: 15,
      body: 'x',
      color: 'kirmizi' as never,
      linkedSlug: '',
    });
    expect(d).toEqual({ title: 'Not', subject: 'Matematik', grade: null, body: 'x', color: 'sari', linkedSlug: null });
  });
});
