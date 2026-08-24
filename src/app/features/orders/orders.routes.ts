import { Routes } from '@angular/router';
import { OrdersCreate } from './pages/orders-create/orders-create';
import { OrdersDetail } from './pages/orders-detail/orders-detail';
import { OrdersEdit } from './pages/orders-edit/orders-edit';
import { OrdersList } from './pages/orders-list/orders-list';

export const ORDERS_ROUTES: Routes = [
  { path: '', component: OrdersList },
  { path: 'new', component: OrdersCreate },
  { path: ':id/edit', component: OrdersEdit },
  { path: ':id', component: OrdersDetail },
];
