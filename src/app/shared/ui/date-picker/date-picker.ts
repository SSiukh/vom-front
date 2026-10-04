import { Component, ElementRef, computed, forwardRef, inject, input, model, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideCalendar, LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { shouldOpenUpward } from '../../utils/popup-placement';
import {
  MONTH_LABELS,
  WEEKDAY_LABELS,
  buildWeeks,
  formatDisplayDate,
  parseIsoDate,
  toIsoDate,
} from './date-picker.utils';

interface MonthView {
  year: number;
  month: number;
}

const PANEL_HEIGHT = 320;

let nextInstanceId = 0;

@Component({
  selector: 'app-date-picker',
  imports: [LucideCalendar, LucideChevronLeft, LucideChevronRight],
  templateUrl: './date-picker.html',
  styleUrl: './date-picker.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatePicker), multi: true }],
  host: {
    class: 'date-picker',
    '(focusout)': 'onFocusOut($event)',
    '(keydown.escape)': 'onEscape()',
  },
})
export class DatePicker implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly instanceId = `date-picker-${nextInstanceId++}`;

  readonly value = model<string>('');
  readonly triggerId = input<string>(this.instanceId);
  readonly ariaLabel = input('');

  protected readonly isOpen = signal(false);
  protected readonly openUpward = signal(false);
  protected readonly isDisabled = signal(false);
  protected readonly view = signal<MonthView>(this.viewOf(new Date()));
  protected readonly todayIso = toIsoDate(new Date());
  protected readonly weekdays = WEEKDAY_LABELS;
  protected readonly displayValue = computed(() => formatDisplayDate(this.value()));
  protected readonly monthKey = computed(() => {
    const { year, month } = this.view();
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  });
  protected readonly monthLabel = computed(() => `${MONTH_LABELS[this.view().month]} ${this.view().year}`);
  protected readonly weeks = computed(() => buildWeeks(this.view().year, this.view().month));

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  protected toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  protected shiftMonth(delta: number): void {
    const { year, month } = this.view();
    this.view.set(this.viewOf(new Date(year, month + delta, 1)));
  }

  protected select(iso: string): void {
    this.value.set(iso);
    this.onChange(iso);
    this.onTouched();
    this.close();
    this.host.nativeElement.querySelector<HTMLButtonElement>('.date-picker__trigger')?.focus();
  }

  protected onEscape(): void {
    if (this.isOpen()) {
      this.close();
      this.host.nativeElement.querySelector<HTMLButtonElement>('.date-picker__trigger')?.focus();
    }
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && this.host.nativeElement.contains(next)) {
      return;
    }
    this.onTouched();
    this.close();
  }

  private open(): void {
    if (this.isDisabled()) {
      return;
    }
    const selected = parseIsoDate(this.value());
    this.view.set(this.viewOf(selected ?? new Date()));
    this.openUpward.set(shouldOpenUpward(this.host.nativeElement, PANEL_HEIGHT));
    this.isOpen.set(true);
  }

  private close(): void {
    this.isOpen.set(false);
  }

  private viewOf(date: Date): MonthView {
    return { year: date.getFullYear(), month: date.getMonth() };
  }
}
