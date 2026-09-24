import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchInput } from './search-input';

describe('SearchInput', () => {
  let fixture: ComponentFixture<SearchInput>;
  let el: HTMLElement;
  let emitted: string[];

  const input = () => el.querySelector('input') as HTMLInputElement;
  const type = (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [SearchInput] });
    fixture = TestBed.createComponent(SearchInput);
    fixture.componentRef.setInput('placeholder', 'Пошук: № ЕН');
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    emitted = [];
    fixture.componentInstance.searchChange.subscribe((value) => emitted.push(value));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the placeholder and uses it as the accessible name', () => {
    expect(input().getAttribute('placeholder')).toBe('Пошук: № ЕН');
    expect(input().getAttribute('aria-label')).toBe('Пошук: № ЕН');
  });

  it('limits the input to 100 characters by default and accepts another limit', () => {
    expect(input().getAttribute('maxlength')).toBe('100');

    fixture.componentRef.setInput('maxLength', 20);
    fixture.detectChanges();

    expect(input().getAttribute('maxlength')).toBe('20');
  });

  it('does not emit while the user is still typing, then emits once after the pause', () => {
    type('іва');
    vi.advanceTimersByTime(200);
    type('івано');
    vi.advanceTimersByTime(349);
    expect(emitted).toEqual([]);

    vi.advanceTimersByTime(1);

    expect(emitted).toEqual(['івано']);
  });

  it('emits the trimmed text', () => {
    type('  Іваненко Іван  ');

    vi.advanceTimersByTime(350);

    expect(emitted).toEqual(['Іваненко Іван']);
  });

  it('emits an empty string when the field is cleared by the user', () => {
    type('abc');
    vi.advanceTimersByTime(350);

    type('');
    vi.advanceTimersByTime(350);

    expect(emitted).toEqual(['abc', '']);
  });

  it('keeps what was typed in the field while the emit is pending', () => {
    type('abc');

    expect(input().value).toBe('abc');
  });

  it('empties the field when cleared from outside without emitting', () => {
    type('abc');
    vi.advanceTimersByTime(350);

    fixture.componentInstance.clear();
    fixture.detectChanges();

    expect(input().value).toBe('');
    vi.advanceTimersByTime(1000);
    expect(emitted).toEqual(['abc']);
  });

  it('cancels a pending emit when cleared from outside before the pause has passed', () => {
    type('abc');
    vi.advanceTimersByTime(200);

    fixture.componentInstance.clear();
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);

    expect(emitted).toEqual([]);
    expect(input().value).toBe('');
  });

  it('emits again for the same text typed after an external clear', () => {
    type('abc');
    vi.advanceTimersByTime(350);
    fixture.componentInstance.clear();
    fixture.detectChanges();

    type('abc');
    vi.advanceTimersByTime(350);

    expect(emitted).toEqual(['abc', 'abc']);
  });

  it('stops emitting after it is destroyed', () => {
    type('abc');

    fixture.destroy();
    vi.advanceTimersByTime(1000);

    expect(emitted).toEqual([]);
  });
});
