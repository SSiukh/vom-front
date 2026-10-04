import { buildWeeks, formatDisplayDate, parseIsoDate, toIsoDate } from './date-picker.utils';

describe('date-picker utils', () => {
  it('formats an ISO date as dd.mm.yyyy and leaves invalid input empty', () => {
    expect(formatDisplayDate('2026-08-01')).toBe('01.08.2026');
    expect(formatDisplayDate('')).toBe('');
    expect(formatDisplayDate('2026-02-31')).toBe('');
  });

  it('parses only real calendar dates', () => {
    expect(parseIsoDate('2026-08-22')?.getDate()).toBe(22);
    expect(parseIsoDate('2026-02-29')).toBeNull();
    expect(parseIsoDate('22.08.2026')).toBeNull();
  });

  it('round-trips a local date through toIsoDate', () => {
    expect(toIsoDate(new Date(2026, 7, 9))).toBe('2026-08-09');
  });

  it('lays out a month Monday-first, padding the weeks with empty cells', () => {
    const weeks = buildWeeks(2026, 7);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]?.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(weeks[0]?.[5]?.iso).toBe('2026-08-01');
    expect(weeks[0]?.[6]?.iso).toBe('2026-08-02');
    expect(weeks[weeks.length - 1]?.[0]?.iso).toBe('2026-08-31');
    expect(weeks[weeks.length - 1]?.[6]).toBeNull();
  });
});
