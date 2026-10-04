import { Component, ElementRef, computed, forwardRef, inject, input, model, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideChevronDown } from '@lucide/angular';
import { shouldOpenUpward } from '../../utils/popup-placement';

export interface DropdownOption {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
}

type DropdownRow =
  | { kind: 'group'; label: string }
  | { kind: 'option'; option: DropdownOption; selectableIndex: number };

const PANEL_MAX_HEIGHT = 260;
const PANEL_GAP = 4;

let nextInstanceId = 0;

@Component({
  selector: 'app-dropdown',
  imports: [LucideChevronDown],
  templateUrl: './dropdown.html',
  styleUrl: './dropdown.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Dropdown), multi: true }],
  host: {
    class: 'dropdown',
    '[class.dropdown--sm]': "size() === 'sm'",
  },
})
export class Dropdown implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly instanceId = `dropdown-${nextInstanceId++}`;

  readonly options = input.required<DropdownOption[]>();
  readonly value = model<string>('');
  readonly triggerId = input<string>(this.instanceId);
  readonly placeholder = input('');
  readonly ariaLabel = input('');
  readonly size = input<'md' | 'sm'>('md');

  protected readonly isOpen = signal(false);
  protected readonly openUpward = signal(false);
  protected readonly highlightedIndex = signal(-1);
  protected readonly isDisabled = signal(false);
  protected readonly listboxId = `${this.instanceId}-listbox`;
  protected readonly activeOptionId = computed(() =>
    this.isOpen() && this.highlightedIndex() >= 0 ? this.optionId(this.highlightedIndex()) : null,
  );

  protected readonly selectedLabel = computed(
    () => this.options().find((option) => option.value === this.value())?.label ?? this.placeholder(),
  );

  private readonly selectableOptions = computed(() => this.options().filter((option) => !option.disabled));

  protected readonly rows = computed<DropdownRow[]>(() => {
    const result: DropdownRow[] = [];
    let currentGroup: string | undefined;
    let selectableIndex = 0;
    for (const option of this.options()) {
      if (option.group !== undefined && option.group !== currentGroup) {
        currentGroup = option.group;
        result.push({ kind: 'group', label: option.group });
      }
      if (option.disabled) {
        result.push({ kind: 'option', option, selectableIndex: -1 });
      } else {
        result.push({ kind: 'option', option, selectableIndex: selectableIndex++ });
      }
    }
    return result;
  });

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

  protected optionId(selectableIndex: number): string {
    return `${this.instanceId}-option-${selectableIndex}`;
  }

  protected toggle(): void {
    if (this.isDisabled()) {
      return;
    }
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  protected open(): void {
    if (this.isDisabled()) {
      return;
    }
    const selected = this.selectableOptions().findIndex((option) => option.value === this.value());
    this.highlightedIndex.set(selected);
    this.openUpward.set(shouldOpenUpward(this.host.nativeElement, PANEL_MAX_HEIGHT + PANEL_GAP));
    this.isOpen.set(true);
  }

  protected close(): void {
    this.isOpen.set(false);
    this.highlightedIndex.set(-1);
  }

  protected choose(option: DropdownOption): void {
    if (option.disabled) {
      return;
    }
    this.value.set(option.value);
    this.onChange(option.value);
    this.onTouched();
    this.close();
    this.host.nativeElement.querySelector<HTMLButtonElement>('.dropdown__trigger')?.focus();
  }

  protected onBlur(): void {
    this.onTouched();
    this.close();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.selectableOptions().length;
    if (event.key === 'Escape') {
      this.close();
      return;
    }
    if (event.key === 'Tab') {
      this.close();
      return;
    }
    if (!this.isOpen()) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        this.open();
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedIndex.update((index) => Math.min(index + 1, count - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedIndex.update((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.highlightedIndex.set(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.highlightedIndex.set(count - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = this.selectableOptions()[this.highlightedIndex()];
      if (option) {
        this.choose(option);
      }
    }
  }
}

export function dictionaryOptions(items: readonly { id: string; label: string }[]): DropdownOption[] {
  return items.map((item) => ({ value: item.id, label: item.label }));
}
