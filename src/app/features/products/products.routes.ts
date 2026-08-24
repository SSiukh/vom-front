import { Routes } from '@angular/router';
import { ProductsDetail } from './pages/products-detail/products-detail';
import { ProductsForm } from './pages/products-form/products-form';
import { ProductsList } from './pages/products-list/products-list';

export const PRODUCTS_ROUTES: Routes = [
  { path: '', component: ProductsList },
  { path: 'new', component: ProductsForm },
  { path: ':id/edit', component: ProductsForm },
  { path: ':id', component: ProductsDetail },
];
