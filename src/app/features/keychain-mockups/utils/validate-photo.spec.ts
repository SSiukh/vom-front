import { validatePhoto } from './validate-photo';

const file = (type: string, size: number) => new File([new Uint8Array(size)], 'photo', { type });

describe('validatePhoto', () => {
  it('accepts PNG, JPEG and WebP', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(validatePhoto(file(type, 10))).toBeNull();
    }
  });

  it('rejects other file types', () => {
    for (const type of ['image/gif', 'image/svg+xml', 'application/pdf', '']) {
      expect(validatePhoto(file(type, 10))).toBe('Підтримуються лише PNG, JPG та WebP');
    }
  });

  it('accepts a file of exactly 10 MB and rejects anything larger', () => {
    expect(validatePhoto(file('image/png', 10 * 1024 * 1024))).toBeNull();
    expect(validatePhoto(file('image/png', 10 * 1024 * 1024 + 1))).toBe('Файл завеликий, максимум 10 МБ');
  });
});
