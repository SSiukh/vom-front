import { Directive, ElementRef, inject } from '@angular/core';

@Directive({
  selector: '[appDateFieldTrigger]',
  host: {
    '(click)': 'onClick($event)',
  },
})
export class DateFieldTriggerDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  onClick(event: MouseEvent): void {
    const input = this.elementRef.nativeElement.querySelector('input[type="date"]') as HTMLInputElement | null;
    if (input && event.target !== input) {
      input.showPicker?.();
    }
  }
}
