import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { REQUEST_TIMEOUT_MS } from '../interceptors/request-timeout.interceptor';
import type {
  ConfirmTwoFaRequest,
  ConfirmTwoFaResponse,
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  SetupTwoFaResponse,
  TokenPairResponse,
  TwoFaStatusResponse,
  VerifyLoginRequest,
} from '../auth/auth.models';

const REFRESH_TIMEOUT_MS = 120_000;

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, request);
  }

  verifyLogin(request: VerifyLoginRequest): Observable<TokenPairResponse> {
    return this.http.post<TokenPairResponse>(`${this.baseUrl}/2fa/verify-login`, request);
  }

  refresh(request: RefreshRequest): Observable<TokenPairResponse> {
    return this.http.post<TokenPairResponse>(`${this.baseUrl}/refresh`, request, {
      context: new HttpContext().set(REQUEST_TIMEOUT_MS, REFRESH_TIMEOUT_MS),
    });
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, {});
  }

  setupTwoFa(): Observable<SetupTwoFaResponse> {
    return this.http.post<SetupTwoFaResponse>(`${this.baseUrl}/2fa/setup`, {});
  }

  confirmTwoFa(request: ConfirmTwoFaRequest): Observable<ConfirmTwoFaResponse> {
    return this.http.post<ConfirmTwoFaResponse>(`${this.baseUrl}/2fa/confirm`, request);
  }

  getTwoFaStatus(): Observable<TwoFaStatusResponse> {
    return this.http.get<TwoFaStatusResponse>(`${this.baseUrl}/2fa/status`);
  }
}
