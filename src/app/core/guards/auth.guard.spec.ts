import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const buildAuthServiceStub = (isAuthenticated: boolean) =>
    ({ isAuthenticated: () => isAuthenticated }) as unknown as AuthService;

  const configure = (isAuthenticated: boolean) =>
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: buildAuthServiceStub(isAuthenticated) },
        provideRouter([]),
      ],
    });

  it('allows activation when authenticated', () => {
    configure(true);
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('redirects to login when not authenticated', () => {
    configure(false);
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toBeInstanceOf(UrlTree);

    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });
});
