import type { PathCommand } from '../models/glyph-source.model';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const SEGMENT = /([MLHVCQZ])([^MLHVCQZ]*)/g;
const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const UNSUPPORTED = /[^MLHVCQZ\d\s,.eE+-]/;
const ARGUMENT_COUNT: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, Z: 0 };

export function formatNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

export function commandsToPathData(commands: readonly PathCommand[]): string {
  return commands.map(commandToString).join('');
}

export function transformCommands(commands: readonly PathCommand[], scale: number, dx: number, dy: number): PathCommand[] {
  const x = (value: number): number => value * scale + dx;
  const y = (value: number): number => value * scale + dy;
  return commands.map((command): PathCommand => {
    switch (command.type) {
      case 'M':
      case 'L':
        return { type: command.type, x: x(command.x), y: y(command.y) };
      case 'Q':
        return { type: 'Q', x1: x(command.x1), y1: y(command.y1), x: x(command.x), y: y(command.y) };
      case 'C':
        return {
          type: 'C',
          x1: x(command.x1),
          y1: y(command.y1),
          x2: x(command.x2),
          y2: y(command.y2),
          x: x(command.x),
          y: y(command.y),
        };
      case 'Z':
        return { type: 'Z' };
    }
  });
}

export function commandsBounds(commands: readonly PathCommand[]): Bounds | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const command of commands) {
    if (command.type === 'Z') {
      continue;
    }
    xs.push(command.x);
    ys.push(command.y);
    if (command.type === 'Q' || command.type === 'C') {
      xs.push(command.x1);
      ys.push(command.y1);
    }
    if (command.type === 'C') {
      xs.push(command.x2);
      ys.push(command.y2);
    }
  }
  if (xs.length === 0) {
    return null;
  }
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export function transformPathData(pathData: string, scale: number, dx: number, dy: number): string {
  if (UNSUPPORTED.test(pathData)) {
    throw new Error('Unsupported SVG path command');
  }
  const tokens: string[] = [];
  let consumed = 0;
  for (const segment of pathData.matchAll(SEGMENT)) {
    const command = segment[1] ?? '';
    const args = segment[2] ?? '';
    consumed += segment[0].length;
    const numbers = (args.match(NUMBER) ?? []).map(Number);
    const count = ARGUMENT_COUNT[command] ?? 0;
    if (args.replace(NUMBER, '').replace(/[\s,]/g, '') !== '') {
      throw new Error('Malformed SVG path data');
    }
    if (count === 0) {
      if (numbers.length > 0) {
        throw new Error('Malformed SVG path data');
      }
      tokens.push('Z');
      continue;
    }
    if (numbers.length === 0 || numbers.length % count !== 0) {
      throw new Error('Malformed SVG path data');
    }
    for (let start = 0; start < numbers.length; start += count) {
      const name = command === 'M' && start > 0 ? 'L' : command;
      const values = numbers.slice(start, start + count).map((value, index) => transformArgument(command, index, value, scale, dx, dy));
      tokens.push(`${name}${values.map(formatNumber).join(' ')}`);
    }
  }
  if (consumed !== pathData.length) {
    throw new Error('Malformed SVG path data');
  }
  return tokens.join('');
}

function transformArgument(command: string, index: number, value: number, scale: number, dx: number, dy: number): number {
  const isHorizontal = command === 'H' || (command !== 'V' && index % 2 === 0);
  return value * scale + (isHorizontal ? dx : dy);
}

function commandToString(command: PathCommand): string {
  switch (command.type) {
    case 'M':
    case 'L':
      return `${command.type}${formatNumber(command.x)} ${formatNumber(command.y)}`;
    case 'Q':
      return `Q${[command.x1, command.y1, command.x, command.y].map(formatNumber).join(' ')}`;
    case 'C':
      return `C${[command.x1, command.y1, command.x2, command.y2, command.x, command.y].map(formatNumber).join(' ')}`;
    case 'Z':
      return 'Z';
  }
}
