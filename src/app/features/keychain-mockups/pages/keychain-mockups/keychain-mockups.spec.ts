import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KeychainMockups } from './keychain-mockups';

describe('KeychainMockups', () => {
  let fixture: ComponentFixture<KeychainMockups>;
  let el: HTMLElement;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  const photoInput = () => el.querySelector('#photo') as HTMLInputElement;
  const chooseFile = (file: File) => {
    Object.defineProperty(photoInput(), 'files', { value: [file], configurable: true });
    photoInput().dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const png = (name = 'logo.png', size = 100) => new File([new Uint8Array(size)], name, { type: 'image/png' });
  const options = (id: string) => Array.from(el.querySelectorAll(`#${id} option`)).map((option) => option.textContent?.trim());

  beforeEach(async () => {
    createObjectURL = vi.fn().mockReturnValue('blob:photo-1');
    revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    TestBed.configureTestingModule({ imports: [KeychainMockups] });
    fixture = TestBed.createComponent(KeychainMockups);
    fixture.detectChanges();
    await fixture.whenStable();
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('layout', () => {
    it('shows the page title', () => {
      expect(el.querySelector('.page-title')?.textContent?.trim()).toBe('Брелки');
    });

    it('has the form on the left and the results on the right', () => {
      const layout = el.querySelector('.keychain-layout') as HTMLElement;

      expect(layout.children[0]?.classList.contains('keychain-form')).toBe(true);
      expect(layout.children[1]?.classList.contains('keychain-results')).toBe(true);
    });

    it('reserves a place for the mock-up previews with download and copy actions, both blocked for now', () => {
      const previews = el.querySelector('.keychain-previews') as HTMLElement;
      const buttons = Array.from(previews.querySelectorAll('button'));

      expect(previews.querySelector('.field-label')?.textContent?.trim()).toBe('Макети');
      expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Завантажити', 'Копіювати']);
      expect(buttons.every((button) => button.disabled)).toBe(true);
    });

    it('reserves a place for the SVG download below the previews, blocked for now', () => {
      const results = el.querySelector('.keychain-results') as HTMLElement;
      const svgPanel = el.querySelector('.keychain-svg') as HTMLElement;

      expect(results.children[1]).toBe(svgPanel);
      expect(svgPanel.querySelector('.field-label')?.textContent?.trim()).toBe('SVG');
      const button = svgPanel.querySelector('button') as HTMLButtonElement;
      expect(button.textContent?.trim()).toBe('Завантажити SVG');
      expect(button.disabled).toBe(true);
    });
  });

  describe('form', () => {
    it('reserves the mock-up styles block', () => {
      expect(el.textContent).toContain('Стилі макета буде додано пізніше.');
    });

    it('does not invent keychain types and says they will be added later', () => {
      expect(options('keychainTypeId')).toEqual(['Типи буде додано пізніше']);
    });

    it('offers the sticker logos, or none, and the sticker fonts', () => {
      expect(options('logoId')).toEqual(['Без логотипу', 'Instagram', 'TikTok', 'Telegram']);
      expect(options('fontId')).toEqual(['Jua']);
    });

    it('starts without a logo and with an empty text limited to 40 characters', () => {
      expect((el.querySelector('#logoId') as HTMLSelectElement).value).toBe('none');
      expect((el.querySelector('#text') as HTMLInputElement).value).toBe('');
      expect(el.querySelector('#text')?.getAttribute('maxlength')).toBe('40');
    });

    it('accepts only PNG, JPEG and WebP in the photo picker', () => {
      expect(photoInput().getAttribute('accept')).toBe('image/png,image/jpeg,image/webp');
    });
  });

  describe('photo upload', () => {
    it('starts with a hint and no preview', () => {
      expect(el.querySelector('.keychain-photo')).toBeNull();
      expect(el.querySelector('.keychain-hint')?.textContent).toContain('чорно-біле');
    });

    it('previews a valid photo with its name', () => {
      chooseFile(png('bike.png'));

      const image = el.querySelector('.keychain-photo__image') as HTMLImageElement;
      expect(image.getAttribute('src')).toBe('blob:photo-1');
      expect(el.querySelector('.keychain-photo__name')?.textContent?.trim()).toBe('bike.png');
      expect(el.querySelector('.keychain-hint')).toBeNull();
      expect(el.querySelector('.error-text')).toBeNull();
    });

    it('rejects an unsupported file type with a message and keeps no preview', () => {
      chooseFile(new File(['x'], 'a.gif', { type: 'image/gif' }));

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Підтримуються лише PNG, JPG та WebP');
      expect(el.querySelector('.keychain-photo')).toBeNull();
      expect(createObjectURL).not.toHaveBeenCalled();
    });

    it('rejects a photo above 10 MB', () => {
      chooseFile(png('big.png', 10 * 1024 * 1024 + 1));

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Файл завеликий, максимум 10 МБ');
      expect(el.querySelector('.keychain-photo')).toBeNull();
    });

    it('keeps the previous photo when a later file is rejected, and shows the error', () => {
      chooseFile(png('first.png'));

      chooseFile(new File(['x'], 'a.gif', { type: 'image/gif' }));

      expect(el.querySelector('.keychain-photo__name')?.textContent?.trim()).toBe('first.png');
      expect(el.querySelector('.error-text')).not.toBeNull();
    });

    it('clears the error after a valid photo is chosen', () => {
      chooseFile(new File(['x'], 'a.gif', { type: 'image/gif' }));

      chooseFile(png());

      expect(el.querySelector('.error-text')).toBeNull();
    });

    it('releases the previous object URL when the photo is replaced', () => {
      chooseFile(png('one.png'));
      createObjectURL.mockReturnValue('blob:photo-2');

      chooseFile(png('two.png'));

      expect(revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
      expect((el.querySelector('.keychain-photo__image') as HTMLImageElement).getAttribute('src')).toBe('blob:photo-2');
    });

    it('removes the photo and releases its object URL', () => {
      chooseFile(png());

      (el.querySelector('.keychain-photo .btn-outline-danger') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(el.querySelector('.keychain-photo')).toBeNull();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
      expect(el.querySelector('.keychain-hint')).not.toBeNull();
    });

    it('releases the object URL when the page is destroyed', () => {
      chooseFile(png());

      fixture.destroy();

      expect(revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
    });

    it('does nothing when the picker is cancelled', () => {
      Object.defineProperty(photoInput(), 'files', { value: [], configurable: true });
      photoInput().dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(el.querySelector('.keychain-photo')).toBeNull();
      expect(el.querySelector('.error-text')).toBeNull();
    });
  });
});
