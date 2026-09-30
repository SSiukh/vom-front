import { Injectable, signal } from '@angular/core';

export const MOBILE_NAV_BREAKPOINT_PX = 500;

@Injectable({ providedIn: 'root' })
export class LayoutStateService {
  private readonly sidebarCollapsedSignal = signal(isNarrowViewport());
  readonly sidebarCollapsed = this.sidebarCollapsedSignal.asReadonly();

  toggleSidebar(): void {
    this.sidebarCollapsedSignal.update((value) => !value);
  }
}

function isNarrowViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < MOBILE_NAV_BREAKPOINT_PX;
}
