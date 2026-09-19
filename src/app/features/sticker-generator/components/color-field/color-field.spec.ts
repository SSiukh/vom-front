import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ColorField, parseHexColor } from './color-field';

@Component({
  imports: [ReactiveFormsModule, ColorField],
  template: '<app-color-field label="Колір фону" inputId="bg" [formControl]="control" />',
})
class Host {
  readonly control = new FormControl('#112233', { nonNullable: true });
}

describe('parseHexColor', () => {
  it('normalises six hex digits, with or without # and in any case, to lowercase #rrggbb', () => {
    expect(parseHexColor('#E8871E', false)).toBe('#e8871e');
    expect(parseHexColor('e8871e', false)).toBe('#e8871e');
    expect(parseHexColor('  #e8871e  ', false)).toBe('#e8871e');
  });

  it('expands the three-digit shorthand only when allowed', () => {
    expect(parseHexColor('#abc', true)).toBe('#aabbcc');
    expect(parseHexColor('F80', true)).toBe('#ff8800');
    expect(parseHexColor('#abc', false)).toBeNull();
  });

  it('rejects anything that is not a hex colour', () => {
    for (const text of ['', '#', '#12', '#12345', '#1234567', '#gggggg', 'red', 'rgb(1,2,3)', '#12 456']) {
      expect(parseHexColor(text, true)).toBeNull();
    }
  });
});

describe('ColorField', () => {
  let fixture: ComponentFixture<Host>;
  let el: HTMLElement;

  const picker = () => el.querySelector('#bg') as HTMLInputElement;
  const hex = () => el.querySelector('.color-field__hex') as HTMLInputElement;
  const control = () => fixture.componentInstance.control;

  const type = (text: string) => {
    hex().value = text;
    hex().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const commit = (event: 'change' | 'blur') => {
    hex().dispatchEvent(new Event(event));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('labels the colour picker and shows the current value in both inputs', () => {
    expect(el.querySelector('label')?.textContent?.trim()).toBe('Колір фону');
    expect(el.querySelector('label')?.getAttribute('for')).toBe('bg');
    expect(picker().type).toBe('color');
    expect(picker().value).toBe('#112233');
    expect(hex().value).toBe('#112233');
    expect(hex().getAttribute('aria-label')).toBe('Колір фону, HEX');
  });

  it('updates the control and the hex text when a colour is picked', () => {
    picker().value = '#ff8800';
    picker().dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(control().value).toBe('#ff8800');
    expect(hex().value).toBe('#ff8800');
  });

  it('accepts a pasted hex value with # and uppercase letters', () => {
    type('#E8871E');

    expect(control().value).toBe('#e8871e');
    expect(picker().value).toBe('#e8871e');
    expect(hex().getAttribute('aria-invalid')).toBe('false');
  });

  it('accepts a pasted hex value without the #', () => {
    type('e8871e');

    expect(control().value).toBe('#e8871e');
    expect(hex().value).toBe('#e8871e');
  });

  it('leaves the control untouched while the typed value is incomplete and flags it', () => {
    type('#e8');

    expect(control().value).toBe('#112233');
    expect(picker().value).toBe('#112233');
    expect(hex().value).toBe('#e8');
    expect(hex().getAttribute('aria-invalid')).toBe('true');
  });

  it('expands a three-digit shorthand once editing is finished', () => {
    type('#f80');
    expect(hex().getAttribute('aria-invalid')).toBe('false');
    expect(control().value).toBe('#112233');

    commit('change');

    expect(control().value).toBe('#ff8800');
    expect(hex().value).toBe('#ff8800');
    expect(hex().getAttribute('aria-invalid')).toBe('false');
  });

  it('reverts an invalid value to the last valid colour on blur', () => {
    type('zzz');

    commit('blur');

    expect(control().value).toBe('#112233');
    expect(hex().value).toBe('#112233');
    expect(hex().getAttribute('aria-invalid')).toBe('false');
  });

  it('marks the control as touched on blur', () => {
    expect(control().touched).toBe(false);

    commit('blur');

    expect(control().touched).toBe(true);
  });

  it('follows programmatic changes of the control', () => {
    control().setValue('#abcdef');
    fixture.detectChanges();

    expect(picker().value).toBe('#abcdef');
    expect(hex().value).toBe('#abcdef');
  });

  it('falls back to black for an unusable control value', () => {
    control().setValue('not a colour');
    fixture.detectChanges();

    expect(picker().value).toBe('#000000');
    expect(hex().value).toBe('#000000');
  });

  it('disables both inputs together with the control', () => {
    control().disable();
    fixture.detectChanges();

    expect(picker().disabled).toBe(true);
    expect(hex().disabled).toBe(true);
  });
});
