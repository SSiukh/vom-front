import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { map, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AUTH_ROUTES } from '../auth/auth-routes.constants';

export const twoFaConfiguredGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const knownStatus = authService.twoFaEnabled();
  const status$ = knownStatus === null ? authService.ensureTwoFaStatus() : of(knownStatus);

  return status$.pipe(map((enabled) => enabled || router.parseUrl(AUTH_ROUTES.twoFa)));
};
