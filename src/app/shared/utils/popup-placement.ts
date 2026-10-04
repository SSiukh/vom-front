export function shouldOpenUpward(anchor: HTMLElement, popupHeight: number): boolean {
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  return spaceBelow < popupHeight && spaceAbove > spaceBelow;
}
