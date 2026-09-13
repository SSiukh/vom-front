import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { isTokenRefreshExempt } from '../auth/token-refresh-exempt';
import { IS_CONNECTION_PROBE } from '../connection/connection-probe.token';

export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(IS_CONNECTION_PROBE)) {
    return next(req);
  }

  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;

      if (!isUnauthorized || isTokenRefreshExempt(req.url) || !authService.isAuthenticated()) {
        return throwError(() => error);
      }

      return authService.refreshTokens().pipe(
        switchMap((tokenPair) =>
          next(
            req.clone({
              setHeaders: { Authorization: `Bearer ${tokenPair.accessToken}` },
            }),
          ),
        ),
      );
    }),
  );
};
