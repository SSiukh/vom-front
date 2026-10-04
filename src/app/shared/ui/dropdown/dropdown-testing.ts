import type { ComponentFixture } from '@angular/core/testing';

function dropdownHost(fixture: ComponentFixture<unknown>, triggerId: string): HTMLElement {
  const root = fixture.nativeElement as HTMLElement;
  return (root.querySelector(`#${triggerId}`) as HTMLElement).closest('app-dropdown') as HTMLElement;
}

function openDropdown(fixture: ComponentFixture<unknown>, triggerId: string): HTMLElement {
  const host = dropdownHost(fixture, triggerId);
  const trigger = host.querySelector('.dropdown__trigger') as HTMLButtonElement;
  if (trigger.getAttribute('aria-expanded') !== 'true') {
    trigger.click();
    fixture.detectChanges();
  }
  return host;
}

function closeDropdown(fixture: ComponentFixture<unknown>, triggerId: string): void {
  const host = dropdownHost(fixture, triggerId);
  (host.querySelector('.dropdown__trigger') as HTMLButtonElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  fixture.detectChanges();
}

export function pickDropdown(fixture: ComponentFixture<unknown>, triggerId: string, value: string): void {
  const host = openDropdown(fixture, triggerId);
  (host.querySelector(`[role="option"][data-value="${value}"]`) as HTMLElement).click();
  fixture.detectChanges();
}

export function dropdownValue(fixture: ComponentFixture<unknown>, triggerId: string): string | null {
  return dropdownHost(fixture, triggerId).querySelector('.dropdown__trigger')?.getAttribute('data-value') ?? null;
}

export function dropdownLabels(fixture: ComponentFixture<unknown>, triggerId: string): string[] {
  const host = openDropdown(fixture, triggerId);
  const labels = Array.from(host.querySelectorAll('[role="option"]')).map((option) => option.textContent?.trim() ?? '');
  closeDropdown(fixture, triggerId);
  return labels;
}

export function dropdownGroups(fixture: ComponentFixture<unknown>, triggerId: string): string[] {
  const host = openDropdown(fixture, triggerId);
  const groups = Array.from(host.querySelectorAll('.dropdown__group')).map((group) => group.textContent?.trim() ?? '');
  closeDropdown(fixture, triggerId);
  return groups;
}

export function dropdownOptionValues(fixture: ComponentFixture<unknown>, triggerId: string): string[] {
  const host = openDropdown(fixture, triggerId);
  const values = Array.from(host.querySelectorAll('[role="option"]')).map((option) => option.getAttribute('data-value') ?? '');
  closeDropdown(fixture, triggerId);
  return values;
}
