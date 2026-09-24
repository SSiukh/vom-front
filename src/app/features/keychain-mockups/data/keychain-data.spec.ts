import { KEYCHAIN_TYPES } from './keychain-types';
import { PHOTO_ACCEPTED_TYPES, PHOTO_MAX_BYTES } from './photo-upload';

describe('keychain data', () => {
  it('keeps the keychain types empty until the user supplies them', () => {
    expect(KEYCHAIN_TYPES).toEqual([]);
  });

  it('accepts PNG, JPEG and WebP photos up to 10 MB', () => {
    expect(PHOTO_ACCEPTED_TYPES).toEqual(['image/png', 'image/jpeg', 'image/webp']);
    expect(PHOTO_MAX_BYTES).toBe(10485760);
  });
});
