import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideSearch } from '@lucide/angular';
import { EMPTY, Subject, map, switchMap, timer } from 'rxjs';

const SEARCH_DEBOUNCE_MS = 350;

@Component({
  selector: 'app-search-input',
  imports: [LucideSearch],
  templateUrl: './search-input.html',
  styleUrl: './search-input.css',
})
export class SearchInput {
  readonly placeholder = input.required<string>();
  readonly maxLength = input(100);
  readonly searchChange = output<string>();

  protected readonly text = signal('');

  private readonly typed = new Subject<string | null>();

  constructor() {
    this.typed
      .pipe(
        switchMap((value) => (value === null ? EMPTY : timer(SEARCH_DEBOUNCE_MS).pipe(map(() => value)))),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((value) => this.searchChange.emit(value.trim()));
  }

  clear(): void {
    this.typed.next(null);
    this.text.set('');
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.text.set(value);
    this.typed.next(value);
  }
}
