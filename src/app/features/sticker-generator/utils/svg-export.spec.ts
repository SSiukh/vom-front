import type { StickerDocument } from '../models/sticker.model';
import { exportSvg } from './svg-export';

function sticker(overrides: Partial<StickerDocument> = {}): StickerDocument {
  return {
    width: 1000,
    height: 222.2222,
    cornerRadius: 0,
    background: '#000000',
    layers: [
      { d: 'M0 0L10 0L10 10Z', fill: '#ffffff' },
      { d: 'M20 20L30 20L30 30Z', fill: '#ffffff' },
    ],
    gradients: [],
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

  it('puts every layer in one art group, each path with its own fill', () => {
    const doc = parse(
      exportSvg(
        sticker({
          layers: [
            { d: 'M0 0L10 0L10 10Z', fill: '#ff8800' },
            { d: 'M20 20L30 20L30 30Z', fill: 'url(#g-1)' },
          ],
        }),
      ),
    );
    const paths = Array.from(doc.querySelectorAll('g#art path'));

    expect(paths.map((path) => path.getAttribute('d'))).toEqual(['M0 0L10 0L10 10Z', 'M20 20L30 20L30 30Z']);
    expect(paths.map((path) => path.getAttribute('fill'))).toEqual(['#ff8800', 'url(#g-1)']);
  });

  it('writes no defs when the sticker has no gradients', () => {
    expect(parse(exportSvg(sticker())).querySelector('defs')).toBeNull();
  });

  it('exports a linear gradient in bounding-box units with its stops', () => {
    const doc = parse(
      exportSvg(
        sticker({
          gradients: [
            {
              type: 'linear',
              id: 'ig-text',
              x1: 0,
              y1: 1,
              x2: 1,
              y2: 0,
              stops: [
                { offset: 0, color: '#fa8f21', opacity: 1 },
                { offset: 1, color: '#8c3aaa', opacity: 1 },
              ],
            },
          ],
        }),
      ),
    );
    const gradient = doc.querySelector('defs linearGradient');

    expect(doc.querySelector('parsererror')).toBeNull();
    expect(gradient?.getAttribute('id')).toBe('ig-text');
    expect([gradient?.getAttribute('x1'), gradient?.getAttribute('y1'), gradient?.getAttribute('x2'), gradient?.getAttribute('y2')]).toEqual([
      '0',
      '1',
      '1',
      '0',
    ]);
    const stops = Array.from(gradient?.querySelectorAll('stop') ?? []);
    expect(stops.map((stop) => [stop.getAttribute('offset'), stop.getAttribute('stop-color'), stop.hasAttribute('stop-opacity')])).toEqual([
      ['0', '#fa8f21', false],
      ['1', '#8c3aaa', false],
    ]);
  });

  it('exports a radial gradient in user space with its matrix and partial stop opacity', () => {
    const doc = parse(
      exportSvg(
        sticker({
          gradients: [
            {
              type: 'radial',
              id: 'ig-glow',
              cx: 0,
              cy: 0,
              r: 1,
              matrix: [80.1234, 0, 0, 80.1234, 10.5, 60.25],
              stops: [{ offset: 0.64, color: '#8c3aaa', opacity: 0 }],
            },
          ],
        }),
      ),
    );
    const gradient = doc.querySelector('defs radialGradient');

    expect(gradient?.getAttribute('gradientUnits')).toBe('userSpaceOnUse');
    expect(gradient?.getAttribute('gradientTransform')).toBe('matrix(80.123 0 0 80.123 10.5 60.25)');
    expect(gradient?.querySelector('stop')?.getAttribute('stop-opacity')).toBe('0');
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
    const layer = (fill: string) => ({ layers: [{ d: 'M0 0L1 1Z', fill }] });
    expect(() => exportSvg(sticker(layer('#fff')))).toThrow('Sticker colours must be #rrggbb values');
    expect(() => exportSvg(sticker(layer('#ffffff" onload="x')))).toThrow('Sticker colours must be #rrggbb values');
    expect(() => exportSvg(sticker(layer('url(#a" onload="x)')))).toThrow('Sticker colours must be #rrggbb values');
  });

  it('rejects gradients that could break out of an attribute or hold non-finite numbers', () => {
    const linear = (patch: Record<string, unknown>) =>
      sticker({
        gradients: [
          {
            type: 'linear',
            id: 'g1',
            x1: 0,
            y1: 0,
            x2: 1,
            y2: 1,
            stops: [{ offset: 0, color: '#000000', opacity: 1 }],
            ...patch,
          },
        ],
      });

    expect(() => exportSvg(linear({ id: 'a" onload="x' }))).toThrow('Sticker gradients are invalid');
    expect(() => exportSvg(linear({ x2: Number.NaN }))).toThrow('Sticker gradients are invalid');
    expect(() => exportSvg(linear({ stops: [{ offset: 0, color: 'red', opacity: 1 }] }))).toThrow('Sticker gradients are invalid');
    expect(() => exportSvg(linear({ stops: [{ offset: 0, color: '#000000', opacity: 2 }] }))).toThrow('Sticker gradients are invalid');
    expect(() => exportSvg(linear({ stops: [{ offset: Number.POSITIVE_INFINITY, color: '#000000', opacity: 1 }] }))).toThrow(
      'Sticker gradients are invalid',
    );
  });

  it('rejects path data that could break out of the attribute', () => {
    expect(() => exportSvg(sticker({ layers: [{ d: 'M0 0"/><script>', fill: '#ffffff' }] }))).toThrow(
      'Sticker paths contain unsupported characters',
    );
  });
});
