import { Routes } from '@angular/router';
import { SendersCreate } from './pages/senders-create/senders-create';
import { SendersList } from './pages/senders-list/senders-list';

export const SENDERS_ROUTES: Routes = [
  { path: '', component: SendersList },
  { path: 'new', component: SendersCreate },
];
