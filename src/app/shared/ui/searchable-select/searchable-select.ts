import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { LucideSearch } from '@lucide/angular';

export interface SelectOption {
  value: string;
  label: string;
}

const SEARCH_DEBOUNCE_MS = 300;
const BLUR_CLOSE_DELAY_MS = 150;

let nextInstanceId = 0;

@Component({
  selector: 'app-searchable-select',
  imports: [LucideSearch],
  templateUrl: './searchable-select.html',
  styleUrl: './searchable-select.css',
})
export class SearchableSelect {
  private readonly destroyRef = inject(DestroyRef);

  readonly options = input.required<SelectOption[]>();
  readonly selectedLabel = input<string | null>(null);
  readonly placeholder = input('Пошук…');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly emptyMessage = input('Нічого не знайдено');

  readonly searchTermChange = output<string>();
  readonly valueChange = output<SelectOption>();

  protected readonly isOpen = signal(false);
  protected readonly searchText = signal('');
  protected readonly highlightedIndex = signal(-1);

  protected readonly displayValue = computed(() => (this.isOpen() ? this.searchText() : (this.selectedLabel() ?? '')));

  protected readonly instanceId = `searchable-select-${nextInstanceId++}`;
  protected readonly listboxId = `${this.instanceId}-listbox`;

  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private blurTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.debounceTimer);
      clearTimeout(this.blurTimer);
    });
  }

  open(): void {
    if (this.disabled()) {
      return;
    }
    clearTimeout(this.blurTimer);
    this.isOpen.set(true);
    this.searchText.set('');
    this.highlightedIndex.set(-1);
    this.searchTermChange.emit('');
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchText.set(value);
    this.highlightedIndex.set(-1);
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.searchTermChange.emit(value), SEARCH_DEBOUNCE_MS);
  }

  select(option: SelectOption): void {
    this.isOpen.set(false);
    this.valueChange.emit(option);
  }

  onBlur(): void {
    this.blurTimer = setTimeout(() => this.isOpen.set(false), BLUR_CLOSE_DELAY_MS);
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) {
      return;
    }
    const optionsLength = this.options().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (optionsLength > 0) {
        this.highlightedIndex.update((index) => (index + 1) % optionsLength);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (optionsLength > 0) {
        this.highlightedIndex.update((index) => (index <= 0 ? optionsLength - 1 : index - 1));
      }
    } else if (event.key === 'Enter') {
      const index = this.highlightedIndex();
      if (index >= 0 && index < optionsLength) {
        event.preventDefault();
        this.select(this.options()[index]);
      }
    } else if (event.key === 'Escape') {
      this.isOpen.set(false);
    }
  }

  optionId(index: number): string {
    return `${this.instanceId}-option-${index}`;
  }
}
