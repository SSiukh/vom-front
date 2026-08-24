import { Routes } from '@angular/router';
import { ExpensesForm } from './pages/expenses-form/expenses-form';
import { ExpensesList } from './pages/expenses-list/expenses-list';

export const EXPENSES_ROUTES: Routes = [
  { path: '', component: ExpensesList },
  { path: 'new', component: ExpensesForm },
  { path: ':id/edit', component: ExpensesForm },
];
