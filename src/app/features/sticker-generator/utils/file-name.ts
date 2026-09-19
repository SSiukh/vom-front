const FALLBACK_NAME = 'sticker';

export function buildFileName(text: string, presetId: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${FALLBACK_NAME}-${slug || 'design'}-${presetId}.svg`;
}
