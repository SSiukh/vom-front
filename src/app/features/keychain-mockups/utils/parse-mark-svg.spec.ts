import { parseMarkSvg } from './parse-mark-svg';

const svg = (body: string, viewBox = '0 0 200 100') =>
  `<svg width="200" height="100" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

describe('parseMarkSvg', () => {
  it('reads the size from the viewBox and every path', () => {
    const result = parseMarkSvg(
      svg('<path d="M0 0L10 0L10 10Z" fill="black"/><path d="M20 20L30 20L30 30Z" fill="black"/>'),
    );

    expect(result.width).toBe(200);
    expect(result.height).toBe(100);
    expect(result.paths).toEqual(['M0 0L10 0L10 10Z', 'M20 20L30 20L30 30Z']);
    expect(result.evenOddPaths).toEqual([]);
  });

  it('moves the artwork to the origin when the viewBox does not start at 0', () => {
    const result = parseMarkSvg(svg('<path d="M10 20L30 20L30 40Z"/>', '10 20 50 60'));

    expect(result.width).toBe(50);
    expect(result.height).toBe(60);
    expect(result.paths).toEqual(['M0 0L20 0L20 20Z']);
  });

  it('accepts the H and V commands and exponent numbers the supplied marks use', () => {
    const result = parseMarkSvg(svg('<path d="M0 0H10V10C1e1 5 3 4 5 6Z"/>'));

    expect(result.paths[0]).toBe('M0 0H10V10C10 5 3 4 5 6Z');
  });

  it('ignores elements other than paths', () => {
    const result = parseMarkSvg(
      svg('<rect width="5" height="5"/><circle r="3"/><path d="M0 0L1 1Z"/><text>x</text>'),
    );

    expect(result.paths).toEqual(['M0 0L1 1Z']);
  });

  it('skips empty paths', () => {
    expect(parseMarkSvg(svg('<path d=""/><path d="M0 0L1 1Z"/>')).paths).toEqual(['M0 0L1 1Z']);
  });

  it('puts paths with fill-rule="evenodd" (on the path or a parent) into the even-odd list', () => {
    const result = parseMarkSvg(
      svg(
        '<path d="M0 0L1 1Z"/><path d="M2 2L3 3Z" fill-rule="evenodd" clip-rule="evenodd"/><g fill-rule="evenodd"><path d="M4 4L5 5Z"/></g>',
      ),
    );

    expect(result.paths).toEqual(['M0 0L1 1Z']);
    expect(result.evenOddPaths).toEqual(['M2 2L3 3Z', 'M4 4L5 5Z']);
  });

  it('keeps the default rule for an explicit fill-rule="nonzero"', () => {
    const result = parseMarkSvg(svg('<path d="M0 0L1 1Z" fill-rule="nonzero"/>'));

    expect(result.paths).toEqual(['M0 0L1 1Z']);
    expect(result.evenOddPaths).toEqual([]);
  });

  it('accepts a mark that consists only of even-odd paths', () => {
    const result = parseMarkSvg(svg('<path d="M0 0L1 1Z" fill-rule="evenodd"/>'));

    expect(result.paths).toEqual([]);
    expect(result.evenOddPaths).toEqual(['M0 0L1 1Z']);
  });

  it('ignores paths inside defs, clip paths and masks', () => {
    const result = parseMarkSvg(
      svg(
        '<defs><path d="M9 9L9 9Z"/></defs><clipPath id="c"><path d="M8 8L8 8Z"/></clipPath><mask id="m"><path d="M7 7L7 7Z"/></mask><path d="M0 0L1 1Z"/>',
      ),
    );

    expect(result.paths).toEqual(['M0 0L1 1Z']);
  });

  it('rejects text that is not an SVG', () => {
    expect(() => parseMarkSvg('<svg><path')).toThrow('The mark is not a valid SVG');
    expect(() => parseMarkSvg('<html xmlns="http://www.w3.org/1999/xhtml"/>')).toThrow(
      'The mark is not a valid SVG',
    );
  });

  it('rejects a missing or broken viewBox', () => {
    expect(() =>
      parseMarkSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0Z"/></svg>'),
    ).toThrow('The mark has no usable viewBox');
    expect(() => parseMarkSvg(svg('<path d="M0 0Z"/>', '0 0 abc 10'))).toThrow(
      'The mark has no usable viewBox',
    );
    expect(() => parseMarkSvg(svg('<path d="M0 0Z"/>', '0 0 0 10'))).toThrow(
      'The mark has no usable viewBox',
    );
  });

  it('rejects an SVG without any path', () => {
    expect(() => parseMarkSvg(svg('<rect width="1" height="1"/>'))).toThrow(
      'The mark has no paths',
    );
  });

  it('rejects path data with relative commands or arcs', () => {
    expect(() => parseMarkSvg(svg('<path d="M0 0l10 10Z"/>'))).toThrow(
      'Unsupported SVG path command',
    );
    expect(() => parseMarkSvg(svg('<path d="M0 0A5 5 0 0 1 10 10Z"/>'))).toThrow(
      'Unsupported SVG path command',
    );
  });
});
