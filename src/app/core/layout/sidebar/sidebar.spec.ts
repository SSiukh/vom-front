import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  let fixture: ComponentFixture<Sidebar>;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(Sidebar);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('renders all 8 navigation links with their labels', () => {
    const links = el.querySelectorAll('.nav-link');
    expect(links.length).toBe(8);

    const labels = Array.from(links).map((link) => link.querySelector('span')?.textContent?.trim());
    expect(labels).toEqual([
      'Замовлення',
      'Товари',
      'Витрати',
      'Таблиця',
      'Дашборд',
      'Відправники',
      'Наклейки',
      '2FA',
    ]);
  });

  it('points each link at the expected route', () => {
    const links = Array.from(el.querySelectorAll('.nav-link')) as HTMLAnchorElement[];
    const hrefs = links.map((link) => link.getAttribute('href'));

    expect(hrefs).toEqual([
      '/orders',
      '/products',
      '/expenses',
      '/crm',
      '/dashboard',
      '/senders',
      '/stickers',
      '/2fa',
    ]);
  });

  it('starts expanded, showing the wordmark and link labels', () => {
    expect(el.querySelector('.wordmark')).not.toBeNull();
    expect(el.querySelector('.nav-link span')).not.toBeNull();
    expect(el.querySelector('.sidebar')?.classList.contains('collapsed')).toBe(false);
  });

  it('collapses on toggle, hiding the wordmark and link labels', () => {
    (el.querySelector('.toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.sidebar')?.classList.contains('collapsed')).toBe(true);
    expect(el.querySelector('.wordmark')).toBeNull();
    expect(el.querySelector('.nav-link span')).toBeNull();
  });

  it('expands again on a second toggle', () => {
    const toggle = el.querySelector('.toggle') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();
    toggle.click();
    fixture.detectChanges();

    expect(el.querySelector('.sidebar')?.classList.contains('collapsed')).toBe(false);
    expect(el.querySelector('.wordmark')).not.toBeNull();
  });
});
