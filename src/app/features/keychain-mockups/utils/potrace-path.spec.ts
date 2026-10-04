import { potraceToPathData } from './potrace-path';

describe('potraceToPathData', () => {
  it('scales potrace units by 0.1 and flips the y axis against the bitmap height', () => {
    expect(potraceToPathData(['M100 200 l50 0 0 -50 z'], 40)).toBe('M10 20L15 20L15 25Z');
  });

  it('converts relative cubic curves to absolute ones', () => {
    expect(potraceToPathData(['M100 100 c10 0 20 10 30 30 z'], 50)).toBe(
      'M10 40C11 40 12 39 13 37Z',
    );
  });

  it('continues implicit repeated curve and line segments', () => {
    expect(potraceToPathData(['M0 0 c10 0 20 0 30 0 10 0 20 0 30 0 l10 10 z'], 10)).toBe(
      'M0 10C1 10 2 10 3 10C4 10 5 10 6 10L7 9Z',
    );
  });

  it('starts the next relative subpath from the start of the previous one after a close', () => {
    expect(potraceToPathData(['M100 100 l100 0 0 100 z m10 10 l50 0 0 50 z'], 100)).toBe(
      'M10 90L20 90L20 80ZM11 89L16 89L16 84Z',
    );
  });

  it('accepts several path strings and joins them into one path', () => {
    expect(potraceToPathData(['M0 0 l10 0 z ', 'M50 50 l10 0 z'], 10)).toBe('M0 10L1 10ZM5 5L6 5Z');
  });

  it('accepts absolute commands too', () => {
    expect(potraceToPathData(['M10 10 L20 20 C30 30 40 40 50 50 Z'], 10)).toBe(
      'M1 9L2 8C3 7 4 6 5 5Z',
    );
  });

  it('handles negative and fractional numbers', () => {
    expect(potraceToPathData(['M100 100 l-15 -5.5 z'], 20)).toBe('M10 10L8.5 10.55Z');
  });

  it('reads exponent and leading-dot numbers instead of splitting them into wrong tokens', () => {
    expect(potraceToPathData(['M1e2 .5e3 l5e1 0 z'], 100)).toBe('M10 50L15 50Z');
  });

  it('returns an empty path for no data', () => {
    expect(potraceToPathData([], 10)).toBe('');
  });

  it('rejects unsupported commands and truncated data', () => {
    expect(() => potraceToPathData(['M0 0 h10 z'], 10)).toThrow('Malformed potrace path data');
    expect(() => potraceToPathData(['M0 0 l10'], 10)).toThrow('Malformed potrace path data');
  });

  it('never emits NaN or relative commands', () => {
    const result = potraceToPathData(
      [
        'M290 571 c0 -25 -4 -29 -39 -35 -62 -10 -131 -63 -164 -126 z m87 -204 c38 -37 31 -125 -12 -153 z',
      ],
      60,
    );

    expect(result).not.toMatch(/NaN|[a-y]/);
    expect(result.startsWith('M29 ')).toBe(true);
  });
});
