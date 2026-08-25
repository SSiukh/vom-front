import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateFieldTriggerDirective } from './date-field-trigger.directive';

@Component({
  imports: [DateFieldTriggerDirective],
  template: `
    <div class="date-field__input" appDateFieldTrigger>
      <svg></svg>
      <input type="date" />
    </div>
  `,
})
class HostComponent {}

describe('DateFieldTriggerDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('opens the date picker when clicking the wrapper, not the input itself', () => {
    const input = el.querySelector('input') as HTMLInputElement;
    const showPicker = vi.fn();
    input.showPicker = showPicker;

    (el.querySelector('svg') as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(showPicker).toHaveBeenCalledOnce();
  });

  it('does not double-trigger when the click originates from the input itself', () => {
    const input = el.querySelector('input') as HTMLInputElement;
    const showPicker = vi.fn();
    input.showPicker = showPicker;

    input.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(showPicker).not.toHaveBeenCalled();
  });

  it('does nothing when showPicker is unsupported by the browser', () => {
    const input = el.querySelector('input') as HTMLInputElement;
    delete (input as { showPicker?: unknown }).showPicker;

    expect(() =>
      (el.querySelector('svg') as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true })),
    ).not.toThrow();
  });
});
