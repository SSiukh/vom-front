import { TestBed } from '@angular/core/testing';
import { LayoutStateService } from './layout-state.service';

describe('LayoutStateService', () => {
  let service: LayoutStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LayoutStateService);
  });

  it('starts expanded', () => {
    expect(service.sidebarCollapsed()).toBe(false);
  });

  it('toggles between collapsed and expanded', () => {
    service.toggleSidebar();
    expect(service.sidebarCollapsed()).toBe(true);

    service.toggleSidebar();
    expect(service.sidebarCollapsed()).toBe(false);
  });
});
