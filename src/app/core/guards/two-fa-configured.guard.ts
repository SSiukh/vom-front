import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AUTH_ROUTES } from '../auth/auth-routes.constants';
import { ServerConnectionService } from '../connection/server-connection.service';

export const twoFaConfiguredGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const connection = inject(ServerConnectionService);
  const router = inject(Router);

  const knownStatus = authService.twoFaEnabled();
  const status$ = knownStatus === null ? authService.ensureTwoFaStatus() : of(knownStatus);

  return status$.pipe(
    map((enabled) => enabled || router.parseUrl(AUTH_ROUTES.twoFa)),
    catchError(() => {
      if (!authService.isAuthenticated()) {
        return of(router.parseUrl(AUTH_ROUTES.login));
      }
      connection.reportBlockedNavigation(state.url);
      return of(false);
    }),
  );
};
