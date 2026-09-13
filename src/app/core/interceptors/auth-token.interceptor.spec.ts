import { HttpContext, HttpRequest, type HttpEvent, type HttpHandlerFn } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, type Observable } from 'rxjs';
import type { TokenPairResponse } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { IS_CONNECTION_PROBE } from '../connection/connection-probe.token';
import { authTokenInterceptor } from './auth-token.interceptor';

interface AuthServiceStubOptions {
  accessToken: string | null;
  needsRefresh?: boolean;
  refreshTokens?: () => Observable<TokenPairResponse>;
}

describe('authTokenInterceptor', () => {
  const buildAuthServiceStub = ({ accessToken, needsRefresh = false, refreshTokens }: AuthServiceStubOptions) =>
    ({
      accessToken: () => accessToken,
      accessTokenNeedsRefresh: () => needsRefresh,
      refreshTokens: refreshTokens ?? (() => of({ accessToken: 'fresh-token', refreshToken: 'r2' })),
    }) as unknown as AuthService;

  const configure = (options: AuthServiceStubOptions) =>
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: buildAuthServiceStub(options) }],
    });

  const run = async (req: HttpRequest<unknown>) => {
    let capturedRequest: HttpRequest<unknown> | undefined;
    const next: HttpHandlerFn = (r) => {
      capturedRequest = r;
      return of({} as HttpEvent<unknown>);
    };
    await firstValueFrom(TestBed.runInInjectionContext(() => authTokenInterceptor(req, next)));
    return capturedRequest;
  };

  it('attaches the Authorization header when an access token is present', async () => {
    configure({ accessToken: 'a-token' });

    const captured = await run(new HttpRequest('GET', '/orders'));

    expect(captured?.headers.get('Authorization')).toBe('Bearer a-token');
  });

  it('leaves the request untouched when there is no access token', async () => {
    configure({ accessToken: null });

    const captured = await run(new HttpRequest('GET', '/orders'));

    expect(captured?.headers.has('Authorization')).toBe(false);
  });

  it('refreshes an expiring access token before sending, and sends the fresh one', async () => {
    const refreshTokens = vi.fn(() => of({ accessToken: 'fresh-token', refreshToken: 'r2' }));
    configure({ accessToken: 'old-token', needsRefresh: true, refreshTokens });

    const captured = await run(new HttpRequest('GET', '/orders'));

    expect(refreshTokens).toHaveBeenCalledOnce();
    expect(captured?.headers.get('Authorization')).toBe('Bearer fresh-token');
  });

  it('never refreshes proactively for the token-issuing endpoints themselves', async () => {
    const refreshTokens = vi.fn();
    configure({ accessToken: 'old-token', needsRefresh: true, refreshTokens });

    const captured = await run(new HttpRequest('POST', '/auth/refresh', { refreshToken: 'r' }));

    expect(refreshTokens).not.toHaveBeenCalled();
    expect(captured?.headers.get('Authorization')).toBe('Bearer old-token');
  });

  it('passes connection probes through untouched, without a token or a refresh', async () => {
    const refreshTokens = vi.fn();
    configure({ accessToken: 'old-token', needsRefresh: true, refreshTokens });

    const captured = await run(
      new HttpRequest('GET', '/ping', { context: new HttpContext().set(IS_CONNECTION_PROBE, true) }),
    );

    expect(refreshTokens).not.toHaveBeenCalled();
    expect(captured?.headers.has('Authorization')).toBe(false);
  });
});
