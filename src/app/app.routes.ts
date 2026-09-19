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
      { path: '', redirectTo: FEATURE_ROUTES.orders.slice(1), pathMatch: 'full' },
      {
        path: FEATURE_ROUTES.orders.slice(1),
        loadChildren: () => import('./features/orders/orders.routes').then((m) => m.ORDERS_ROUTES),
      },
      {
        path: FEATURE_ROUTES.senders.slice(1),
        loadChildren: () => import('./features/senders/senders.routes').then((m) => m.SENDERS_ROUTES),
      },
      {
        path: FEATURE_ROUTES.stickers.slice(1),
        loadChildren: () => import('./features/sticker-generator/sticker-generator.routes').then((m) => m.STICKER_ROUTES),
      },
      {
        path: FEATURE_ROUTES.products.slice(1),
        loadChildren: () => import('./features/products/products.routes').then((m) => m.PRODUCTS_ROUTES),
      },
      {
        path: FEATURE_ROUTES.expenses.slice(1),
        loadChildren: () => import('./features/expenses/expenses.routes').then((m) => m.EXPENSES_ROUTES),
      },
      {
        path: FEATURE_ROUTES.crm.slice(1),
        loadChildren: () => import('./features/crm/crm.routes').then((m) => m.CRM_ROUTES),
      },
      {
        path: FEATURE_ROUTES.dashboard.slice(1),
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
    ],
  },
];
