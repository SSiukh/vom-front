import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

const FALLBACK_COLOR = '#000000';
const FULL_HEX = /^#?([0-9a-f]{6})$/i;
const SHORT_HEX = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;

export function parseHexColor(text: string, allowShort: boolean): string | null {
  const trimmed = text.trim();
  const full = FULL_HEX.exec(trimmed);
  if (full) {
    return `#${full[1]?.toLowerCase()}`;
  }
  const short = allowShort ? SHORT_HEX.exec(trimmed) : null;
  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  }
  return null;
}

@Component({
  selector: 'app-color-field',
  templateUrl: './color-field.html',
  styleUrl: './color-field.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ColorField), multi: true }],
})
export class ColorField implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly inputId = input.required<string>();

  protected readonly value = signal(FALLBACK_COLOR);
  protected readonly draft = signal<string | null>(null);
  protected readonly disabled = signal(false);
  protected readonly hexText = computed(() => this.draft() ?? this.value());
  protected readonly invalid = computed(() => {
    const draft = this.draft();
    return draft !== null && parseHexColor(draft, true) === null;
  });

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(parseHexColor(value ?? '', false) ?? FALLBACK_COLOR);
    this.draft.set(null);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected pick(event: Event): void {
    const color = parseHexColor((event.target as HTMLInputElement).value, false);
    if (color) {
      this.commit(color);
    }
  }

  protected typeHex(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    const color = parseHexColor(text, false);
    if (color) {
      this.commit(color);
    } else {
      this.draft.set(text);
    }
  }

  protected finishHex(event: Event): void {
    const color = parseHexColor((event.target as HTMLInputElement).value, true);
    if (color) {
      this.commit(color);
    } else {
      this.draft.set(null);
    }
    (event.target as HTMLInputElement).value = this.value();
    this.onTouched();
  }

  protected touch(): void {
    this.onTouched();
  }

  private commit(color: string): void {
    this.draft.set(null);
    this.value.set(color);
    this.onChange(color);
  }
}
