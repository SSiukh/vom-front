import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ServerConnectionService } from '../../connection/server-connection.service';
import { ServerStatusBanner } from './server-status-banner';

describe('ServerStatusBanner', () => {
  let fixture: ComponentFixture<ServerStatusBanner>;
  let el: HTMLElement;
  const waking = signal(false);
  const blockedUrl = signal<string | null>(null);
  const retryBlockedNavigation = vi.fn();

  beforeEach(() => {
    waking.set(false);
    blockedUrl.set(null);
    retryBlockedNavigation.mockClear();
    TestBed.configureTestingModule({
      imports: [ServerStatusBanner],
      providers: [
        {
          provide: ServerConnectionService,
          useValue: {
            waking: waking.asReadonly(),
            blockedUrl: blockedUrl.asReadonly(),
            retryBlockedNavigation,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ServerStatusBanner);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('renders no notice while the server is reachable, but keeps the live region in place', () => {
    expect(el.querySelector('.server-status')).toBeNull();
    expect(el.querySelector('[role="status"]')).not.toBeNull();
  });

  it('shows the waking notice inside the persistent status live region while the server wakes up', () => {
    waking.set(true);
    fixture.detectChanges();

    const notice = el.querySelector('[role="status"] .server-status');
    expect(notice?.textContent).toContain('Сервер прокидається');
  });

  it('shows the failure alert with a retry button that retries the blocked navigation', () => {
    blockedUrl.set('/orders');
    fixture.detectChanges();

    const alert = el.querySelector('.server-status--error');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain('Не вдалося отримати дані з сервера');

    (el.querySelector('.server-status__action') as HTMLButtonElement).click();

    expect(retryBlockedNavigation).toHaveBeenCalledOnce();
  });

  it('prefers the unreachable alert over the waking notice', () => {
    waking.set(true);
    blockedUrl.set('/orders');
    fixture.detectChanges();

    expect(el.querySelectorAll('.server-status').length).toBe(1);
    expect(el.querySelector('.server-status--error')).not.toBeNull();
  });
});
