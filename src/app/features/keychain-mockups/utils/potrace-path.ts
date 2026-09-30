import { formatNumber } from '../../sticker-generator/utils/path-data';

const POTRACE_SCALE = 0.1;
const TOKEN = /[MmLlCcZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

export function potraceToPathData(parts: readonly string[], height: number): string {
  const tokens = parts.join('').match(TOKEN) ?? [];
  const x = (value: number): string => formatNumber(value * POTRACE_SCALE);
  const y = (value: number): string => formatNumber(height - value * POTRACE_SCALE);
  const output: string[] = [];
  let index = 0;
  let command = '';
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  const next = (): number => {
    const token = tokens[index++];
    if (token === undefined || /^[MmLlCcZz]$/.test(token)) {
      throw new Error('Malformed potrace path data');
    }
    return Number(token);
  };

  while (index < tokens.length) {
    const token = tokens[index] ?? '';
    if (/^[MmLlCcZz]$/.test(token)) {
      command = token;
      index++;
    }
    switch (command) {
      case 'M':
      case 'm': {
        const dx = next();
        const dy = next();
        currentX = command === 'm' ? currentX + dx : dx;
        currentY = command === 'm' ? currentY + dy : dy;
        startX = currentX;
        startY = currentY;
        output.push(`M${x(currentX)} ${y(currentY)}`);
        command = command === 'm' ? 'l' : 'L';
        break;
      }
      case 'L':
      case 'l': {
        const dx = next();
        const dy = next();
        currentX = command === 'l' ? currentX + dx : dx;
        currentY = command === 'l' ? currentY + dy : dy;
        output.push(`L${x(currentX)} ${y(currentY)}`);
        break;
      }
      case 'C':
      case 'c': {
        const relative = command === 'c';
        const values = [next(), next(), next(), next(), next(), next()];
        const points = values.map((value, position) =>
          relative ? value + (position % 2 === 0 ? currentX : currentY) : value,
        );
        output.push(
          `C${x(points[0] ?? 0)} ${y(points[1] ?? 0)} ${x(points[2] ?? 0)} ${y(points[3] ?? 0)} ${x(points[4] ?? 0)} ${y(points[5] ?? 0)}`,
        );
        currentX = points[4] ?? 0;
        currentY = points[5] ?? 0;
        break;
      }
      case 'Z':
      case 'z':
        output.push('Z');
        currentX = startX;
        currentY = startY;
        command = '';
        break;
      default:
        throw new Error('Malformed potrace path data');
    }
  }
  return output.join('');
}
