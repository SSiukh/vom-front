import { formatNumber } from '../../sticker-generator/utils/path-data';

export type AffineMatrix = readonly [number, number, number, number, number, number];

const SEGMENT = /([MLHVCQZ])([^MLHVCQZ]*)/g;
const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const UNSUPPORTED = /[^MLHVCQZ\d\s,.eE+-]/;
const ARGUMENT_COUNT: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, Z: 0 };

export function transformPathAffine(pathData: string, matrix: AffineMatrix): string {
  if (UNSUPPORTED.test(pathData)) {
    throw new Error('Unsupported SVG path command');
  }
  const [a, b, c, d, e, f] = matrix;
  const point = (x: number, y: number): string => `${formatNumber(a * x + c * y + e)} ${formatNumber(b * x + d * y + f)}`;
  const output: string[] = [];
  let consumed = 0;
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  for (const segment of pathData.matchAll(SEGMENT)) {
    const command = segment[1] ?? '';
    const args = segment[2] ?? '';
    consumed += segment[0].length;
    const numbers = (args.match(NUMBER) ?? []).map(Number);
    const count = ARGUMENT_COUNT[command] ?? 0;
    if (args.replace(NUMBER, '').replace(/[\s,]/g, '') !== '' || (count === 0 ? numbers.length > 0 : numbers.length === 0 || numbers.length % count !== 0)) {
      throw new Error('Malformed SVG path data');
    }
    if (command === 'Z') {
      output.push('Z');
      currentX = startX;
      currentY = startY;
      continue;
    }
    for (let index = 0; index < numbers.length; index += count) {
      const values = numbers.slice(index, index + count);
      switch (command) {
        case 'M':
        case 'L': {
          const name = command === 'M' && index > 0 ? 'L' : command;
          currentX = values[0] ?? 0;
          currentY = values[1] ?? 0;
          if (command === 'M' && index === 0) {
            startX = currentX;
            startY = currentY;
          }
          output.push(`${name}${point(currentX, currentY)}`);
          break;
        }
        case 'H':
          currentX = values[0] ?? 0;
          output.push(`L${point(currentX, currentY)}`);
          break;
        case 'V':
          currentY = values[0] ?? 0;
          output.push(`L${point(currentX, currentY)}`);
          break;
        case 'C':
          output.push(`C${point(values[0] ?? 0, values[1] ?? 0)} ${point(values[2] ?? 0, values[3] ?? 0)} ${point(values[4] ?? 0, values[5] ?? 0)}`);
          currentX = values[4] ?? 0;
          currentY = values[5] ?? 0;
          break;
        default:
          output.push(`Q${point(values[0] ?? 0, values[1] ?? 0)} ${point(values[2] ?? 0, values[3] ?? 0)}`);
          currentX = values[2] ?? 0;
          currentY = values[3] ?? 0;
      }
    }
  }
  if (consumed !== pathData.length) {
    throw new Error('Malformed SVG path data');
  }
  return output.join('');
}
