import { HttpErrorResponse, HttpRequest, type HttpEvent, type HttpHandlerFn } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';
import type { TokenPairResponse } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { authRefreshInterceptor } from './auth-refresh.interceptor';

interface AuthServiceStubOverrides {
  isAuthenticated?: () => boolean;
  refreshTokens?: () => Observable<TokenPairResponse>;
  handleSessionExpired?: () => void;
}

describe('authRefreshInterceptor', () => {
  const successEvent = {} as HttpEvent<unknown>;

  const buildAuthServiceStub = (overrides: AuthServiceStubOverrides = {}) =>
    ({
      isAuthenticated: () => true,
      refreshTokens: () => of({ accessToken: 'a2', refreshToken: 'r2' }),
      handleSessionExpired: () => undefined,
      ...overrides,
    }) as unknown as AuthService;

  const configure = (authService: AuthService) =>
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: authService }] });

  it('passes through non-401 errors without attempting a refresh', async () => {
    const refreshTokens = vi.fn();
    configure(buildAuthServiceStub({ refreshTokens }));
    const req = new HttpRequest('GET', '/orders');
    const next: HttpHandlerFn = () =>
      throwError(() => new HttpErrorResponse({ status: 500 })) as Observable<HttpEvent<unknown>>;

    await expect(
      firstValueFrom(TestBed.runInInjectionContext(() => authRefreshInterceptor(req, next))),
    ).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it('does not refresh on a 401 from an exempt auth path', async () => {
    const refreshTokens = vi.fn();
    configure(buildAuthServiceStub({ refreshTokens }));
    const req = new HttpRequest('POST', '/auth/login', {});
    const next: HttpHandlerFn = () =>
      throwError(() => new HttpErrorResponse({ status: 401 })) as Observable<HttpEvent<unknown>>;

    await expect(
      firstValueFrom(TestBed.runInInjectionContext(() => authRefreshInterceptor(req, next))),
    ).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it('does not refresh a 401 when there is no active session', async () => {
    const refreshTokens = vi.fn();
    configure(buildAuthServiceStub({ isAuthenticated: () => false, refreshTokens }));
    const req = new HttpRequest('GET', '/orders');
    const next: HttpHandlerFn = () =>
      throwError(() => new HttpErrorResponse({ status: 401 })) as Observable<HttpEvent<unknown>>;

    await expect(
      firstValueFrom(TestBed.runInInjectionContext(() => authRefreshInterceptor(req, next))),
    ).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it('refreshes and retries the original request once on a 401', async () => {
    configure(buildAuthServiceStub());
    const req = new HttpRequest('GET', '/orders');
    let callCount = 0;
    let retriedRequest: HttpRequest<unknown> | undefined;
    const next: HttpHandlerFn = (r) => {
      callCount += 1;
      if (callCount === 1) {
        return throwError(() => new HttpErrorResponse({ status: 401 })) as Observable<HttpEvent<unknown>>;
      }
      retriedRequest = r;
      return of(successEvent);
    };

    const result = await firstValueFrom(
      TestBed.runInInjectionContext(() => authRefreshInterceptor(req, next)),
    );

    expect(result).toBe(successEvent);
    expect(callCount).toBe(2);
    expect(retriedRequest?.headers.get('Authorization')).toBe('Bearer a2');
  });

  it('clears the session when the refresh call itself fails', async () => {
    const handleSessionExpired = vi.fn();
    configure(
      buildAuthServiceStub({
        refreshTokens: () => throwError(() => new HttpErrorResponse({ status: 401 })),
        handleSessionExpired,
      }),
    );
    const req = new HttpRequest('GET', '/orders');
    const next: HttpHandlerFn = () =>
      throwError(() => new HttpErrorResponse({ status: 401 })) as Observable<HttpEvent<unknown>>;

    await expect(
      firstValueFrom(TestBed.runInInjectionContext(() => authRefreshInterceptor(req, next))),
    ).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(handleSessionExpired).toHaveBeenCalledOnce();
  });

  it('does not clear the session when the refresh succeeds but the retried request still fails', async () => {
    const handleSessionExpired = vi.fn();
    configure(buildAuthServiceStub({ handleSessionExpired }));
    const req = new HttpRequest('GET', '/orders');
    let callCount = 0;
    const next: HttpHandlerFn = () => {
      callCount += 1;
      return throwError(() => new HttpErrorResponse({ status: 401 })) as Observable<HttpEvent<unknown>>;
    };

    await expect(
      firstValueFrom(TestBed.runInInjectionContext(() => authRefreshInterceptor(req, next))),
    ).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(callCount).toBe(2);
    expect(handleSessionExpired).not.toHaveBeenCalled();
  });
});
