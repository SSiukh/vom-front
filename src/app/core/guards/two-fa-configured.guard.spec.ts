import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { twoFaConfiguredGuard } from './two-fa-configured.guard';

interface AuthServiceStubOverrides {
  twoFaEnabled?: () => boolean | null;
  ensureTwoFaStatus?: () => Observable<boolean>;
}

describe('twoFaConfiguredGuard', () => {
  const buildAuthServiceStub = (overrides: AuthServiceStubOverrides) =>
    ({
      twoFaEnabled: () => null,
      ensureTwoFaStatus: () => of(false),
      ...overrides,
    }) as unknown as AuthService;

  const configure = (authService: AuthService) =>
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authService }, provideRouter([])],
    });

  const runGuard = () =>
    TestBed.runInInjectionContext(() => twoFaConfiguredGuard({} as never, {} as never)) as
      | boolean
      | UrlTree
      | Observable<boolean | UrlTree>;

  it('allows activation without a network call when status is already known enabled', async () => {
    const ensureTwoFaStatus = vi.fn();
    configure(buildAuthServiceStub({ twoFaEnabled: () => true, ensureTwoFaStatus }));

    const result = await firstValueFrom(runGuard() as Observable<boolean | UrlTree>);

    expect(result).toBe(true);
    expect(ensureTwoFaStatus).not.toHaveBeenCalled();
  });

  it('redirects to 2FA setup when status is already known disabled', async () => {
    configure(buildAuthServiceStub({ twoFaEnabled: () => false }));

    const result = await firstValueFrom(runGuard() as Observable<boolean | UrlTree>);
    const router = TestBed.inject(Router);

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/2fa');
  });

  it('fetches the status when unknown, then allows activation if enabled', async () => {
    configure(buildAuthServiceStub({ twoFaEnabled: () => null, ensureTwoFaStatus: () => of(true) }));

    const result = await firstValueFrom(runGuard() as Observable<boolean | UrlTree>);

    expect(result).toBe(true);
  });

  it('fetches the status when unknown, then redirects if disabled', async () => {
    configure(buildAuthServiceStub({ twoFaEnabled: () => null, ensureTwoFaStatus: () => of(false) }));

    const result = await firstValueFrom(runGuard() as Observable<boolean | UrlTree>);
    const router = TestBed.inject(Router);

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/2fa');
  });
});
