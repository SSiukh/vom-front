import type { ComponentFixture } from '@angular/core/testing';

const MAX_MONTH_STEPS = 240;

function pickerHost(fixture: ComponentFixture<unknown>, triggerId: string): HTMLElement {
  const root = fixture.nativeElement as HTMLElement;
  return (root.querySelector(`#${triggerId}`) as HTMLElement).closest('app-date-picker') as HTMLElement;
}

export function pickDate(fixture: ComponentFixture<unknown>, triggerId: string, iso: string): void {
  const host = pickerHost(fixture, triggerId);
  const trigger = host.querySelector('.date-picker__trigger') as HTMLButtonElement;
  if (trigger.getAttribute('aria-expanded') !== 'true') {
    trigger.click();
    fixture.detectChanges();
  }
  const target = iso.slice(0, 7);
  for (let step = 0; step < MAX_MONTH_STEPS; step++) {
    const shown = host.querySelector('[data-month]')?.getAttribute('data-month');
    if (!shown || shown === target) {
      break;
    }
    const label = shown < target ? 'Наступний місяць' : 'Попередній місяць';
    (host.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement).click();
    fixture.detectChanges();
  }
  (host.querySelector(`[data-date="${iso}"]`) as HTMLButtonElement).click();
  fixture.detectChanges();
}

export function dateValue(fixture: ComponentFixture<unknown>, triggerId: string): string | null {
  return pickerHost(fixture, triggerId).querySelector('.date-picker__trigger')?.getAttribute('data-value') ?? null;
}
