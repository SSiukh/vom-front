const HEX_COLOR = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;

export const MIN_READABLE_CONTRAST = 3;

export function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(color: string): number {
  const match = HEX_COLOR.exec(color);
  if (!match) {
    throw new Error('Expected a #rrggbb colour');
  }
  const [red, green, blue] = [match[1], match[2], match[3]].map((channel) => linearise(parseInt(channel ?? '0', 16) / 255));
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

function linearise(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}
