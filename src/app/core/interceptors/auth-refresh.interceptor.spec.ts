import { HttpContext, HttpErrorResponse, HttpRequest, type HttpEvent, type HttpHandlerFn } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';
import type { TokenPairResponse } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { IS_CONNECTION_PROBE } from '../connection/connection-probe.token';
import { authRefreshInterceptor } from './auth-refresh.interceptor';

interface AuthServiceStubOverrides {
  isAuthenticated?: () => boolean;
  refreshTokens?: () => Observable<TokenPairResponse>;
}

describe('authRefreshInterceptor', () => {
  const successEvent = {} as HttpEvent<unknown>;

  const buildAuthServiceStub = (overrides: AuthServiceStubOverrides = {}) =>
    ({
      isAuthenticated: () => true,
      refreshTokens: () => of({ accessToken: 'a2', refreshToken: 'r2' }),
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

  it('never refreshes on a 401 from a connection probe, so a ping cannot wait on itself', async () => {
    const refreshTokens = vi.fn();
    configure(buildAuthServiceStub({ refreshTokens }));
    const req = new HttpRequest('GET', '/ping', { context: new HttpContext().set(IS_CONNECTION_PROBE, true) });
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

  it('propagates the refresh error without retrying the original request', async () => {
    const refreshError = new HttpErrorResponse({ status: 401 });
    configure(buildAuthServiceStub({ refreshTokens: () => throwError(() => refreshError) }));
    const req = new HttpRequest('GET', '/orders');
    let callCount = 0;
    const next: HttpHandlerFn = () => {
      callCount += 1;
      return throwError(() => new HttpErrorResponse({ status: 401 })) as Observable<HttpEvent<unknown>>;
    };

    await expect(
      firstValueFrom(TestBed.runInInjectionContext(() => authRefreshInterceptor(req, next))),
    ).rejects.toBe(refreshError);
    expect(callCount).toBe(1);
  });

  it('retries only once when the refreshed request still fails with 401', async () => {
    const refreshTokens = vi.fn(() => of({ accessToken: 'a2', refreshToken: 'r2' }));
    configure(buildAuthServiceStub({ refreshTokens }));
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
    expect(refreshTokens).toHaveBeenCalledOnce();
  });
});
