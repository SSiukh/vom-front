import { TestBed } from '@angular/core/testing';
import { LayoutStateService, MOBILE_NAV_BREAKPOINT_PX } from './layout-state.service';

describe('LayoutStateService', () => {
  let service: LayoutStateService;
  let originalWidth: number;

  beforeEach(() => {
    originalWidth = window.innerWidth;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
  });

  const create = () => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LayoutStateService);
  };

  it('starts expanded on a desktop-width viewport', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    create();

    expect(service.sidebarCollapsed()).toBe(false);
  });

  it('starts collapsed on a phone-width viewport', () => {
    Object.defineProperty(window, 'innerWidth', { value: MOBILE_NAV_BREAKPOINT_PX - 1, configurable: true });
    create();

    expect(service.sidebarCollapsed()).toBe(true);
  });

  it('starts expanded exactly at the breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { value: MOBILE_NAV_BREAKPOINT_PX, configurable: true });
    create();

    expect(service.sidebarCollapsed()).toBe(false);
  });

  it('toggles between collapsed and expanded', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    create();

    service.toggleSidebar();
    expect(service.sidebarCollapsed()).toBe(true);

    service.toggleSidebar();
    expect(service.sidebarCollapsed()).toBe(false);
  });
});
