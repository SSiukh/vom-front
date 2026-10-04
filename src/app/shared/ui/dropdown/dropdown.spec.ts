import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Dropdown, type DropdownOption } from './dropdown';

@Component({
  imports: [Dropdown, ReactiveFormsModule],
  template: `<app-dropdown [formControl]="control" [options]="options()" placeholder="Оберіть" />`,
})
class Host {
  readonly control = new FormControl('a', { nonNullable: true });
  readonly options = signal<DropdownOption[]>([
    { value: 'a', label: 'Альфа' },
    { value: 'b', label: 'Бета' },
    { value: 'c', label: 'Гамма', disabled: true },
  ]);
}

describe('Dropdown', () => {
  let fixture: ComponentFixture<Host>;
  let el: HTMLElement;

  const trigger = () => el.querySelector('.dropdown__trigger') as HTMLButtonElement;
  const optionEls = () => Array.from(el.querySelectorAll<HTMLElement>('.dropdown__option'));
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

  it('shows the label of the current value', () => {
    expect(trigger().textContent?.trim()).toBe('Альфа');
  });

  it('shows the placeholder when the value matches no option', async () => {
    fixture.componentInstance.control.setValue('zzz');
    await settle();

    expect(trigger().textContent?.trim()).toBe('Оберіть');
  });

  it('updates the shown label when the form value is set from code', async () => {
    fixture.componentInstance.control.setValue('b');
    await settle();

    expect(trigger().textContent?.trim()).toBe('Бета');
  });

  it('opens a listbox on click and lists every option, marking the selected one', async () => {
    trigger().click();
    await settle();

    expect(el.querySelector('[role="listbox"]')).not.toBeNull();
    expect(optionEls().map((o) => o.textContent?.trim())).toEqual(['Альфа', 'Бета', 'Гамма']);
    expect(optionEls()[0]?.getAttribute('aria-selected')).toBe('true');
  });

  it('writes the chosen value to the form control and closes', async () => {
    trigger().click();
    await settle();

    optionEls()[1]?.click();
    await settle();

    expect(fixture.componentInstance.control.value).toBe('b');
    expect(el.querySelector('[role="listbox"]')).toBeNull();
    expect(trigger().textContent?.trim()).toBe('Бета');
  });

  it('does not choose a disabled option', async () => {
    trigger().click();
    await settle();

    optionEls()[2]?.click();
    await settle();

    expect(fixture.componentInstance.control.value).toBe('a');
  });

  it('moves the highlight with arrow keys and chooses it with Enter', async () => {
    trigger().click();
    await settle();

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle();

    expect(fixture.componentInstance.control.value).toBe('b');
  });

  it('closes on Escape without changing the value', async () => {
    trigger().click();
    await settle();

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();

    expect(el.querySelector('[role="listbox"]')).toBeNull();
    expect(fixture.componentInstance.control.value).toBe('a');
  });

  it('opens with ArrowDown when closed', async () => {
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await settle();

    expect(el.querySelector('[role="listbox"]')).not.toBeNull();
  });

  it('marks the form control as touched when focus leaves', async () => {
    trigger().click();
    await settle();

    trigger().dispatchEvent(new Event('blur'));
    await settle();

    expect(fixture.componentInstance.control.touched).toBe(true);
    expect(el.querySelector('[role="listbox"]')).toBeNull();
  });

  it('cannot be opened while the form control is disabled', async () => {
    fixture.componentInstance.control.disable();
    await settle();

    expect(trigger().disabled).toBe(true);
    trigger().click();
    await settle();

    expect(el.querySelector('[role="listbox"]')).toBeNull();
  });

  it('points aria-activedescendant at the highlighted option', async () => {
    trigger().click();
    await settle();

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await settle();

    const activeId = trigger().getAttribute('aria-activedescendant');
    expect(activeId).not.toBeNull();
    expect(el.querySelector(`[id="${activeId}"]`)?.textContent?.trim()).toBe('Бета');
  });

  it('renders option groups as headings that are not selectable', async () => {
    fixture.componentInstance.options.set([
      { value: 'a', label: 'Альфа', group: 'Перша' },
      { value: 'b', label: 'Бета', group: 'Друга' },
    ]);
    await settle();
    trigger().click();
    await settle();

    const groups = Array.from(el.querySelectorAll('.dropdown__group')).map((g) => g.textContent?.trim());
    expect(groups).toEqual(['Перша', 'Друга']);
  });
  it('opens upward when there is no room below the trigger', async () => {
    vi.spyOn(el.querySelector('app-dropdown') as HTMLElement, 'getBoundingClientRect').mockReturnValue({
      top: 700,
      bottom: 720,
    } as DOMRect);
    trigger().click();
    await settle();

    expect(el.querySelector('.dropdown__panel')?.classList.contains('dropdown__panel--up')).toBe(true);
  });

});
