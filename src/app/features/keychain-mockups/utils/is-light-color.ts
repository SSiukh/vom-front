const LIGHT_THRESHOLD = 0.6;

export function isLightColor(hex: string): boolean {
  const match = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
  if (!match) {
    throw new Error('Expected a #rrggbb colour');
  }
  const [red, green, blue] = [match[1], match[2], match[3]].map((part) => parseInt(part ?? '00', 16));
  return (0.299 * (red ?? 0) + 0.587 * (green ?? 0) + 0.114 * (blue ?? 0)) / 255 > LIGHT_THRESHOLD;
}
