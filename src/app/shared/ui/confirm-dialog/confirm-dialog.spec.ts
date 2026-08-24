import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  let fixture: ComponentFixture<ConfirmDialog>;
  let el: HTMLElement;

  const configure = (open: boolean) => {
    TestBed.configureTestingModule({ imports: [ConfirmDialog] });
    fixture = TestBed.createComponent(ConfirmDialog);
    fixture.componentRef.setInput('open', open);
    fixture.componentRef.setInput('title', 'Видалити відправника?');
    fixture.componentRef.setInput('message', 'Цю дію неможливо скасувати.');
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  it('renders nothing when closed', () => {
    configure(false);
    expect(el.querySelector('.dialog-overlay')).toBeNull();
  });

  it('renders the title and message when open', () => {
    configure(true);
    expect(el.querySelector('.dialog-title span')?.textContent?.trim()).toBe('Видалити відправника?');
    expect(el.querySelector('.dialog-message')?.textContent?.trim()).toBe('Цю дію неможливо скасувати.');
  });

  it('uses default button labels unless overridden', () => {
    configure(true);
    const buttons = Array.from(el.querySelectorAll('.dialog-actions button')).map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['Скасувати', 'Підтвердити']);
  });

  it('respects custom button labels', () => {
    configure(true);
    fixture.componentRef.setInput('confirmLabel', 'Видалити');
    fixture.componentRef.setInput('cancelLabel', 'Назад');
    fixture.detectChanges();

    const buttons = Array.from(el.querySelectorAll('.dialog-actions button')).map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['Назад', 'Видалити']);
  });

  it('emits confirmed/cancelled on button clicks', () => {
    configure(true);
    const confirmed = vi.fn();
    const cancelled = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.componentInstance.cancelled.subscribe(cancelled);

    (el.querySelector('.btn-destructive') as HTMLButtonElement).click();
    (el.querySelector('.btn-ghost') as HTMLButtonElement).click();

    expect(confirmed).toHaveBeenCalledOnce();
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it('disables the confirm button when confirmDisabled is true', () => {
    configure(true);
    fixture.componentRef.setInput('confirmDisabled', true);
    fixture.detectChanges();

    expect((el.querySelector('.btn-destructive') as HTMLButtonElement).disabled).toBe(true);
  });
});
