import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutStateService {
  private readonly sidebarCollapsedSignal = signal(false);
  readonly sidebarCollapsed = this.sidebarCollapsedSignal.asReadonly();

  toggleSidebar(): void {
    this.sidebarCollapsedSignal.update((value) => !value);
  }
}
