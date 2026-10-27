import { Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';

const PANEL_GAP = 6;
const VIEWPORT_MARGIN = 8;
let nextPanelId = 0;

@Directive({
  selector: '[appTooltip]',
  host: {
    tabindex: '0',
    '(mouseenter)': 'show()',
    '(mouseleave)': 'hide()',
    '(focus)': 'show()',
    '(blur)': 'hide()',
  },
})
export class Tooltip implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly appTooltip = input<string>('');

  private panel: HTMLElement | null = null;
  private readonly onViewportChange = (): void => this.hide();

  protected show(): void {
    const text = this.appTooltip().trim();
    const element = this.host.nativeElement;
    if (!text || element.scrollWidth <= element.clientWidth || this.panel) {
      return;
    }
    const panel = document.createElement('div');
    panel.id = `app-tooltip-${nextPanelId++}`;
    panel.setAttribute('role', 'tooltip');
    panel.textContent = text;
    panel.style.cssText = [
      'position: fixed',
      'z-index: 1000',
      'max-width: 320px',
      'padding: 8px 10px',
      'border-radius: var(--radius-sm)',
      'border: 1px solid var(--color-border-inner)',
      'background: var(--color-bg-panel-nested)',
      'color: var(--color-text-secondary)',
      'font-family: var(--font-body)',
      'font-size: 12px',
      'line-height: 1.5',
      'white-space: pre-line',
      'box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4)',
      'pointer-events: none',
    ].join(';');
    document.body.appendChild(panel);

    const hostRect = element.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    let top = hostRect.bottom + PANEL_GAP;
    if (top + panelRect.height > window.innerHeight - VIEWPORT_MARGIN) {
      top = hostRect.top - panelRect.height - PANEL_GAP;
    }
    let left = hostRect.left;
    if (left + panelRect.width > window.innerWidth - VIEWPORT_MARGIN) {
      left = window.innerWidth - panelRect.width - VIEWPORT_MARGIN;
    }
    panel.style.top = `${Math.max(VIEWPORT_MARGIN, top)}px`;
    panel.style.left = `${Math.max(VIEWPORT_MARGIN, left)}px`;

    this.panel = panel;
    element.setAttribute('aria-describedby', panel.id);
    window.addEventListener('scroll', this.onViewportChange, { capture: true, passive: true });
    window.addEventListener('resize', this.onViewportChange, { passive: true });
  }

  protected hide(): void {
    this.panel?.remove();
    this.panel = null;
    this.host.nativeElement.removeAttribute('aria-describedby');
    window.removeEventListener('scroll', this.onViewportChange, true);
    window.removeEventListener('resize', this.onViewportChange);
  }

  ngOnDestroy(): void {
    this.hide();
  }
}
