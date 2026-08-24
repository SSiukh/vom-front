import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, map, shareReplay, tap } from 'rxjs';
import { AuthApiService } from '../api/auth-api.service';
import { AUTH_ROUTES } from './auth-routes.constants';
import type {
  ConfirmTwoFaResponse,
  LoginResponse,
  SetupTwoFaResponse,
  TokenPairResponse,
} from './auth.models';

export const ACCESS_TOKEN_KEY = 'vom_access_token';
export const REFRESH_TOKEN_KEY = 'vom_refresh_token';
export const LOGIN_KEY = 'vom_login';

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

  readonly accessToken = this.accessTokenSignal.asReadonly();
  readonly login = this.loginSignal.asReadonly();
  readonly twoFaEnabled = this.twoFaEnabledSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.accessTokenSignal() !== null);
  readonly hasPendingTwoFa = computed(() => this.pendingTokenSignal() !== null);

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

  refreshTokens(): Observable<TokenPairResponse> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    const refreshToken = this.refreshTokenSignal();
    if (!refreshToken) {
      throw new Error('refreshTokens called without a stored refresh token');
    }
    this.refreshInFlight = this.authApi.refresh({ refreshToken }).pipe(
      tap((response) => this.storeSession(this.loginSignal() ?? '', response.accessToken, response.refreshToken)),
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

  handleSessionExpired(): void {
    this.clearSessionAndRedirect();
  }

  private storeSession(login: string, accessToken: string, refreshToken: string): void {
    this.accessTokenSignal.set(accessToken);
    this.refreshTokenSignal.set(refreshToken);
    this.loginSignal.set(login);
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(LOGIN_KEY, login);
  }

  private clearSessionAndRedirect(): void {
    this.accessTokenSignal.set(null);
    this.refreshTokenSignal.set(null);
    this.loginSignal.set(null);
    this.twoFaEnabledSignal.set(null);
    this.pendingTokenSignal.set(null);
    this.pendingLoginSignal.set(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(LOGIN_KEY);
    this.router.navigateByUrl(AUTH_ROUTES.login);
  }
}
