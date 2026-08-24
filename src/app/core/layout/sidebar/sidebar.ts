import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideDynamicIcon,
  LucideLayoutDashboard,
  LucidePackage,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucideShieldCheck,
  LucideTable2,
  LucideTag,
  LucideUsers,
  LucideWallet,
  type LucideIcon,
} from '@lucide/angular';
import { AUTH_ROUTES } from '../../auth/auth-routes.constants';
import { FEATURE_ROUTES } from '../../routes.constants';
import { LayoutStateService } from '../layout-state.service';

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Замовлення', path: FEATURE_ROUTES.orders, icon: LucidePackage },
  { label: 'Товари', path: FEATURE_ROUTES.products, icon: LucideTag },
  { label: 'Витрати', path: FEATURE_ROUTES.expenses, icon: LucideWallet },
  { label: 'Таблиця', path: FEATURE_ROUTES.crm, icon: LucideTable2 },
  { label: 'Дашборд', path: FEATURE_ROUTES.dashboard, icon: LucideLayoutDashboard },
  { label: 'Відправники', path: FEATURE_ROUTES.senders, icon: LucideUsers },
  { label: '2FA', path: AUTH_ROUTES.twoFa, icon: LucideShieldCheck },
];

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, LucideDynamicIcon, LucidePanelLeftClose, LucidePanelLeftOpen],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  protected readonly navItems = NAV_ITEMS;
  protected readonly layoutState = inject(LayoutStateService);
}
