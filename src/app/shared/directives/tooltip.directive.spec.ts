import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Tooltip } from './tooltip.directive';

@Component({
  imports: [Tooltip],
  template: `<td class="cell" [appTooltip]="text()">{{ text() }}</td>`,
})
class Host {
  readonly text = input('Перший товар ×2, Другий товар ×1, Третій товар ×3');
}

describe('Tooltip', () => {
  let fixture: ComponentFixture<Host>;
  let cell: HTMLElement;

  const makeTruncated = (): void => {
    Object.defineProperty(cell, 'scrollWidth', { value: 400, configurable: true });
    Object.defineProperty(cell, 'clientWidth', { value: 100, configurable: true });
  };

  const panel = () => document.body.querySelector('[role="tooltip"]');
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    await settle();
    cell = (fixture.nativeElement as HTMLElement).querySelector('.cell') as HTMLElement;
  });

  afterEach(() => {
    document.querySelectorAll('[role="tooltip"]').forEach((node) => node.remove());
  });

  it('does not show a tooltip when the cell is not actually truncated', () => {
    cell.dispatchEvent(new Event('mouseenter'));

    expect(panel()).toBeNull();
  });

  it('shows the full text in a portalled panel when the cell is truncated', () => {
    makeTruncated();

    cell.dispatchEvent(new Event('mouseenter'));

    expect(panel()?.textContent).toBe(fixture.componentInstance.text());
    expect(panel()?.parentElement).toBe(document.body);
  });

  it('hides the panel on mouseleave', () => {
    makeTruncated();
    cell.dispatchEvent(new Event('mouseenter'));
    expect(panel()).not.toBeNull();

    cell.dispatchEvent(new Event('mouseleave'));

    expect(panel()).toBeNull();
  });

  it('does not open a second panel while one is already open', () => {
    makeTruncated();

    cell.dispatchEvent(new Event('mouseenter'));
    cell.dispatchEvent(new Event('mouseenter'));

    expect(document.body.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
  });

  it('shows on focus and hides on blur, for keyboard users', () => {
    makeTruncated();

    cell.dispatchEvent(new Event('focus'));
    expect(panel()).not.toBeNull();

    cell.dispatchEvent(new Event('blur'));
    expect(panel()).toBeNull();
  });

  it('ignores blank text, even when the cell is truncated', async () => {
    fixture.componentRef.setInput('text', '   ');
    await settle();
    makeTruncated();

    cell.dispatchEvent(new Event('mouseenter'));

    expect(panel()).toBeNull();
  });

  it('removes any open panel when the host is destroyed', () => {
    makeTruncated();
    cell.dispatchEvent(new Event('mouseenter'));
    expect(panel()).not.toBeNull();

    fixture.destroy();

    expect(panel()).toBeNull();
  });
});
