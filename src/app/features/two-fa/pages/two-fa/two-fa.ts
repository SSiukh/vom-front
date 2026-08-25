import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  QueryList,
  ViewChildren,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { LucideCopy } from '@lucide/angular';
import { AUTH_ROUTES } from '../../../../core/auth/auth-routes.constants';
import { AuthService } from '../../../../core/auth/auth.service';
import { Footer } from '../../../../core/layout/footer/footer';
import { Header } from '../../../../core/layout/header/header';
import { Sidebar } from '../../../../core/layout/sidebar/sidebar';

type TwoFaMode = 'setup' | 'verify';

@Component({
  selector: 'app-two-fa',
  imports: [LucideCopy, Footer, Header, Sidebar],
  templateUrl: './two-fa.html',
  styleUrl: './two-fa.css',
})
export class TwoFa {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChildren('digitCell') private digitCells!: QueryList<ElementRef<HTMLInputElement>>;

  protected readonly mode = computed<TwoFaMode | null>(() => {
    if (this.authService.isAuthenticated()) {
      return 'setup';
    }
    if (this.authService.hasPendingTwoFa()) {
      return 'verify';
    }
    return null;
  });

  protected readonly alreadyConfigured = computed(() => this.authService.twoFaEnabled() === true);

  protected readonly qrCodeDataUrl = signal<string | null>(null);
  protected readonly secret = signal<string | null>(null);
  protected readonly recoveryCodes = signal<string[] | null>(null);
  protected readonly digits = signal<string[]>(['', '', '', '', '', '']);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly code = computed(() => this.digits().join(''));
  protected readonly isCodeComplete = computed(() => this.code().length === 6);

  constructor() {
    const mode = this.mode();
    if (mode === null) {
      this.router.navigateByUrl(AUTH_ROUTES.login);
      return;
    }

    if (mode === 'setup') {
      const knownStatus = this.authService.twoFaEnabled();
      if (knownStatus === null) {
        this.authService
          .ensureTwoFaStatus()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (enabled) => {
              if (!enabled) {
                this.loadSetup();
              }
            },
            error: () => {
              this.errorMessage.set('Не вдалося перевірити статус 2FA');
            },
          });
      } else if (!knownStatus) {
        this.loadSetup();
      }
    }
  }

  onDigitInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(-1);
    input.value = value;

    this.digits.update((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });

    if (value && index < 5) {
      this.digitCells.get(index + 1)?.nativeElement.focus();
    }
  }

  onDigitKeydown(event: KeyboardEvent, index: number): void {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Backspace' && !input.value && index > 0) {
      this.digitCells.get(index - 1)?.nativeElement.focus();
    }
  }

  confirmSetup(): void {
    if (!this.isCodeComplete() || this.submitting()) {
      return;
    }
    this.errorMessage.set(null);
    this.submitting.set(true);

    this.authService
      .confirmTwoFactor(this.code())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          this.recoveryCodes.set(response.recoveryCodes);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(this.resolveConfirmError(error));
        },
      });
  }

  verify(): void {
    if (!this.isCodeComplete() || this.submitting()) {
      return;
    }
    this.errorMessage.set(null);
    this.submitting.set(true);

    this.authService
      .verifyTwoFactor(this.code())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.router.navigateByUrl('/');
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(this.resolveVerifyError(error));
        },
      });
  }

  continueToApp(): void {
    this.router.navigateByUrl('/');
  }

  copySecret(): void {
    const secret = this.secret();
    if (secret) {
      void navigator.clipboard.writeText(secret);
    }
  }

  copyRecoveryCodes(): void {
    const codes = this.recoveryCodes();
    if (codes) {
      void navigator.clipboard.writeText(codes.join('\n'));
    }
  }

  private loadSetup(): void {
    this.authService
      .setupTwoFactor()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.qrCodeDataUrl.set(response.qrCodeDataUrl);
          this.secret.set(response.secret);
        },
        error: () => {
          this.errorMessage.set('Не вдалося завантажити дані для налаштування 2FA');
        },
      });
  }

  private resolveConfirmError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 400) {
      return 'Невірний код підтвердження';
    }
    return 'Сталася помилка. Спробуйте ще раз';
  }

  private resolveVerifyError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      return 'Невірний код';
    }
    if (error instanceof HttpErrorResponse && error.status === 429) {
      return 'Забагато спроб — спробуйте пізніше';
    }
    return 'Сталася помилка. Спробуйте ще раз';
  }
}
