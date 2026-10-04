import { PHOTO_ACCEPTED_TYPES, PHOTO_MAX_BYTES } from '../data/photo-upload';

export function validatePhoto(file: File): string | null {
  if (!PHOTO_ACCEPTED_TYPES.includes(file.type)) {
    return 'Підтримуються лише PNG, JPG та WebP';
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return 'Файл завеликий, максимум 10 МБ';
  }
  return null;
}
