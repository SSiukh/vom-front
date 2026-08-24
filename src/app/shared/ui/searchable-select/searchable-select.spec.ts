import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchableSelect } from './searchable-select';

describe('SearchableSelect', () => {
  let fixture: ComponentFixture<SearchableSelect>;
  let el: HTMLElement;

  const options = [
    { value: 'c1', label: 'Київ' },
    { value: 'c2', label: 'Львів' },
  ];

  const configure = (overrides: { selectedLabel?: string | null; loading?: boolean } = {}) => {
    TestBed.configureTestingModule({ imports: [SearchableSelect] });
    fixture = TestBed.createComponent(SearchableSelect);
    fixture.componentRef.setInput('options', options);
    if (overrides.selectedLabel !== undefined) {
      fixture.componentRef.setInput('selectedLabel', overrides.selectedLabel);
    }
    if (overrides.loading !== undefined) {
      fixture.componentRef.setInput('loading', overrides.loading);
    }
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  const input = () => el.querySelector('input') as HTMLInputElement;

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the selected label in the closed state', () => {
    configure({ selectedLabel: 'Київ' });
    expect(input().value).toBe('Київ');
  });

  it('shows an empty value when nothing is selected', () => {
    configure();
    expect(input().value).toBe('');
  });

  it('opens and clears the field on focus, emitting an empty search term', () => {
    configure({ selectedLabel: 'Київ' });
    const searchTermChange = vi.fn();
    fixture.componentInstance.searchTermChange.subscribe(searchTermChange);

    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    expect(input().value).toBe('');
    expect(searchTermChange).toHaveBeenCalledWith('');
    expect(el.querySelector('.searchable-select__panel')).not.toBeNull();
  });

  it('renders every option in the open panel', () => {
    configure();
    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    const labels = Array.from(el.querySelectorAll('.searchable-select__option')).map((o) =>
      o.textContent?.trim(),
    );
    expect(labels).toEqual(['Київ', 'Львів']);
  });

  it('shows the loading state instead of options', () => {
    configure({ loading: true });
    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    expect(el.querySelector('.searchable-select__status')?.textContent?.trim()).toBe('Завантаження…');
    expect(el.querySelector('.searchable-select__option')).toBeNull();
  });

  it('shows the empty message when there are no options and not loading', () => {
    TestBed.configureTestingModule({ imports: [SearchableSelect] });
    fixture = TestBed.createComponent(SearchableSelect);
    fixture.componentRef.setInput('options', []);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;

    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    expect(el.querySelector('.searchable-select__status')?.textContent?.trim()).toBe('Нічого не знайдено');
  });

  it('debounces typed input before emitting searchTermChange', () => {
    vi.useFakeTimers();
    configure();
    const searchTermChange = vi.fn();
    fixture.componentInstance.searchTermChange.subscribe(searchTermChange);
    input().dispatchEvent(new Event('focus'));
    searchTermChange.mockClear();

    input().value = 'Ки';
    input().dispatchEvent(new Event('input'));

    expect(searchTermChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(299);
    expect(searchTermChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(searchTermChange).toHaveBeenCalledWith('Ки');
  });

  it('emits valueChange with the picked option and closes the panel', () => {
    configure();
    const valueChange = vi.fn();
    fixture.componentInstance.valueChange.subscribe(valueChange);
    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    (el.querySelectorAll('.searchable-select__option')[1] as HTMLButtonElement).dispatchEvent(
      new Event('mousedown'),
    );
    fixture.detectChanges();

    expect(valueChange).toHaveBeenCalledWith({ value: 'c2', label: 'Львів' });
    expect(el.querySelector('.searchable-select__panel')).toBeNull();
  });

  it('closes the panel on blur after a short delay', () => {
    vi.useFakeTimers();
    configure();
    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(el.querySelector('.searchable-select__panel')).not.toBeNull();

    input().dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(el.querySelector('.searchable-select__panel')).not.toBeNull();

    vi.advanceTimersByTime(150);
    fixture.detectChanges();
    expect(el.querySelector('.searchable-select__panel')).toBeNull();
  });

  it('moves the highlight with arrow keys and selects the highlighted option on Enter', () => {
    configure();
    const valueChange = vi.fn();
    fixture.componentInstance.valueChange.subscribe(valueChange);
    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(valueChange).toHaveBeenCalledWith({ value: 'c2', label: 'Львів' });
  });

  it('wraps the highlight from the last option back to the first with ArrowDown', () => {
    configure();
    const valueChange = vi.fn();
    fixture.componentInstance.valueChange.subscribe(valueChange);
    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(valueChange).toHaveBeenCalledWith({ value: 'c1', label: 'Київ' });
  });

  it('closes the panel on Escape without emitting a value', () => {
    configure();
    const valueChange = vi.fn();
    fixture.componentInstance.valueChange.subscribe(valueChange);
    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(el.querySelector('.searchable-select__panel')).toBeNull();
    expect(valueChange).not.toHaveBeenCalled();
  });

  it('does nothing on Enter when no option is highlighted', () => {
    configure();
    const valueChange = vi.fn();
    fixture.componentInstance.valueChange.subscribe(valueChange);
    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(valueChange).not.toHaveBeenCalled();
    expect(el.querySelector('.searchable-select__panel')).not.toBeNull();
  });

  it('cancels a pending blur-close when the field is refocused before it fires', () => {
    vi.useFakeTimers();
    configure();
    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    input().dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(100);
    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    vi.advanceTimersByTime(100);
    fixture.detectChanges();

    expect(el.querySelector('.searchable-select__panel')).not.toBeNull();
  });

  it('does not open when disabled', () => {
    TestBed.configureTestingModule({ imports: [SearchableSelect] });
    fixture = TestBed.createComponent(SearchableSelect);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;

    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    expect(el.querySelector('.searchable-select__panel')).toBeNull();
  });
});
