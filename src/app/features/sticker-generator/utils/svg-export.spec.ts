import type { StickerDocument } from '../models/sticker.model';
import { exportSvg } from './svg-export';

function sticker(overrides: Partial<StickerDocument> = {}): StickerDocument {
  return {
    width: 1000,
    height: 222.2222,
    cornerRadius: 0,
    background: '#000000',
    artwork: '#ffffff',
    artPaths: ['M0 0L10 0L10 10Z', 'M20 20L30 20L30 30Z'],
    ...overrides,
  };
}

function parse(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

describe('exportSvg', () => {
  it('produces well-formed SVG with a unitless size and matching viewBox', () => {
    const doc = parse(exportSvg(sticker()));
    const root = doc.documentElement;

    expect(doc.querySelector('parsererror')).toBeNull();
    expect(root.tagName).toBe('svg');
    expect(root.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
    expect(root.getAttribute('width')).toBe('1000');
    expect(root.getAttribute('height')).toBe('222.222');
    expect(root.getAttribute('viewBox')).toBe('0 0 1000 222.222');
  });

  it('exports the background rectangle with the background colour and no rounding by default', () => {
    const rect = parse(exportSvg(sticker({ background: '#112233' }))).querySelector('rect');

    expect(rect?.getAttribute('fill')).toBe('#112233');
    expect(rect?.getAttribute('width')).toBe('1000');
    expect(rect?.hasAttribute('rx')).toBe(false);
  });

  it('adds rx only when a corner radius is set', () => {
    const rect = parse(exportSvg(sticker({ cornerRadius: 12.5 }))).querySelector('rect');

    expect(rect?.getAttribute('rx')).toBe('12.5');
  });

  it('puts every art path in one group filled with the artwork colour', () => {
    const doc = parse(exportSvg(sticker({ artwork: '#ff8800' })));
    const group = doc.querySelector('g#art');

    expect(group?.getAttribute('fill')).toBe('#ff8800');
    expect(Array.from(group?.querySelectorAll('path') ?? []).map((path) => path.getAttribute('d'))).toEqual([
      'M0 0L10 0L10 10Z',
      'M20 20L30 20L30 30Z',
    ]);
  });

  it('contains only svg, rect, g and path elements', () => {
    const doc = parse(exportSvg(sticker()));
    const tags = new Set(Array.from(doc.querySelectorAll('*')).map((element) => element.tagName));

    expect(Array.from(tags).sort()).toEqual(['g', 'path', 'rect', 'svg']);
  });

  it('emits no NaN or Infinity', () => {
    expect(exportSvg(sticker())).not.toMatch(/NaN|Infinity/);
  });

  it('ends with a trailing newline', () => {
    expect(exportSvg(sticker()).endsWith('</svg>\n')).toBe(true);
  });

  it('rejects colours that are not #rrggbb', () => {
    expect(() => exportSvg(sticker({ background: 'red' }))).toThrow('Sticker colours must be #rrggbb values');
    expect(() => exportSvg(sticker({ artwork: '#fff' }))).toThrow('Sticker colours must be #rrggbb values');
    expect(() => exportSvg(sticker({ artwork: '#ffffff" onload="x' }))).toThrow('Sticker colours must be #rrggbb values');
  });

  it('rejects path data that could break out of the attribute', () => {
    expect(() => exportSvg(sticker({ artPaths: ['M0 0"/><script>'] }))).toThrow(
      'Sticker paths contain unsupported characters',
    );
  });
});
