import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../auth/auth.service';
import { LayoutStateService } from '../layout-state.service';
import { Header } from './header';

describe('Header', () => {
  let fixture: ComponentFixture<Header>;

  const buildAuthServiceStub = (isAuthenticated: boolean, login: string | null) =>
    ({
      isAuthenticated: () => isAuthenticated,
      login: () => login,
      logout: vi.fn(),
    }) as unknown as AuthService;

  const configure = (authService: AuthService) => {
    TestBed.configureTestingModule({
      imports: [Header],
      providers: [{ provide: AuthService, useValue: authService }],
    });
    fixture = TestBed.createComponent(Header);
    fixture.detectChanges();
  };

  it('does not render the login/logout controls when unauthenticated', () => {
    configure(buildAuthServiceStub(false, null));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.account')).toBeNull();
  });

  it('renders the login and a logout control when authenticated', () => {
    configure(buildAuthServiceStub(true, 'admin'));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.login')?.textContent?.trim()).toBe('admin');
    expect(el.querySelector('.logout')).not.toBeNull();
  });

  it('calls AuthService.logout() when the logout button is clicked', () => {
    const authService = buildAuthServiceStub(true, 'admin');
    configure(authService);
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelector('.logout') as HTMLButtonElement).click();

    expect(authService.logout).toHaveBeenCalledOnce();
  });

  it('shows the wordmark only when the sidebar is collapsed', () => {
    configure(buildAuthServiceStub(false, null));
    const el = fixture.nativeElement as HTMLElement;
    const layoutState = TestBed.inject(LayoutStateService);

    expect(el.querySelector('.wordmark')).toBeNull();

    layoutState.toggleSidebar();
    fixture.detectChanges();

    expect(el.querySelector('.wordmark')?.textContent?.trim()).toBe('VOM');
  });
});
