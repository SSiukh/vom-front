import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree, type RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ServerConnectionService } from '../connection/server-connection.service';
import { twoFaConfiguredGuard } from './two-fa-configured.guard';

interface AuthServiceStubOverrides {
  twoFaEnabled?: () => boolean | null;
  ensureTwoFaStatus?: () => Observable<boolean>;
  isAuthenticated?: () => boolean;
}

describe('twoFaConfiguredGuard', () => {
  let reportBlockedNavigation = vi.fn();

  const buildAuthServiceStub = (overrides: AuthServiceStubOverrides) =>
    ({
      twoFaEnabled: () => null,
      ensureTwoFaStatus: () => of(false),
      isAuthenticated: () => true,
      ...overrides,
    }) as unknown as AuthService;

  const configure = (authService: AuthService) => {
    reportBlockedNavigation = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ServerConnectionService, useValue: { reportBlockedNavigation } },
        provideRouter([]),
      ],
    });
  };

  const runGuard = () =>
    TestBed.runInInjectionContext(() =>
      twoFaConfiguredGuard({} as never, { url: '/orders?page=2' } as RouterStateSnapshot),
    ) as Observable<boolean | UrlTree>;

  it('allows activation without a network call when status is already known enabled', async () => {
    const ensureTwoFaStatus = vi.fn();
    configure(buildAuthServiceStub({ twoFaEnabled: () => true, ensureTwoFaStatus }));

    const result = await firstValueFrom(runGuard());

    expect(result).toBe(true);
    expect(ensureTwoFaStatus).not.toHaveBeenCalled();
  });

  it('redirects to 2FA setup when status is already known disabled', async () => {
    configure(buildAuthServiceStub({ twoFaEnabled: () => false }));

    const result = await firstValueFrom(runGuard());
    const router = TestBed.inject(Router);

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/2fa');
  });

  it('fetches the status when unknown, then allows activation if enabled', async () => {
    configure(buildAuthServiceStub({ twoFaEnabled: () => null, ensureTwoFaStatus: () => of(true) }));

    const result = await firstValueFrom(runGuard());

    expect(result).toBe(true);
  });

  it('fetches the status when unknown, then redirects if disabled', async () => {
    configure(buildAuthServiceStub({ twoFaEnabled: () => null, ensureTwoFaStatus: () => of(false) }));

    const result = await firstValueFrom(runGuard());
    const router = TestBed.inject(Router);

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/2fa');
  });

  it('blocks the navigation and reports it for a retry when the status request fails', async () => {
    configure(
      buildAuthServiceStub({ ensureTwoFaStatus: () => throwError(() => new HttpErrorResponse({ status: 0 })) }),
    );

    const result = await firstValueFrom(runGuard());

    expect(result).toBe(false);
    expect(reportBlockedNavigation).toHaveBeenCalledWith('/orders?page=2');
  });

  it('sends the user to login when the session was cleared while fetching the status', async () => {
    configure(
      buildAuthServiceStub({
        ensureTwoFaStatus: () => throwError(() => new HttpErrorResponse({ status: 401 })),
        isAuthenticated: () => false,
      }),
    );

    const result = await firstValueFrom(runGuard());
    const router = TestBed.inject(Router);

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
    expect(reportBlockedNavigation).not.toHaveBeenCalled();
  });
});
