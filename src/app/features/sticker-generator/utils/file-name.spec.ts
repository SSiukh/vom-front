import { buildFileName } from './file-name';

describe('buildFileName', () => {
  it('slugs the text and appends the size preset', () => {
    expect(buildFileName('Kolos Track', '18x4')).toBe('sticker-kolos-track-18x4.svg');
  });

  it('strips leading and trailing separators', () => {
    expect(buildFileName('  @user_name!! ', '10x2')).toBe('sticker-user-name-10x2.svg');
  });

  it('falls back to a generic name when nothing usable is left', () => {
    expect(buildFileName('', '25x5')).toBe('sticker-design-25x5.svg');
    expect(buildFileName('ї є і', '25x5')).toBe('sticker-design-25x5.svg');
  });

  it('never contains path separators or spaces', () => {
    expect(buildFileName('../etc/passwd x', '16x3')).toMatch(/^[a-z0-9.-]+$/);
  });
});
