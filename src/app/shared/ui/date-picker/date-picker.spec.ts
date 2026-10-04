import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DatePicker } from './date-picker';
import { dateValue, pickDate } from './date-picker-testing';

@Component({
  imports: [DatePicker, ReactiveFormsModule],
  template: `<app-date-picker triggerId="from" [formControl]="control" />`,
})
class Host {
  readonly control = new FormControl('2026-08-22', { nonNullable: true });
}

describe('DatePicker', () => {
  let fixture: ComponentFixture<Host>;
  let el: HTMLElement;

  const trigger = () => el.querySelector('.date-picker__trigger') as HTMLButtonElement;
  const panel = () => el.querySelector('.date-picker__panel') as HTMLElement | null;
  const settle = () => {
    fixture.detectChanges();
    return fixture.whenStable();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    await settle();
    el = fixture.nativeElement as HTMLElement;
  });

  it('shows the selected date as dd.mm.yyyy', () => {
    expect(trigger().textContent?.trim()).toBe('22.08.2026');
  });

  it('shows the placeholder when there is no value', async () => {
    fixture.componentInstance.control.setValue('');
    await settle();

    expect(trigger().textContent?.trim()).toBe('дд.мм.рррр');
  });

  it('opens the calendar on the month of the selected date and marks that day', async () => {
    trigger().click();
    await settle();

    expect(panel()).not.toBeNull();
    expect(el.querySelector('[data-month]')?.getAttribute('data-month')).toBe('2026-08');
    expect(el.querySelector('.date-picker__day--selected')?.textContent?.trim()).toBe('22');
  });

  it('writes the chosen ISO date to the form control, emits it and closes', async () => {
    pickDate(fixture, 'from', '2026-08-05');
    await settle();

    expect(fixture.componentInstance.control.value).toBe('2026-08-05');
    expect(fixture.componentInstance.control.touched).toBe(true);
    expect(panel()).toBeNull();
    expect(dateValue(fixture, 'from')).toBe('2026-08-05');
  });

  it('moves between months with the navigation buttons', async () => {
    trigger().click();
    await settle();

    (el.querySelector('[aria-label="Наступний місяць"]') as HTMLButtonElement).click();
    await settle();

    expect(el.querySelector('[data-month]')?.getAttribute('data-month')).toBe('2026-09');
    expect(el.querySelector('.date-picker__month')?.textContent?.trim()).toBe('Вересень 2026');
  });

  it('clears the value from the footer button', async () => {
    trigger().click();
    await settle();

    (el.querySelector('.date-picker__clear') as HTMLButtonElement).click();
    await settle();

    expect(fixture.componentInstance.control.value).toBe('');
    expect(trigger().textContent?.trim()).toBe('дд.мм.рррр');
  });

  it('closes on Escape without changing the value', async () => {
    trigger().click();
    await settle();

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();

    expect(panel()).toBeNull();
    expect(fixture.componentInstance.control.value).toBe('2026-08-22');
  });

  it('closes when focus leaves the picker', async () => {
    trigger().click();
    await settle();

    trigger().dispatchEvent(new FocusEvent('focusout', { relatedTarget: document.body, bubbles: true }));
    await settle();

    expect(panel()).toBeNull();
    expect(fixture.componentInstance.control.touched).toBe(true);
  });

  it('stays open while focus moves inside the picker', async () => {
    trigger().click();
    await settle();

    const nav = el.querySelector('[aria-label="Наступний місяць"]') as HTMLButtonElement;
    trigger().dispatchEvent(new FocusEvent('focusout', { relatedTarget: nav, bubbles: true }));
    await settle();

    expect(panel()).not.toBeNull();
  });

  it('cannot be opened while the form control is disabled', async () => {
    fixture.componentInstance.control.disable();
    await settle();

    expect(trigger().disabled).toBe(true);
    trigger().click();
    await settle();

    expect(panel()).toBeNull();
  });
  it('opens upward when there is no room below the trigger', async () => {
    vi.spyOn(el.querySelector('app-date-picker') as HTMLElement, 'getBoundingClientRect').mockReturnValue({
      top: 700,
      bottom: 720,
    } as DOMRect);
    trigger().click();
    await settle();

    expect(panel()?.classList.contains('date-picker__panel--up')).toBe(true);
  });

});
