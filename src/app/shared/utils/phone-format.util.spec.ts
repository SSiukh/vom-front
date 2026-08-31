import { normalizeUaPhone } from './phone-format.util';

describe('normalizeUaPhone', () => {
  it('keeps an already-canonical +380 number as-is', () => {
    expect(normalizeUaPhone('+380501234567')).toBe('+380501234567');
  });

  it('prepends + to a number that already has the 380 country code', () => {
    expect(normalizeUaPhone('380501234567')).toBe('+380501234567');
  });

  it('replaces a leading domestic trunk 0 with +380', () => {
    expect(normalizeUaPhone('0501234567')).toBe('+380501234567');
  });

  it('prepends +380 to a bare 9-digit national number with no trunk prefix', () => {
    expect(normalizeUaPhone('501234567')).toBe('+380501234567');
  });

  it('strips spaces, dashes, and parentheses from a formatted number', () => {
    expect(normalizeUaPhone('+38 (050) 123-45-67')).toBe('+380501234567');
  });

  it('strips spaces from a domestic-formatted number', () => {
    expect(normalizeUaPhone('050 123 45 67')).toBe('+380501234567');
  });

  it('returns an empty string for an empty input', () => {
    expect(normalizeUaPhone('')).toBe('');
  });

  it('returns an empty string when the input has no digits at all', () => {
    expect(normalizeUaPhone('+++   ')).toBe('');
  });

  it('does not fabricate a +380 number from an incomplete/too-short national number', () => {
    expect(normalizeUaPhone('05')).toBe('05');
    expect(normalizeUaPhone('05012345')).toBe('05012345');
  });

  it('does not mangle a non-UA number into a bogus +380 one — leaves the digits untouched instead', () => {
    expect(normalizeUaPhone('+1 555 123 4567')).toBe('15551234567');
  });

  it('does not truncate an over-long +380 number into a fabricated shorter one', () => {
    expect(normalizeUaPhone('+380501234567890')).toBe('380501234567890');
  });
});
