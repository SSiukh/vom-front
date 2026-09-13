import type { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { isTokenRefreshExempt } from '../auth/token-refresh-exempt';
import { IS_CONNECTION_PROBE } from '../connection/connection-probe.token';

const withBearer = (req: HttpRequest<unknown>, accessToken: string): HttpRequest<unknown> =>
  req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } });

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(IS_CONNECTION_PROBE)) {
    return next(req);
  }

  const authService = inject(AuthService);
  const accessToken = authService.accessToken();

  if (!accessToken) {
    return next(req);
  }

  if (!isTokenRefreshExempt(req.url) && authService.accessTokenNeedsRefresh()) {
    return authService.refreshTokens().pipe(switchMap((tokenPair) => next(withBearer(req, tokenPair.accessToken))));
  }

  return next(withBearer(req, accessToken));
};
