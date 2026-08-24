import { Component, input, output } from '@angular/core';
import { LucideTriangleAlert } from '@lucide/angular';

@Component({
  selector: 'app-confirm-dialog',
  imports: [LucideTriangleAlert],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialog {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Підтвердити');
  readonly cancelLabel = input('Скасувати');
  readonly confirmDisabled = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
