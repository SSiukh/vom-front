import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { Login } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let el: HTMLElement;
  let router: Router;

  const configure = (loginWithPassword: ReturnType<typeof vi.fn>) => {
    const authServiceStub = { loginWithPassword } as unknown as AuthService;

    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), { provide: AuthService, useValue: authServiceStub }],
    });
    fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  };

  const fillForm = (login: string, password: string) => {
    const loginInput = el.querySelector('#login') as HTMLInputElement;
    const passwordInput = el.querySelector('#password') as HTMLInputElement;
    loginInput.value = login;
    loginInput.dispatchEvent(new Event('input'));
    passwordInput.value = password;
    passwordInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('disables the submit button until both fields are filled', () => {
    configure(vi.fn());
    const submitButton = el.querySelector('.login-submit') as HTMLButtonElement;

    expect(submitButton.disabled).toBe(true);

    fillForm('admin', 'secret');

    expect(submitButton.disabled).toBe(false);
  });

  it('toggles the password field type and icon on eye-icon click', () => {
    configure(vi.fn());
    const passwordInput = el.querySelector('#password') as HTMLInputElement;
    const toggle = el.querySelector('.password-toggle') as HTMLButtonElement;

    expect(passwordInput.type).toBe('password');

    toggle.click();
    fixture.detectChanges();

    expect(passwordInput.type).toBe('text');

    toggle.click();
    fixture.detectChanges();

    expect(passwordInput.type).toBe('password');
  });

  it('submits the credentials and navigates to the 2FA page on success', () => {
    const loginWithPassword = vi.fn().mockReturnValue(of({ requiresTwoFa: false, accessToken: 'a', refreshToken: 'r' }));
    configure(loginWithPassword);
    fillForm('admin', 'secret');

    (el.querySelector('.login-submit') as HTMLButtonElement).click();

    expect(loginWithPassword).toHaveBeenCalledWith('admin', 'secret');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/2fa');
  });

  it('shows a specific message on invalid credentials (401)', () => {
    const loginWithPassword = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    configure(loginWithPassword);
    fillForm('admin', 'wrong');

    (el.querySelector('.login-submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Невірний логін або пароль');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('shows a rate-limit message on 429', () => {
    const loginWithPassword = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 })));
    configure(loginWithPassword);
    fillForm('admin', 'secret');

    (el.querySelector('.login-submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Забагато спроб входу — спробуйте пізніше');
  });

  it('re-enables the submit button after a failed attempt', () => {
    const loginWithPassword = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    configure(loginWithPassword);
    fillForm('admin', 'wrong');

    const submitButton = el.querySelector('.login-submit') as HTMLButtonElement;
    submitButton.click();
    fixture.detectChanges();

    expect(submitButton.disabled).toBe(false);
  });
});
