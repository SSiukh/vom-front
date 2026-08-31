import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { DictionariesService } from '../../../../core/dictionaries/dictionaries.service';
import { ExpensesList } from './expenses-list';

describe('ExpensesList', () => {
  let fixture: ComponentFixture<ExpensesList>;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  let router: Router;
  const baseUrl = `${environment.apiUrl}/expenses`;

  const expense = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: '1',
    typeId: 't1',
    name: null,
    amount: 150,
    createdAt: '2026-08-22T10:00:00.000Z',
    updatedAt: '2026-08-22T10:00:00.000Z',
    ...overrides,
  });

  const dictionariesStub = {
    expenseTypes: () => [
      { id: 't1', code: 'delivery', label: 'Доставка', requiresName: false },
      { id: 't2', code: 'other', label: 'Інше', requiresName: true },
    ],
  };

  const create = () => {
    TestBed.configureTestingModule({
      imports: [ExpensesList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DictionariesService, useValue: dictionariesStub },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ExpensesList);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  const flushList = (items: unknown[], total: number, url = `${baseUrl}?page=1&pageSize=10`) => {
    httpMock.expectOne(url).flush({ items, total });
    fixture.detectChanges();
  };

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches page 1 on init and renders a card per expense', () => {
    create();
    flushList([expense(), expense({ id: '2' })], 2);

    expect(el.querySelectorAll('.entity-card').length).toBe(2);
  });

  it('shows the empty state when there are no expenses', () => {
    create();
    flushList([], 0);

    expect(el.querySelector('.empty-state__title')?.textContent?.trim()).toBe('Витрат поки немає');
  });

  it('renders the type label, a dash for a missing name, amount, and date', () => {
    create();
    flushList([expense()], 1);

    const card = el.querySelector('.entity-card') as HTMLElement;
    const metaRow = card.querySelector('.entity-card__meta-row');
    expect(metaRow?.textContent?.trim()).toBe('Доставка22.08.2026');
    expect(card.querySelector('.entity-card__title')?.textContent?.trim()).toBe('—');
    expect(card.querySelector('.entity-card__field-value')?.textContent?.trim()).toBe('150 ₴');
  });

  it('renders the real name for an "Інше" expense instead of a dash', () => {
    create();
    flushList([expense({ typeId: 't2', name: 'Ремонт принтера' })], 1);

    const card = el.querySelector('.entity-card') as HTMLElement;
    expect(card.querySelector('.entity-card__title')?.textContent?.trim()).toBe('Ремонт принтера');
  });

  it('navigates to the create page when "Внести витрату" is clicked', () => {
    create();
    flushList([], 0);

    (el.querySelector('.btn-primary') as HTMLButtonElement).click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/expenses/new');
  });

  it('navigates to the edit page when the edit icon is clicked', () => {
    create();
    flushList([expense()], 1);

    (el.querySelector('.icon-action') as HTMLButtonElement).click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/expenses/1/edit');
  });

  it('navigates to the edit page when clicking anywhere on the row', () => {
    create();
    flushList([expense()], 1);

    (el.querySelector('.entity-card') as HTMLElement).click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/expenses/1/edit');
  });

  it('does not navigate when clicking the delete icon inside the Дії column', () => {
    create();
    flushList([expense()], 1);

    (el.querySelector('.icon-action--danger') as HTMLButtonElement).click();

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('shows the type label in the delete confirmation when the expense has no name', () => {
    create();
    flushList([expense()], 1);

    (el.querySelector('.icon-action--danger') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.dialog-message')?.textContent).toContain('Доставка');
  });

  it('shows the real name in the delete confirmation for an "Інше" expense', () => {
    create();
    flushList([expense({ typeId: 't2', name: 'Ремонт принтера' })], 1);

    (el.querySelector('.icon-action--danger') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.dialog-message')?.textContent).toContain('Ремонт принтера');
  });

  it('deletes the expense on confirm and reloads the list', () => {
    create();
    flushList([expense()], 1);

    (el.querySelector('.icon-action--danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('.btn-destructive') as HTMLButtonElement).click();
    httpMock.expectOne(`${baseUrl}/1`).flush(null);
    flushList([], 0);

    expect(el.querySelector('.dialog-overlay')).toBeNull();
  });

  it('closes the dialog without deleting on cancel', () => {
    create();
    flushList([expense()], 1);

    (el.querySelector('.icon-action--danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('.dialog-actions .btn-ghost') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.dialog-overlay')).toBeNull();
    httpMock.expectNone(`${baseUrl}/1`);
  });

  it('shows an error message when the list request fails', () => {
    create();
    httpMock.expectOne(`${baseUrl}?page=1&pageSize=10`).flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Не вдалося завантажити список витрат');
  });
});
