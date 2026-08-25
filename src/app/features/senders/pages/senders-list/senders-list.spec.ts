import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { SendersList } from './senders-list';
import { SetWarehouseDialog } from './set-warehouse-dialog/set-warehouse-dialog';

describe('SendersList', () => {
  let fixture: ComponentFixture<SendersList>;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  let router: Router;
  const baseUrl = `${environment.apiUrl}/senders`;

  const sender = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: '1',
    fullName: 'Іван Іванов',
    phone: '+380501234567',
    isActive: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  });

  const create = () => {
    TestBed.configureTestingModule({
      imports: [SendersList],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(SendersList);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  const flushList = (items: unknown[], total: number, page = 1) => {
    httpMock.expectOne(`${baseUrl}?page=${page}&pageSize=10`).flush({ items, total });
    fixture.detectChanges();
  };

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches page 1 on init and renders a row per sender', () => {
    create();
    flushList([sender(), sender({ id: '2', fullName: 'Петро Петров' })], 2);

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('td:nth-child(2)')?.textContent?.trim()).toBe('Іван Іванов');
  });

  it('shows the loading text before the first response arrives', () => {
    create();
    expect(el.querySelector('.loading-text')?.textContent?.trim()).toBe('Завантаження…');
    flushList([], 0);
  });

  it('shows the empty state when there are no senders', () => {
    create();
    flushList([], 0);

    expect(el.querySelector('.empty-state__title')?.textContent?.trim()).toBe('Відправників поки немає');
    expect(el.querySelector('table')).toBeNull();
  });

  it('shows an error message when the list request fails', () => {
    create();
    httpMock.expectOne(`${baseUrl}?page=1&pageSize=10`).flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe(
      'Не вдалося завантажити список відправників',
    );
  });

  it('navigates to /senders/new when "Внести відправника" is clicked', () => {
    create();
    flushList([], 0);

    (el.querySelector('.btn-primary') as HTMLButtonElement).click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/senders/new');
  });

  it('activates an inactive sender and reloads the list', () => {
    create();
    flushList([sender()], 1);

    (el.querySelector('.radio-dot') as HTMLButtonElement).click();
    httpMock.expectOne(`${baseUrl}/1/activate`).flush(sender({ isActive: true }));
    flushList([sender({ isActive: true })], 1);

    expect(el.querySelector('.radio-dot__dot')).not.toBeNull();
  });

  it('does not call activate when clicking an already-active sender', () => {
    create();
    flushList([sender({ isActive: true })], 1);

    (el.querySelector('.radio-dot') as HTMLButtonElement).click();

    httpMock.expectNone(`${baseUrl}/1/activate`);
  });

  it('shows a rate-limit message when refresh is throttled (429)', () => {
    create();
    flushList([sender()], 1);

    (el.querySelector('.btn-ghost') as HTMLButtonElement).click();
    httpMock.expectOne(`${baseUrl}/1/refresh`).flush('err', { status: 429, statusText: 'Too Many Requests' });
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Забагато спроб — спробуйте пізніше');
  });

  it('ignores a second activate click while one is already in flight', () => {
    create();
    flushList([sender(), sender({ id: '2', fullName: 'Петро Петров' })], 2);

    const dots = el.querySelectorAll('.radio-dot');
    (dots[0] as HTMLButtonElement).click();
    (dots[1] as HTMLButtonElement).click();

    httpMock.expectOne(`${baseUrl}/1/activate`).flush(sender({ isActive: true }));
    httpMock.expectNone(`${baseUrl}/2/activate`);
    flushList([sender({ isActive: true }), sender({ id: '2', fullName: 'Петро Петров' })], 2);
  });

  it('clamps back to the last valid page when a deactivate empties the current page', () => {
    create();
    flushList(
      Array.from({ length: 10 }, (_, i) => sender({ id: String(i) })),
      21,
      1,
    );

    const pageThree = Array.from(el.querySelectorAll('.pagination-box')).find(
      (b) => b.textContent?.trim() === '3',
    ) as HTMLButtonElement;
    pageThree.click();
    flushList([sender({ id: '21' })], 21, 3);

    (el.querySelector('.icon-action--danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('.btn-destructive') as HTMLButtonElement).click();
    httpMock.expectOne(`${baseUrl}/21`).flush(null);
    httpMock.expectOne(`${baseUrl}?page=3&pageSize=10`).flush({ items: [], total: 20 });
    flushList([sender({ id: '11' })], 20, 2);

    const activePage = el.querySelector('.pagination-box.is-active');
    expect(activePage?.textContent?.trim()).toBe('2');
  });

  it('refreshes a single row in place without reloading the whole list', () => {
    create();
    flushList([sender()], 1);

    (el.querySelector('.btn-ghost') as HTMLButtonElement).click();
    httpMock.expectOne(`${baseUrl}/1/refresh`).flush(sender({ fullName: 'Оновлене Імʼя' }));
    fixture.detectChanges();

    expect(el.querySelector('td:nth-child(2)')?.textContent?.trim()).toBe('Оновлене Імʼя');
    httpMock.expectNone(`${baseUrl}?page=1&pageSize=10`);
  });

  it('opens the confirm dialog with the sender name, and deactivates on confirm', () => {
    create();
    flushList([sender()], 1);

    (el.querySelector('.icon-action--danger') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.dialog-message')?.textContent).toContain('Іван Іванов');

    (el.querySelector('.btn-destructive') as HTMLButtonElement).click();
    httpMock.expectOne(`${baseUrl}/1`).flush(null);
    flushList([], 0);

    expect(el.querySelector('.dialog-overlay')).toBeNull();
  });

  it('closes the confirm dialog without deactivating on cancel', () => {
    create();
    flushList([sender()], 1);

    (el.querySelector('.icon-action--danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('.dialog-actions .btn-ghost') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.dialog-overlay')).toBeNull();
    httpMock.expectNone(`${baseUrl}/1`);
  });

  it('opens the set-warehouse dialog with the sender name, and updates the row in place on save', () => {
    create();
    flushList([sender()], 1);

    (el.querySelector('.icon-action:not(.icon-action--danger)') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('app-set-warehouse-dialog .dialog-message')?.textContent).toContain('Іван Іванов');

    const dialog = fixture.debugElement.query(By.directive(SetWarehouseDialog)).componentInstance as SetWarehouseDialog;
    dialog.saved.emit({ cityRef: 'city-1', warehouseRef: 'wh-1' });

    const req = httpMock.expectOne(`${baseUrl}/1/warehouse`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ cityRef: 'city-1', warehouseRef: 'wh-1' });
    req.flush(sender({ fullName: 'Іван Іванов' }));
    fixture.detectChanges();

    expect(el.querySelector('app-set-warehouse-dialog .dialog-overlay')).toBeNull();
    httpMock.expectNone(`${baseUrl}?page=1&pageSize=10`);
  });

  it('closes the set-warehouse dialog without a request on cancel', () => {
    create();
    flushList([sender()], 1);

    (el.querySelector('.icon-action:not(.icon-action--danger)') as HTMLButtonElement).click();
    fixture.detectChanges();

    const dialog = fixture.debugElement.query(By.directive(SetWarehouseDialog)).componentInstance as SetWarehouseDialog;
    dialog.cancelled.emit();
    fixture.detectChanges();

    expect(el.querySelector('app-set-warehouse-dialog .dialog-overlay')).toBeNull();
    httpMock.expectNone(`${baseUrl}/1/warehouse`);
  });

  it('shows an error message when changing the warehouse fails', () => {
    create();
    flushList([sender()], 1);

    (el.querySelector('.icon-action:not(.icon-action--danger)') as HTMLButtonElement).click();
    fixture.detectChanges();

    const dialog = fixture.debugElement.query(By.directive(SetWarehouseDialog)).componentInstance as SetWarehouseDialog;
    dialog.saved.emit({ cityRef: 'city-1', warehouseRef: 'wh-1' });
    httpMock
      .expectOne(`${baseUrl}/1/warehouse`)
      .flush({ message: 'Unknown warehouse for the given city' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(el.querySelector('app-set-warehouse-dialog .error-text')?.textContent?.trim()).toBe(
      'Unknown warehouse for the given city',
    );
  });

  it('requests the next page from the pagination component', () => {
    create();
    flushList(
      Array.from({ length: 10 }, (_, i) => sender({ id: String(i) })),
      15,
    );

    const pageTwo = Array.from(el.querySelectorAll('.pagination-box')).find(
      (b) => b.textContent?.trim() === '2',
    ) as HTMLButtonElement;
    pageTwo.click();
    httpMock.expectOne(`${baseUrl}?page=2&pageSize=10`).flush({ items: [], total: 15 });
  });
});
