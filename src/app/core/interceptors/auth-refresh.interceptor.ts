import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

const NO_REFRESH_RETRY_PATHS = ['/auth/login', '/auth/2fa/verify-login', '/auth/refresh'];

export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;
      const isRetryExempt = NO_REFRESH_RETRY_PATHS.some((path) => req.url.includes(path));

      if (!isUnauthorized || isRetryExempt || !authService.isAuthenticated()) {
        return throwError(() => error);
      }

      return authService.refreshTokens().pipe(
        catchError((refreshError: unknown) => {
          authService.handleSessionExpired();
          return throwError(() => refreshError);
        }),
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
