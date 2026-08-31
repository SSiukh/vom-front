import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CopyableText } from './copyable-text';

describe('CopyableText', () => {
  let fixture: ComponentFixture<CopyableText>;
  let el: HTMLElement;
  let writeText: ReturnType<typeof vi.fn>;

  const configure = (value: string) => {
    TestBed.configureTestingModule({ imports: [CopyableText] });
    fixture = TestBed.createComponent(CopyableText);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the value text', () => {
    configure('20450182773641');
    expect(el.querySelector('.copyable-text__value')?.textContent?.trim()).toBe('20450182773641');
  });

  it('copies the value to the clipboard when the button is clicked', () => {
    configure('20450182773641');
    (el.querySelector('.copyable-text__btn') as HTMLButtonElement).click();

    expect(writeText).toHaveBeenCalledWith('20450182773641');
  });

  it('stops the click from bubbling to a parent click handler', () => {
    configure('20450182773641');
    const parentClick = vi.fn();
    el.addEventListener('click', parentClick);

    (el.querySelector('.copyable-text__btn') as HTMLButtonElement).click();

    expect(parentClick).not.toHaveBeenCalled();
  });

  it('shows a checkmark after copying, then reverts to the copy icon', async () => {
    vi.useFakeTimers();
    configure('20450182773641');

    (el.querySelector('.copyable-text__btn') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.componentInstance['copied']()).toBe(true);

    vi.advanceTimersByTime(1500);
    fixture.detectChanges();

    expect(fixture.componentInstance['copied']()).toBe(false);
  });

  it('clears the pending reset timeout when the component is destroyed before it fires', async () => {
    vi.useFakeTimers();
    configure('20450182773641');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    (el.querySelector('.copyable-text__btn') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    fixture.destroy();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
