import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ACCESS_TOKEN_KEY, AuthService, LOGIN_KEY, REFRESH_TOKEN_KEY } from '../../../../core/auth/auth.service';
import { TwoFa } from './two-fa';

interface AuthServiceStubOverrides {
  isAuthenticated?: () => boolean;
  hasPendingTwoFa?: () => boolean;
  twoFaEnabled?: () => boolean | null;
  login?: () => string | null;
  logout?: ReturnType<typeof vi.fn>;
  ensureTwoFaStatus?: ReturnType<typeof vi.fn>;
  setupTwoFactor?: ReturnType<typeof vi.fn>;
  confirmTwoFactor?: ReturnType<typeof vi.fn>;
  verifyTwoFactor?: ReturnType<typeof vi.fn>;
}

describe('TwoFa', () => {
  let fixture: ComponentFixture<TwoFa>;
  let el: HTMLElement;
  let router: Router;

  const buildAuthServiceStub = (overrides: AuthServiceStubOverrides = {}) =>
    ({
      isAuthenticated: () => false,
      hasPendingTwoFa: () => false,
      twoFaEnabled: () => null,
      login: () => null,
      logout: vi.fn(),
      ensureTwoFaStatus: vi.fn().mockReturnValue(of(false)),
      setupTwoFactor: vi.fn().mockReturnValue(of({ qrCodeDataUrl: 'data:image/png;base64,x', secret: 'SECRET-KEY' })),
      confirmTwoFactor: vi.fn(),
      verifyTwoFactor: vi.fn(),
      ...overrides,
    }) as unknown as AuthService;

  const configure = (authService: AuthService) => {
    TestBed.configureTestingModule({
      imports: [TwoFa],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(TwoFa);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  const fillCode = (code: string) => {
    const cells = Array.from(el.querySelectorAll('.code-cell')) as HTMLInputElement[];
    code.split('').forEach((digit, i) => {
      cells[i].value = digit;
      cells[i].dispatchEvent(new Event('input'));
    });
    fixture.detectChanges();
  };

  it('redirects to login when neither authenticated nor a 2FA challenge is pending', () => {
    configure(buildAuthServiceStub());

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  describe('verify mode (requiresTwoFa: true, not yet authenticated)', () => {
    it('renders only the code input, no QR/secret/recovery codes', () => {
      configure(buildAuthServiceStub({ hasPendingTwoFa: () => true }));

      expect(el.querySelector('.qr-placeholder')).toBeNull();
      expect(el.querySelector('.secret-row')).toBeNull();
      expect(el.querySelectorAll('.code-cell').length).toBe(6);
    });

    it('submits the joined code and navigates into the app on success', () => {
      const verifyTwoFactor = vi.fn().mockReturnValue(of({ accessToken: 'a', refreshToken: 'r' }));
      configure(buildAuthServiceStub({ hasPendingTwoFa: () => true, verifyTwoFactor }));

      fillCode('123456');
      (el.querySelector('.confirm-button') as HTMLButtonElement).click();

      expect(verifyTwoFactor).toHaveBeenCalledWith('123456');
      expect(router.navigateByUrl).toHaveBeenCalledWith('/');
    });

    it('shows an error message on an invalid code (401)', () => {
      const verifyTwoFactor = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
      configure(buildAuthServiceStub({ hasPendingTwoFa: () => true, verifyTwoFactor }));

      fillCode('000000');
      (el.querySelector('.confirm-button') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Невірний код');
    });

    it('keeps the confirm button disabled until all 6 digits are entered', () => {
      configure(buildAuthServiceStub({ hasPendingTwoFa: () => true }));
      const button = el.querySelector('.confirm-button') as HTMLButtonElement;

      expect(button.disabled).toBe(true);

      fillCode('12345');
      expect(button.disabled).toBe(true);

      fillCode('123456');
      expect(button.disabled).toBe(false);
    });

    it('auto-advances focus to the next cell as digits are entered', () => {
      configure(buildAuthServiceStub({ hasPendingTwoFa: () => true }));
      const cells = Array.from(el.querySelectorAll('.code-cell')) as HTMLInputElement[];

      cells[0].value = '1';
      cells[0].dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(document.activeElement).toBe(cells[1]);
    });
  });

  describe('setup mode, not yet configured', () => {
    it('fetches status, then loads the QR/secret when not configured', () => {
      const ensureTwoFaStatus = vi.fn().mockReturnValue(of(false));
      const setupTwoFactor = vi
        .fn()
        .mockReturnValue(of({ qrCodeDataUrl: 'data:image/png;base64,x', secret: 'SECRET-KEY' }));
      configure(
        buildAuthServiceStub({ isAuthenticated: () => true, ensureTwoFaStatus, setupTwoFactor }),
      );

      expect(setupTwoFactor).toHaveBeenCalledOnce();
      expect(el.querySelector('.secret-value')?.textContent?.trim()).toBe('SECRET-KEY');
      expect((el.querySelector('.qr-placeholder img') as HTMLImageElement)?.src).toContain(
        'data:image/png;base64,x',
      );
      expect(el.querySelector('.status-badge--warning')?.textContent?.trim()).toBe('Не налаштовано');
    });

    it('shows the recovery codes after a successful confirm', () => {
      const confirmTwoFactor = vi.fn().mockReturnValue(of({ recoveryCodes: ['aaaa-1111', 'bbbb-2222'] }));
      configure(buildAuthServiceStub({ isAuthenticated: () => true, confirmTwoFactor }));

      fillCode('123456');
      (el.querySelector('.confirm-button') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(confirmTwoFactor).toHaveBeenCalledWith('123456');
      const codes = Array.from(el.querySelectorAll('.recovery-code')).map((n) => n.textContent?.trim());
      expect(codes).toEqual(['aaaa-1111', 'bbbb-2222']);
      expect(el.querySelector('.code-cells')).toBeNull();
    });

    it('shows an error on an invalid confirmation code (400)', () => {
      const confirmTwoFactor = vi
        .fn()
        .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
      configure(buildAuthServiceStub({ isAuthenticated: () => true, confirmTwoFactor }));

      fillCode('000000');
      (el.querySelector('.confirm-button') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Невірний код підтвердження');
    });

    it('keeps the confirm button disabled if setupTwoFactor fails to load', () => {
      const setupTwoFactor = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      configure(buildAuthServiceStub({ isAuthenticated: () => true, setupTwoFactor }));

      fillCode('123456');

      expect((el.querySelector('.confirm-button') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('setup mode, regression: recovery codes must survive twoFaEnabled flipping (real AuthService)', () => {
    const baseUrl = `${environment.apiUrl}/auth`;
    let httpMock: HttpTestingController;

    beforeEach(() => {
      localStorage.clear();
      localStorage.setItem(ACCESS_TOKEN_KEY, 'a');
      localStorage.setItem(REFRESH_TOKEN_KEY, 'r');
      localStorage.setItem(LOGIN_KEY, 'admin');
    });

    afterEach(() => {
      httpMock.verify();
      localStorage.clear();
    });

    it('renders the recovery codes screen, not "already configured", right after confirm succeeds', () => {
      TestBed.configureTestingModule({
        imports: [TwoFa],
        providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      });
      httpMock = TestBed.inject(HttpTestingController);
      router = TestBed.inject(Router);
      vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      fixture = TestBed.createComponent(TwoFa);
      fixture.detectChanges();
      el = fixture.nativeElement as HTMLElement;

      httpMock.expectOne(`${baseUrl}/2fa/status`).flush({ twoFaEnabled: false });
      httpMock
        .expectOne(`${baseUrl}/2fa/setup`)
        .flush({ qrCodeDataUrl: 'data:image/png;base64,x', secret: 'SECRET-KEY' });
      fixture.detectChanges();

      fillCode('123456');
      (el.querySelector('.confirm-button') as HTMLButtonElement).click();
      httpMock.expectOne(`${baseUrl}/2fa/confirm`).flush({ recoveryCodes: ['aaaa-1111', 'bbbb-2222'] });
      fixture.detectChanges();

      const codes = Array.from(el.querySelectorAll('.recovery-code')).map((n) => n.textContent?.trim());
      expect(codes).toEqual(['aaaa-1111', 'bbbb-2222']);
      expect(el.querySelector('.status-badge--success')).toBeNull();
    });
  });

  describe('setup mode, already configured', () => {
    it('skips both the status re-fetch and setup data fetch when status is already known', () => {
      const setupTwoFactor = vi.fn();
      const ensureTwoFaStatus = vi.fn().mockReturnValue(of(true));
      configure(
        buildAuthServiceStub({
          isAuthenticated: () => true,
          twoFaEnabled: () => true,
          ensureTwoFaStatus,
          setupTwoFactor,
        }),
      );

      expect(ensureTwoFaStatus).not.toHaveBeenCalled();
      expect(setupTwoFactor).not.toHaveBeenCalled();
      expect(el.querySelector('.status-badge--success')?.textContent?.trim()).toBe('Налаштовано');
      expect(el.querySelector('.code-cells')).toBeNull();
    });

    it('navigates into the app on "Продовжити"', () => {
      configure(
        buildAuthServiceStub({
          isAuthenticated: () => true,
          twoFaEnabled: () => true,
          ensureTwoFaStatus: vi.fn().mockReturnValue(of(true)),
        }),
      );

      (el.querySelector('.btn-primary') as HTMLButtonElement).click();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/');
    });
  });

  it('calls AuthService.logout() when the header logout button is clicked (setup mode)', () => {
    const logout = vi.fn();
    configure(buildAuthServiceStub({ isAuthenticated: () => true, login: () => 'admin', logout }));

    (el.querySelector('.logout') as HTMLButtonElement).click();

    expect(logout).toHaveBeenCalledOnce();
  });
});
