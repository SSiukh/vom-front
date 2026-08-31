import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { LucideCheck, LucideCopy } from '@lucide/angular';

const COPIED_FEEDBACK_MS = 1500;

@Component({
  selector: 'app-copyable-text',
  imports: [LucideCopy, LucideCheck],
  templateUrl: './copyable-text.html',
})
export class CopyableText {
  readonly value = input.required<string>();

  protected readonly copied = signal(false);

  private resetTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearResetTimeout());
  }

  copy(event: Event): void {
    event.stopPropagation();
    const value = this.value();
    void navigator.clipboard.writeText(value).then(() => {
      this.copied.set(true);
      this.clearResetTimeout();
      this.resetTimeoutId = setTimeout(() => {
        this.copied.set(false);
        this.resetTimeoutId = null;
      }, COPIED_FEEDBACK_MS);
    });
  }

  private clearResetTimeout(): void {
    if (this.resetTimeoutId !== null) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
  }
}
