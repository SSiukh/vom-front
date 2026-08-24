import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideEye, LucideEyeOff } from '@lucide/angular';
import { AUTH_ROUTES } from '../../../../core/auth/auth-routes.constants';
import { AuthService } from '../../../../core/auth/auth.service';
import { Footer } from '../../../../core/layout/footer/footer';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, LucideEye, LucideEyeOff, Footer],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = this.fb.nonNullable.group({
    login: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.errorMessage.set(null);
    this.submitting.set(true);
    const { login, password } = this.form.getRawValue();

    this.authService
      .loginWithPassword(login, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.router.navigateByUrl(AUTH_ROUTES.twoFa);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        return 'Невірний логін або пароль';
      }
      if (error.status === 429) {
        return 'Забагато спроб входу — спробуйте пізніше';
      }
    }
    return 'Сталася помилка. Спробуйте ще раз';
  }
}
