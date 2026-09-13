import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ACCESS_TOKEN_KEY, AuthService, LOGIN_KEY, REFRESH_TOKEN_KEY } from './auth.service';
import { buildTestJwt } from './testing/build-test-jwt';

const baseUrl = `${environment.apiUrl}/auth`;

describe('AuthService', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    vi.spyOn(Router.prototype, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('restores a persisted session from localStorage on construction', () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'a');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'r');
    localStorage.setItem(LOGIN_KEY, 'admin');

    const service = TestBed.inject(AuthService);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.accessToken()).toBe('a');
    expect(service.login()).toBe('admin');
  });

  it('starts unauthenticated when localStorage is empty', () => {
    const service = TestBed.inject(AuthService);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.hasPendingTwoFa()).toBe(false);
  });

  it('stores tokens immediately when login does not require 2FA', () => {
    const service = TestBed.inject(AuthService);

    service.loginWithPassword('admin', 'secret').subscribe();
    httpMock
      .expectOne(`${baseUrl}/login`)
      .flush({ requiresTwoFa: false, accessToken: 'a', refreshToken: 'r' });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.login()).toBe('admin');
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('a');
  });

  it('does not store tokens when login requires 2FA, and unlocks verifyTwoFactor', () => {
    const service = TestBed.inject(AuthService);

    service.loginWithPassword('admin', 'secret').subscribe();
    httpMock
      .expectOne(`${baseUrl}/login`)
      .flush({ requiresTwoFa: true, pendingToken: 'pending-1' });

    expect(service.isAuthenticated()).toBe(false);
    expect(service.hasPendingTwoFa()).toBe(true);

    service.verifyTwoFactor('123456').subscribe();
    const verifyReq = httpMock.expectOne(`${baseUrl}/2fa/verify-login`);
    expect(verifyReq.request.body).toEqual({ pendingToken: 'pending-1', code: '123456' });
    verifyReq.flush({ accessToken: 'a', refreshToken: 'r' });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.twoFaEnabled()).toBe(true);
    expect(service.login()).toBe('admin');
    expect(localStorage.getItem(LOGIN_KEY)).toBe('admin');
    expect(service.hasPendingTwoFa()).toBe(false);
  });

  it('throws when verifyTwoFactor is called without a pending login', () => {
    const service = TestBed.inject(AuthService);
    expect(() => service.verifyTwoFactor('123456')).toThrow();
  });

  it('updates twoFaEnabled after confirmTwoFactor', () => {
    const service = TestBed.inject(AuthService);

    service.confirmTwoFactor('123456').subscribe();
    httpMock.expectOne(`${baseUrl}/2fa/confirm`).flush({ recoveryCodes: ['a', 'b'] });

    expect(service.twoFaEnabled()).toBe(true);
  });

  it('ensureTwoFaStatus fetches and stores the current status', () => {
    const service = TestBed.inject(AuthService);

    service.ensureTwoFaStatus().subscribe();
    httpMock.expectOne(`${baseUrl}/2fa/status`).flush({ twoFaEnabled: false });

    expect(service.twoFaEnabled()).toBe(false);
  });

  it('shares a single in-flight refresh call across concurrent requests', () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'expired');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'r1');
    localStorage.setItem(LOGIN_KEY, 'admin');
    const service = TestBed.inject(AuthService);

    let firstResult: unknown;
    let secondResult: unknown;
    service.refreshTokens().subscribe((value) => (firstResult = value));
    service.refreshTokens().subscribe((value) => (secondResult = value));

    httpMock.expectOne(`${baseUrl}/refresh`).flush({ accessToken: 'a2', refreshToken: 'r2' });

    expect(firstResult).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
    expect(secondResult).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
    expect(service.accessToken()).toBe('a2');
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('r2');
  });

  it('throws when refreshTokens is called without a stored refresh token', () => {
    const service = TestBed.inject(AuthService);
    expect(() => service.refreshTokens()).toThrow();
  });

  it('clears the session and redirects to login on logout', () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'a');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'r');
    localStorage.setItem(LOGIN_KEY, 'admin');
    const service = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    service.logout();
    httpMock.expectOne(`${baseUrl}/logout`).flush(null);

    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });

  it('clears the session even when logout fails server-side', () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'a');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'r');
    localStorage.setItem(LOGIN_KEY, 'admin');
    const service = TestBed.inject(AuthService);

    service.logout();
    httpMock.expectOne(`${baseUrl}/logout`).flush(null, { status: 500, statusText: 'Server Error' });

    expect(service.isAuthenticated()).toBe(false);
  });

  it('clears the session and redirects to login when the refresh token is rejected with 401', () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'a');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'r');
    localStorage.setItem(LOGIN_KEY, 'admin');
    const service = TestBed.inject(AuthService);
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    let failed = false;
    service.refreshTokens().subscribe({ error: () => (failed = true) });
    httpMock.expectOne(`${baseUrl}/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });

  it('keeps the session when the refresh fails for a reason other than 401', () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'a');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'r');
    localStorage.setItem(LOGIN_KEY, 'admin');
    const service = TestBed.inject(AuthService);

    let failed = false;
    service.refreshTokens().subscribe({ error: () => (failed = true) });
    httpMock.expectOne(`${baseUrl}/refresh`).error(new ProgressEvent('error'));

    expect(failed).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('r');
  });

  describe('accessTokenNeedsRefresh', () => {
    const buildToken = (claims: Record<string, number>): string => buildTestJwt({ sub: 'u1', ...claims });
    const nowSeconds = () => Math.floor(Date.now() / 1000);

    const startSession = (accessToken: string, refreshToken: string | null = 'r') => {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      }
      localStorage.setItem(LOGIN_KEY, 'admin');
      return TestBed.inject(AuthService);
    };

    it('is false while the access token has plenty of lifetime left', () => {
      const service = startSession(buildToken({ iat: nowSeconds(), exp: nowSeconds() + 900 }));

      expect(service.accessTokenNeedsRefresh()).toBe(false);
    });

    it('is true when the access token expires within the refresh margin', () => {
      const service = startSession(buildToken({ exp: nowSeconds() + 10 }));

      expect(service.accessTokenNeedsRefresh()).toBe(true);
    });

    it('is true when the access token has already expired', () => {
      const service = startSession(buildToken({ exp: nowSeconds() - 60 }));

      expect(service.accessTokenNeedsRefresh()).toBe(true);
    });

    it('is false without a stored refresh token to refresh with', () => {
      const service = startSession(buildToken({ exp: nowSeconds() - 60 }), null);

      expect(service.accessTokenNeedsRefresh()).toBe(false);
    });

    it('is false when the access token has no readable exp, leaving expiry to the 401 path', () => {
      const service = startSession('opaque-token');

      expect(service.accessTokenNeedsRefresh()).toBe(false);
    });

    it('compensates for a client clock that runs ahead of the server, using the fresh token iat', () => {
      const service = startSession(buildToken({ exp: nowSeconds() + 900 }));
      const clockAheadMs = 20 * 60_000;
      const serverNow = nowSeconds();
      vi.spyOn(Date, 'now').mockReturnValue(serverNow * 1000 + clockAheadMs);

      service.refreshTokens().subscribe();
      httpMock
        .expectOne(`${baseUrl}/refresh`)
        .flush({ accessToken: buildToken({ iat: serverNow, exp: serverNow + 900 }), refreshToken: 'r2' });

      expect(service.accessTokenNeedsRefresh()).toBe(false);
    });
  });

  describe('sync across tabs', () => {
    const startSession = (accessToken = 'a1', refreshToken = 'r1') => {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(LOGIN_KEY, 'admin');
      return TestBed.inject(AuthService);
    };

    const writeFromOtherTab = (key: string, value: string | null, storageArea: Storage = localStorage) => {
      if (value === null) {
        storageArea.removeItem(key);
      } else {
        storageArea.setItem(key, value);
      }
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: value, storageArea }));
    };

    const installLocks = (request: (name: string, callback: () => Promise<unknown>) => Promise<unknown>) => {
      Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });
    };

    afterEach(() => {
      Reflect.deleteProperty(navigator, 'locks');
      sessionStorage.clear();
    });

    it('adopts a token pair that another tab rotated, and refreshes with it next time', () => {
      const service = startSession();

      writeFromOtherTab(ACCESS_TOKEN_KEY, 'a2');
      writeFromOtherTab(REFRESH_TOKEN_KEY, 'r2');

      expect(service.accessToken()).toBe('a2');
      service.refreshTokens().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/refresh`);
      expect(req.request.body).toEqual({ refreshToken: 'r2' });
      req.flush({ accessToken: 'a3', refreshToken: 'r3' });
    });

    it('signs this tab out without touching storage when another tab ends the session', () => {
      const service = startSession();
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      writeFromOtherTab(ACCESS_TOKEN_KEY, null);
      writeFromOtherTab(REFRESH_TOKEN_KEY, null);
      writeFromOtherTab(LOGIN_KEY, null);

      expect(service.isAuthenticated()).toBe(false);
      expect(service.login()).toBeNull();
      expect(navigateSpy).toHaveBeenCalledOnce();
      expect(navigateSpy).toHaveBeenCalledWith('/login');
    });

    it('signs this tab out when another tab clears storage entirely', () => {
      const service = startSession();
      localStorage.clear();

      window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }));

      expect(service.isAuthenticated()).toBe(false);
    });

    it('picks up a session that another tab signed into', () => {
      const service = TestBed.inject(AuthService);
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      writeFromOtherTab(ACCESS_TOKEN_KEY, 'a1');
      writeFromOtherTab(REFRESH_TOKEN_KEY, 'r1');
      writeFromOtherTab(LOGIN_KEY, 'admin');

      expect(service.isAuthenticated()).toBe(true);
      expect(service.login()).toBe('admin');
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('ignores storage events for unrelated keys and for sessionStorage', () => {
      const service = startSession();

      writeFromOtherTab('some_other_key', 'x');
      writeFromOtherTab(ACCESS_TOKEN_KEY, 'from-session-storage', sessionStorage);

      expect(service.accessToken()).toBe('a1');
    });

    it('keeps its measured clock offset for a pair adopted from another tab', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const service = startSession(buildTestJwt({ iat: nowSeconds, exp: nowSeconds + 900 }));

      writeFromOtherTab(ACCESS_TOKEN_KEY, buildTestJwt({ iat: nowSeconds - 880, exp: nowSeconds + 20 }));

      expect(service.accessTokenNeedsRefresh()).toBe(true);
    });

    it('refreshes inside the cross-tab lock when no other tab rotated the token meanwhile', async () => {
      const request = vi.fn((_name: string, callback: () => Promise<unknown>) => callback());
      installLocks(request);
      const service = startSession();

      let result: unknown;
      service.refreshTokens().subscribe((value) => (result = value));
      const req = await vi.waitFor(() => httpMock.expectOne(`${baseUrl}/refresh`));
      expect(req.request.body).toEqual({ refreshToken: 'r1' });
      req.flush({ accessToken: 'a2', refreshToken: 'r2' });

      await vi.waitFor(() => expect(result).toEqual({ accessToken: 'a2', refreshToken: 'r2' }));
      expect(request).toHaveBeenCalledWith('vom-token-refresh', expect.any(Function));
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('r2');
    });

    it('adopts the pair another tab rotated while this tab waited for the lock, without calling the API', async () => {
      installLocks((_name, callback) => {
        localStorage.setItem(ACCESS_TOKEN_KEY, 'a2');
        localStorage.setItem(REFRESH_TOKEN_KEY, 'r2');
        return callback();
      });
      const service = startSession();

      let result: unknown;
      service.refreshTokens().subscribe((value) => (result = value));

      await vi.waitFor(() => expect(result).toEqual({ accessToken: 'a2', refreshToken: 'r2' }));
      httpMock.expectNone(`${baseUrl}/refresh`);
      expect(service.accessToken()).toBe('a2');
    });

    it('refreshes with the adopted refresh token when the adopted access token is itself about to expire', async () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      installLocks((_name, callback) => {
        localStorage.setItem(ACCESS_TOKEN_KEY, buildTestJwt({ iat: nowSeconds - 900, exp: nowSeconds - 5 }));
        localStorage.setItem(REFRESH_TOKEN_KEY, 'r2');
        return callback();
      });
      const service = startSession();

      service.refreshTokens().subscribe();
      const req = await vi.waitFor(() => httpMock.expectOne(`${baseUrl}/refresh`));

      expect(req.request.body).toEqual({ refreshToken: 'r2' });
      req.flush({ accessToken: 'a3', refreshToken: 'r3' });
      await vi.waitFor(() => expect(service.accessToken()).toBe('a3'));
    });

    it('never sends its dead refresh token when another tab ended the session while it waited for the lock', async () => {
      installLocks((_name, callback) => {
        localStorage.clear();
        localStorage.setItem(ACCESS_TOKEN_KEY, 'a-other-tab-signing-in');
        return callback();
      });
      const service = startSession();
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      let failed = false;
      service.refreshTokens().subscribe({ error: () => (failed = true) });

      await vi.waitFor(() => expect(failed).toBe(true));
      httpMock.expectNone(`${baseUrl}/refresh`);
      expect(service.isAuthenticated()).toBe(false);
      expect(navigateSpy).toHaveBeenCalledWith('/login');
      expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('a-other-tab-signing-in');
    });

    it('retries with a newer session another tab stored when the refresh this tab sent is rejected', () => {
      const service = startSession();
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      let result: unknown;
      service.refreshTokens().subscribe((value) => (result = value));
      const req = httpMock.expectOne(`${baseUrl}/refresh`);
      localStorage.setItem(ACCESS_TOKEN_KEY, 'a-new');
      localStorage.setItem(REFRESH_TOKEN_KEY, 'r-new');
      req.flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(result).toEqual({ accessToken: 'a-new', refreshToken: 'r-new' });
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('r-new');
      expect(service.accessToken()).toBe('a-new');
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('stays on the current page when another tab only rotates the tokens', () => {
      startSession();
      vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/orders');
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      writeFromOtherTab(ACCESS_TOKEN_KEY, 'a2');
      writeFromOtherTab(REFRESH_TOKEN_KEY, 'r2');

      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('moves a tab waiting for its 2FA code into the app when another tab completes a sign-in', () => {
      const service = TestBed.inject(AuthService);
      service.loginWithPassword('admin', 'secret').subscribe();
      httpMock.expectOne(`${baseUrl}/login`).flush({ requiresTwoFa: true, pendingToken: 'pending-1' });
      vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/2fa');
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      writeFromOtherTab(ACCESS_TOKEN_KEY, 'a1');
      writeFromOtherTab(REFRESH_TOKEN_KEY, 'r1');
      writeFromOtherTab(LOGIN_KEY, 'admin');

      expect(service.isAuthenticated()).toBe(true);
      expect(service.hasPendingTwoFa()).toBe(false);
      expect(service.twoFaEnabled()).toBeNull();
      expect(navigateSpy).toHaveBeenCalledOnce();
      expect(navigateSpy).toHaveBeenCalledWith('/');
    });

    it('keeps a tab on the login page where it is when another tab signs in, so 2FA setup stays in one tab', () => {
      const service = TestBed.inject(AuthService);
      vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/login');
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      writeFromOtherTab(ACCESS_TOKEN_KEY, 'a1');
      writeFromOtherTab(REFRESH_TOKEN_KEY, 'r1');
      writeFromOtherTab(LOGIN_KEY, 'admin');

      expect(service.isAuthenticated()).toBe(true);
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('keeps a tab waiting for a 2FA code where it is when another tab signs in as a different user', () => {
      const service = TestBed.inject(AuthService);
      service.loginWithPassword('admin', 'secret').subscribe();
      httpMock.expectOne(`${baseUrl}/login`).flush({ requiresTwoFa: true, pendingToken: 'pending-1' });
      vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/2fa');
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      writeFromOtherTab(ACCESS_TOKEN_KEY, 'a1');
      writeFromOtherTab(REFRESH_TOKEN_KEY, 'r1');
      writeFromOtherTab(LOGIN_KEY, 'second-admin');

      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('forgets the known 2FA status when another tab signs in as a different user', () => {
      const service = startSession();
      service.ensureTwoFaStatus().subscribe();
      httpMock.expectOne(`${baseUrl}/2fa/status`).flush({ twoFaEnabled: true });

      writeFromOtherTab(LOGIN_KEY, 'second-admin');

      expect(service.login()).toBe('second-admin');
      expect(service.twoFaEnabled()).toBeNull();
    });

    it('leaves a pending 2FA sign-in alone when another tab signs out', () => {
      const service = TestBed.inject(AuthService);
      service.loginWithPassword('admin', 'secret').subscribe();
      httpMock.expectOne(`${baseUrl}/login`).flush({ requiresTwoFa: true, pendingToken: 'pending-1' });
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      writeFromOtherTab(ACCESS_TOKEN_KEY, null);
      writeFromOtherTab(REFRESH_TOKEN_KEY, null);

      expect(service.hasPendingTwoFa()).toBe(true);
      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });
});
