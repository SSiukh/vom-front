import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, catchError, filter, finalize, fromEvent, map, of, shareReplay, tap, throwError } from 'rxjs';
import { AuthApiService } from '../api/auth-api.service';
import { AUTH_ROUTES } from './auth-routes.constants';
import type {
  ConfirmTwoFaResponse,
  LoginResponse,
  SetupTwoFaResponse,
  TokenPairResponse,
} from './auth.models';
import { runWithCrossTabLock } from './cross-tab-lock';
import { readJwtTimeClaimMs } from './jwt.util';

export const ACCESS_TOKEN_KEY = 'vom_access_token';
export const REFRESH_TOKEN_KEY = 'vom_refresh_token';
export const LOGIN_KEY = 'vom_login';

const SESSION_STORAGE_KEYS = [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, LOGIN_KEY];
const TOKEN_REFRESH_LOCK = 'vom-token-refresh';
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 30_000;

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  login: string | null;
}

const readStoredSession = (): StoredSession | null => {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!accessToken || !refreshToken) {
    return null;
  }
  return { accessToken, refreshToken, login: localStorage.getItem(LOGIN_KEY) };
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);

  private readonly accessTokenSignal = signal<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY));
  private readonly refreshTokenSignal = signal<string | null>(localStorage.getItem(REFRESH_TOKEN_KEY));
  private readonly loginSignal = signal<string | null>(localStorage.getItem(LOGIN_KEY));
  private readonly twoFaEnabledSignal = signal<boolean | null>(null);
  private readonly pendingTokenSignal = signal<string | null>(null);
  private readonly pendingLoginSignal = signal<string | null>(null);
  private refreshInFlight: Observable<TokenPairResponse> | null = null;
  private clockOffsetMs = 0;

  readonly accessToken = this.accessTokenSignal.asReadonly();
  readonly login = this.loginSignal.asReadonly();
  readonly twoFaEnabled = this.twoFaEnabledSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.accessTokenSignal() !== null);
  readonly hasPendingTwoFa = computed(() => this.pendingTokenSignal() !== null);

  constructor() {
    fromEvent<StorageEvent>(window, 'storage')
      .pipe(
        filter(
          (event) =>
            event.storageArea === localStorage && (event.key === null || SESSION_STORAGE_KEYS.includes(event.key)),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.syncSessionFromStorage());
  }

  loginWithPassword(login: string, password: string): Observable<LoginResponse> {
    return this.authApi.login({ login, password }).pipe(
      tap((response) => {
        if (response.requiresTwoFa) {
          this.pendingTokenSignal.set(response.pendingToken);
          this.pendingLoginSignal.set(login);
          return;
        }
        this.storeSession(login, response.accessToken, response.refreshToken);
      }),
    );
  }

  verifyTwoFactor(code: string): Observable<TokenPairResponse> {
    const pendingToken = this.pendingTokenSignal();
    const pendingLogin = this.pendingLoginSignal();
    if (!pendingToken || !pendingLogin) {
      throw new Error('verifyTwoFactor called without a pending login');
    }
    return this.authApi.verifyLogin({ pendingToken, code }).pipe(
      tap((response) => {
        this.pendingTokenSignal.set(null);
        this.pendingLoginSignal.set(null);
        this.storeSession(pendingLogin, response.accessToken, response.refreshToken);
        this.twoFaEnabledSignal.set(true);
      }),
    );
  }

  setupTwoFactor(): Observable<SetupTwoFaResponse> {
    return this.authApi.setupTwoFa();
  }

  confirmTwoFactor(code: string): Observable<ConfirmTwoFaResponse> {
    return this.authApi.confirmTwoFa({ code }).pipe(
      tap(() => this.twoFaEnabledSignal.set(true)),
    );
  }

  ensureTwoFaStatus(): Observable<boolean> {
    return this.authApi.getTwoFaStatus().pipe(
      map((response) => response.twoFaEnabled),
      tap((enabled) => this.twoFaEnabledSignal.set(enabled)),
    );
  }

  accessTokenNeedsRefresh(): boolean {
    const accessToken = this.accessTokenSignal();
    if (!accessToken || !this.refreshTokenSignal()) {
      return false;
    }
    const expiresAt = readJwtTimeClaimMs(accessToken, 'exp');
    if (expiresAt === null) {
      return false;
    }
    const serverNow = Date.now() - this.clockOffsetMs;
    return expiresAt - serverNow <= ACCESS_TOKEN_REFRESH_MARGIN_MS;
  }

  refreshTokens(): Observable<TokenPairResponse> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    const refreshToken = this.refreshTokenSignal();
    if (!refreshToken) {
      throw new Error('refreshTokens called without a stored refresh token');
    }
    this.refreshInFlight = runWithCrossTabLock(TOKEN_REFRESH_LOCK, () =>
      this.refreshUnlessRotatedElsewhere(refreshToken),
    ).pipe(
      finalize(() => {
        this.refreshInFlight = null;
      }),
      shareReplay(1),
    );
    return this.refreshInFlight;
  }

  logout(): void {
    this.authApi.logout().subscribe({
      next: () => this.clearSessionAndRedirect(),
      error: () => this.clearSessionAndRedirect(),
    });
  }

  private refreshUnlessRotatedElsewhere(capturedRefreshToken: string): Observable<TokenPairResponse> {
    const stored = readStoredSession();
    if (!stored) {
      this.resetSessionState();
      this.router.navigateByUrl(AUTH_ROUTES.login);
      return throwError(() => new Error('The session was ended in another tab'));
    }
    if (stored.refreshToken !== capturedRefreshToken) {
      this.applySession(stored);
      if (!this.accessTokenNeedsRefresh()) {
        return of({ accessToken: stored.accessToken, refreshToken: stored.refreshToken });
      }
    }
    const sentRefreshToken = stored.refreshToken;
    return this.authApi.refresh({ refreshToken: sentRefreshToken }).pipe(
      tap((response) => this.storeSession(this.loginSignal() ?? '', response.accessToken, response.refreshToken)),
      catchError((error: unknown) => {
        if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
          return throwError(() => error);
        }
        const replacement = readStoredSession();
        if (replacement && replacement.refreshToken !== sentRefreshToken) {
          this.applySession(replacement);
          return of({ accessToken: replacement.accessToken, refreshToken: replacement.refreshToken });
        }
        this.clearSessionAndRedirect();
        return throwError(() => error);
      }),
    );
  }

  private syncSessionFromStorage(): void {
    const stored = readStoredSession();
    if (!stored) {
      if (this.accessTokenSignal() !== null || this.refreshTokenSignal() !== null) {
        this.resetSessionState();
        this.router.navigateByUrl(AUTH_ROUTES.login);
      }
      return;
    }

    const previousLogin = this.loginSignal();
    const pendingLogin = this.pendingLoginSignal();
    this.applySession(stored);

    if (pendingLogin !== null && stored.login === pendingLogin) {
      this.pendingTokenSignal.set(null);
      this.pendingLoginSignal.set(null);
      this.twoFaEnabledSignal.set(null);
      if (this.isOnAuthPage()) {
        this.router.navigateByUrl('/');
      }
      return;
    }

    if (stored.login !== null && previousLogin !== null && stored.login !== previousLogin) {
      this.twoFaEnabledSignal.set(null);
    }
  }

  private isOnAuthPage(): boolean {
    const path = this.router.url.split(/[?#]/)[0];
    return path === AUTH_ROUTES.login || path === AUTH_ROUTES.twoFa;
  }

  private storeSession(login: string, accessToken: string, refreshToken: string): void {
    const issuedAt = readJwtTimeClaimMs(accessToken, 'iat');
    this.clockOffsetMs = issuedAt === null ? 0 : Date.now() - issuedAt;
    this.applySession({ accessToken, refreshToken, login });
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(LOGIN_KEY, login);
  }

  private applySession(session: StoredSession): void {
    this.accessTokenSignal.set(session.accessToken);
    this.refreshTokenSignal.set(session.refreshToken);
    this.loginSignal.set(session.login);
  }

  private resetSessionState(): void {
    this.accessTokenSignal.set(null);
    this.refreshTokenSignal.set(null);
    this.loginSignal.set(null);
    this.twoFaEnabledSignal.set(null);
    this.pendingTokenSignal.set(null);
    this.pendingLoginSignal.set(null);
  }

  private clearSessionAndRedirect(): void {
    this.resetSessionState();
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(LOGIN_KEY);
    this.router.navigateByUrl(AUTH_ROUTES.login);
  }
}
