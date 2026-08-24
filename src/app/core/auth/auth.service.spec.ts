import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ACCESS_TOKEN_KEY, AuthService, LOGIN_KEY, REFRESH_TOKEN_KEY } from './auth.service';

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

  it('handleSessionExpired clears the session and redirects to login', () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'a');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'r');
    localStorage.setItem(LOGIN_KEY, 'admin');
    const service = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    service.handleSessionExpired();

    expect(service.isAuthenticated()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });
});
