import { Routes } from '@angular/router';
import { AUTH_ROUTES } from './core/auth/auth-routes.constants';
import { authGuard } from './core/guards/auth.guard';
import { twoFaConfiguredGuard } from './core/guards/two-fa-configured.guard';
import { Shell } from './core/layout/shell/shell';
import { FEATURE_ROUTES } from './core/routes.constants';
import { Login } from './features/auth/pages/login/login';
import { TwoFa } from './features/two-fa/pages/two-fa/two-fa';

export const routes: Routes = [
  { path: AUTH_ROUTES.login.slice(1), component: Login },
  { path: AUTH_ROUTES.twoFa.slice(1), component: TwoFa },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard, twoFaConfiguredGuard],
    children: [
      {
        path: FEATURE_ROUTES.senders.slice(1),
        loadChildren: () => import('./features/senders/senders.routes').then((m) => m.SENDERS_ROUTES),
      },
      {
        path: FEATURE_ROUTES.products.slice(1),
        loadChildren: () => import('./features/products/products.routes').then((m) => m.PRODUCTS_ROUTES),
      },
    ],
  },
];
