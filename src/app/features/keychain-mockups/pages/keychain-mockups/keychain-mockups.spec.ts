import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { GlyphSource } from '../../../sticker-generator/models/glyph-source.model';
import { FontLibraryService } from '../../../sticker-generator/services/font-library.service';
import { MockupRenderer } from '../../../sticker-generator/services/mockup-renderer.service';
import {
  dropdownLabels,
  dropdownValue,
  pickDropdown,
} from '../../../../shared/ui/dropdown/dropdown-testing';
import { KEYCHAIN_TYPES } from '../../data/keychain-types';
import type { VectorGraphic } from '../../models/keychain.model';
import { KeychainRenderer } from '../../services/keychain-renderer.service';
import { MarkLibrary } from '../../services/mark-library.service';
import { NO_INK_ERROR, PhotoTracer } from '../../services/photo-tracer.service';
import { GEMINI_APP_URL, GEMINI_PHOTO_PROMPT } from '../../data/gemini-photo-prompt';
import { KeychainMockups } from './keychain-mockups';

const GLYPHS: GlyphSource = {
  unitsPerEm: 1000,
  capHeight: 700,
  hasGlyph: (char) => char !== 'Ж',
  advance: () => 600,
  kerning: () => 0,
  outline: () => [
    { type: 'M', x: 50, y: 0 },
    { type: 'L', x: 550, y: 0 },
    { type: 'L', x: 550, y: -700 },
    { type: 'L', x: 50, y: -700 },
    { type: 'Z' },
  ],
};

const PHOTO: VectorGraphic = { width: 100, height: 100, paths: ['M0 0L100 0L100 100Z'] };
const MARK: VectorGraphic = { width: 400, height: 40, paths: ['M0 0L400 0L400 40Z'] };
const WHITE_TAG_PRINT_AREA = { x: 648, y: 912, width: 232, height: 380 };

function expectInsideArea(
  path: string,
  area: { x: number; y: number; width: number; height: number },
): void {
  const values = (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const xs = values.filter((_, index) => index % 2 === 0);
  const ys = values.filter((_, index) => index % 2 === 1);
  expect(Math.min(...xs)).toBeGreaterThanOrEqual(area.x - 1);
  expect(Math.max(...xs)).toBeLessThanOrEqual(area.x + area.width + 1);
  expect(Math.min(...ys)).toBeGreaterThanOrEqual(area.y - 1);
  expect(Math.max(...ys)).toBeLessThanOrEqual(area.y + area.height + 1);
}

describe('KeychainMockups', () => {
  let fixture: ComponentFixture<KeychainMockups>;
  let el: HTMLElement;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickedAnchors: HTMLAnchorElement[];
  let trace: ReturnType<typeof vi.fn>;
  let loadMark: ReturnType<typeof vi.fn>;
  let loadFont: ReturnType<typeof vi.fn>;
  let render: ReturnType<typeof vi.fn>;
  let toPng: ReturnType<typeof vi.fn>;

  const create = async () => {
    TestBed.configureTestingModule({
      imports: [KeychainMockups],
      providers: [
        { provide: PhotoTracer, useValue: { trace } },
        { provide: MarkLibrary, useValue: { load: loadMark } },
        { provide: FontLibraryService, useValue: { load: loadFont } },
        { provide: KeychainRenderer, useValue: { render } },
        { provide: MockupRenderer, useValue: { toPng } },
      ],
    });
    fixture = TestBed.createComponent(KeychainMockups);
    await settle();
    el = fixture.nativeElement as HTMLElement;
  };

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const flush = async () => {
    await new Promise((resolve) => setTimeout(resolve));
    await settle();
  };

  const photoInput = () => el.querySelector('#photo') as HTMLInputElement;
  const png = (name = 'bike.png', size = 100) =>
    new File([new Uint8Array(size)], name, { type: 'image/png' });
  const chooseFile = async (file: File) => {
    Object.defineProperty(photoInput(), 'files', { value: [file], configurable: true });
    photoInput().dispatchEvent(new Event('change'));
    await settle();
  };
  const setSelect = async (id: string, value: string) => {
    pickDropdown(fixture, id, value);
    await settle();
  };
  const chooseKeychainType = async (id: string) => {
    const family = KEYCHAIN_TYPES.find((type) => type.id === id)?.family ?? '';
    if (dropdownValue(fixture, 'keychainFamilyId') !== family) {
      pickDropdown(fixture, 'keychainFamilyId', family);
    }
    await setSelect('keychainTypeId', id);
  };
  const chooseDesign = (id: string) => {
    const design = Array.from(el.querySelectorAll('.keychain-design')).find((candidate) =>
      candidate
        .querySelector('.keychain-design__image')
        ?.getAttribute('src')
        ?.endsWith(`/${id}.svg`),
    ) as HTMLButtonElement;
    design.click();
  };
  const setInput = async (id: string, value: string) => {
    const input = el.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const options = (id: string) => dropdownLabels(fixture, id);
  const button = (text: string) =>
    Array.from(el.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes(text),
    ) as HTMLButtonElement;
  const lastRender = () =>
    render.mock.calls.at(-1)?.[1] as {
      imageUrl: string;
      paths: string[];
      evenOddPaths: string[];
      ink: string;
      blend: string;
      opacity: number;
      metalPaths: string[];
      metalEvenOddPaths: string[];
    };
  const svgPaths = () => lastRender()?.paths ?? [];

  beforeEach(() => {
    createObjectURL = vi.fn().mockReturnValue('blob:photo-1');
    revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    clickedAnchors = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clickedAnchors.push(this);
    });
    trace = vi.fn().mockResolvedValue(PHOTO);
    loadMark = vi.fn().mockResolvedValue(MARK);
    loadFont = vi.fn().mockResolvedValue(GLYPHS);
    render = vi.fn().mockResolvedValue(undefined);
    toPng = vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  describe('layout', () => {
    it('shows the page title and puts the form on the left and the mock-up on the right', async () => {
      await create();

      expect(el.querySelector('.page-title')?.textContent?.trim()).toBe('Брелки');
      const layout = el.querySelector('.keychain-layout') as HTMLElement;
      expect(layout.children[0]?.classList.contains('keychain-form')).toBe(true);
      expect(layout.children[1]?.classList.contains('keychain-previews')).toBe(true);
    });

    it('splits the settings into separate cards for the keychain, the image, the mark and the text', async () => {
      await create();

      const cards = Array.from(el.querySelectorAll('.keychain-form > .keychain-card'));
      expect(
        cards.map((card) => card.querySelector('.keychain-card__title')?.textContent?.trim()),
      ).toEqual(['Брелок', 'Зображення', 'Марка', 'Текст']);
      const ids = (card: Element | undefined) =>
        Array.from(card?.querySelectorAll('input, [role="combobox"]') ?? [])
          .map((control) => control.id)
          .filter(Boolean);
      expect(ids(cards[0])).toEqual(['keychainFamilyId', 'keychainTypeId']);
      expect(ids(cards[1])).toEqual(['photo', 'photoScaleId']);
      expect(ids(cards[2])).toEqual(['markId-main', 'markScaleId-main']);
      expect(ids(cards[3])).toEqual(['text', 'fontId', 'textScaleId']);
    });

    it('makes every card a panel of its own, all inside the one form', async () => {
      await create();

      const form = el.querySelector('form.keychain-form') as HTMLFormElement;
      expect(form.querySelectorAll('.form-panel.keychain-card')).toHaveLength(4);
      expect(form.classList.contains('form-panel')).toBe(false);
    });
  });

  describe('form', () => {
    it('splits the keychain type into a family select and a subtype select of that family', async () => {
      await create();

      expect(options('keychainFamilyId')).toEqual(['Металевий жетон', 'Екошкіра', 'Шкіряна петля']);
      expect(dropdownValue(fixture, 'keychainFamilyId')).toBe('metal');
      expect(options('keychainTypeId')).toEqual([
        'Чорний',
        'Глянцевий',
        'Матовий',
        'Білий у силіконі',
      ]);
      expect(dropdownValue(fixture, 'keychainTypeId')).toBe('metal-white');
    });

    it('lists only the subtypes of the chosen family, and picking a family selects its first subtype', async () => {
      await create();

      pickDropdown(fixture, 'keychainFamilyId', 'leather');
      await settle();

      expect(options('keychainTypeId')).toEqual(['Чорна', 'Коричнева', 'Сіра']);
      expect(dropdownValue(fixture, 'keychainTypeId')).toBe('leather-black');
    });

    it('offers every mark, or none, and the two sticker fonts', async () => {
      await create();

      expect(options('markId-main')?.[0]).toBe('Без марки');
      expect(options('markId-main')).toHaveLength(37);
      expect(options('fontId')).toEqual(['Jua', 'Nunito (кирилиця)']);
    });

    it('starts without a mark, with empty text limited to 40 characters', async () => {
      await create();

      expect(dropdownValue(fixture, 'markId-main')).toBe('none');
      expect((el.querySelector('#text') as HTMLInputElement).value).toBe('');
      expect(el.querySelector('#text')?.getAttribute('maxlength')).toBe('40');
    });

    it('accepts only PNG, JPEG and WebP in the photo picker', async () => {
      await create();

      expect(photoInput().getAttribute('accept')).toBe('image/png,image/jpeg,image/webp');
    });

    it('has no ink colour control, because the colour follows the keychain type', async () => {
      await create();

      expect(el.querySelector('#inkColor')).toBeNull();
      expect(el.querySelector('app-color-field')).toBeNull();
    });

    it('offers XS to XL separately for the image, the mark and the text, starting on L, L and M', async () => {
      await create();

      for (const [id, start] of [
        ['photoScaleId', 'l'],
        ['markScaleId-main', 'l'],
        ['textScaleId', 'm'],
      ]) {
        expect(options(id ?? '')).toEqual(['XS', 'S', 'M', 'L', 'XL']);
        expect(dropdownValue(fixture, id)).toBe(start);
      }
    });

    it('has no overall scale or orientation any more', async () => {
      await create();

      expect(el.querySelector('#contentScaleId')).toBeNull();
      expect(el.querySelector('#photoOrientation, #markOrientation, #textOrientation')).toBeNull();
    });
  });

  describe('mock-up canvas', () => {
    it('renders the blank white metal tag photo as soon as the page opens', async () => {
      await create();

      expect(render).toHaveBeenCalledTimes(1);
      expect(render.mock.calls[0]?.[0]).toBe(el.querySelector('.keychain-canvas'));
      expect(lastRender()).toEqual({
        imageUrl: 'keychains/metal-white.jpg',
        paths: [],
        evenOddPaths: [],
        ink: '#000000',
        blend: 'multiply',
        opacity: 1,
        metalPaths: [],
        metalEvenOddPaths: [],
      });
    });

    it('renders the other photo with the fixed ink of that type when the type changes', async () => {
      await create();

      await chooseKeychainType('metal-black');
      expect(lastRender().imageUrl).toBe('keychains/metal-black.jpg');
      expect([lastRender().ink, lastRender().blend]).toEqual(['#ffffff', 'source-over']);

      await chooseKeychainType('subleather-mint');
      expect([lastRender().ink, lastRender().blend]).toEqual(['#6f4a2b', 'multiply']);

      await chooseKeychainType('leather-black');
      expect([lastRender().ink, lastRender().blend, lastRender().opacity]).toEqual([
        '#9d906c',
        'source-over',
        0.8,
      ]);
    });

    it('renders again when the text scale changes', async () => {
      await create();
      await setInput('text', 'A');
      const before = lastRender().paths[0];

      await setSelect('textScaleId', 'xs');

      expect(lastRender().paths[0]).not.toBe(before);
    });

    it('shows a loading overlay only when assembling takes longer than a moment', async () => {
      render.mockImplementation(() => new Promise<void>(() => undefined));
      await create();
      expect(el.querySelector('.keychain-loading')).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 250));
      await settle();

      expect(el.querySelector('.keychain-canvas-wrap .keychain-loading')?.textContent?.trim()).toBe(
        'Збираємо макет…',
      );
    });

    it('never flashes the loading overlay or the disabled buttons for a quick redraw', async () => {
      await create();
      const seen: boolean[] = [];
      const observer = new MutationObserver(() =>
        seen.push(el.querySelector('.keychain-loading') !== null),
      );
      observer.observe(el, { childList: true, subtree: true });

      await chooseKeychainType('metal-black');
      await chooseKeychainType('leather-brown');
      await flush();
      observer.disconnect();

      expect(seen.some(Boolean)).toBe(false);
      expect(button('Завантажити PNG').disabled).toBe(false);
    });

    it('keeps the canvas in place: the overlay does not push it down', async () => {
      render.mockImplementation(() => new Promise<void>(() => undefined));
      await create();
      await new Promise((resolve) => setTimeout(resolve, 250));
      await settle();

      const wrap = el.querySelector('.keychain-canvas-wrap') as HTMLElement;
      expect(wrap.querySelector('canvas')).not.toBeNull();
      expect(wrap.querySelector('.keychain-loading')).not.toBeNull();
      expect(el.querySelector('.keychain-previews > .loading-text')).toBeNull();
    });

    it('shows an error when the mock-up cannot be assembled', async () => {
      render.mockRejectedValue(new Error('404'));
      await create();
      await flush();

      expect(el.querySelector('.keychain-previews .error-text')?.textContent?.trim()).toBe(
        'Не вдалося зібрати макет',
      );
      expect(button('Завантажити PNG').disabled).toBe(true);
    });
  });

  describe('photo upload', () => {
    it('starts with a hint and no preview', async () => {
      await create();

      expect(el.querySelector('.keychain-photo')).toBeNull();
      expect(el.querySelector('.keychain-hint')?.textContent).toContain('чорно-біле');
    });

    it('previews a valid photo, traces it and adds it to the artwork', async () => {
      await create();

      await chooseFile(png('bike.png'));
      await flush();

      expect(trace).toHaveBeenCalledTimes(1);
      expect((trace.mock.calls[0]?.[0] as File).name).toBe('bike.png');
      expect(
        (el.querySelector('.keychain-photo__image') as HTMLImageElement).getAttribute('src'),
      ).toBe('blob:photo-1');
      expect(el.querySelector('.keychain-photo__name')?.textContent?.trim()).toBe('bike.png');
      expect(lastRender().paths).toHaveLength(1);
      expect(svgPaths()).toHaveLength(1);
      expectInsideArea(lastRender().paths[0] ?? '', WHITE_TAG_PRINT_AREA);
    });

    it('shows a processing message while the photo is being traced', async () => {
      trace.mockImplementation(() => new Promise<VectorGraphic>(() => undefined));
      await create();

      await chooseFile(png());

      expect(el.querySelector('.keychain-photo ~ .loading-text')?.textContent?.trim()).toBe(
        'Обробка фото…',
      );
    });

    it('says the photo was processed once tracing finished', async () => {
      await create();

      await chooseFile(png());
      await flush();

      expect(el.textContent).toContain('Фото оброблено й додано до малюнка.');
    });

    it('explains that no dark lines were found', async () => {
      trace.mockRejectedValue(new Error(NO_INK_ERROR));
      await create();

      await chooseFile(png());
      await flush();

      expect(el.textContent).toContain('На фото не знайдено темних ліній');
      expect(lastRender().paths).toEqual([]);
    });

    it('shows a generic message when tracing fails', async () => {
      trace.mockRejectedValue(new Error('wasm crashed'));
      await create();

      await chooseFile(png());
      await flush();

      expect(el.textContent).toContain('Не вдалося обробити фото');
    });

    it('ignores a slow trace of a photo that was replaced meanwhile', async () => {
      let resolveFirst: (graphic: VectorGraphic) => void = () => undefined;
      trace.mockImplementationOnce(
        () => new Promise<VectorGraphic>((resolve) => (resolveFirst = resolve)),
      );
      trace.mockResolvedValueOnce({ width: 50, height: 100, paths: ['M0 0L50 0L50 100Z'] });
      await create();
      await chooseFile(png('first.png'));
      createObjectURL.mockReturnValue('blob:photo-2');
      await chooseFile(png('second.png'));
      await flush();

      resolveFirst(PHOTO);
      await flush();

      expect(svgPaths()).toHaveLength(1);
      expect(svgPaths()[0]).toBeDefined();
    });

    it('rejects an unsupported file type without tracing', async () => {
      await create();

      await chooseFile(new File(['x'], 'a.gif', { type: 'image/gif' }));

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe(
        'Підтримуються лише PNG, JPG та WebP',
      );
      expect(trace).not.toHaveBeenCalled();
      expect(el.querySelector('.keychain-photo')).toBeNull();
    });

    it('rejects a photo above 10 MB', async () => {
      await create();

      await chooseFile(png('big.png', 10 * 1024 * 1024 + 1));

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe(
        'Файл завеликий, максимум 10 МБ',
      );
      expect(trace).not.toHaveBeenCalled();
    });

    it('keeps the previous photo when a later file is rejected', async () => {
      await create();
      await chooseFile(png('first.png'));

      await chooseFile(new File(['x'], 'a.gif', { type: 'image/gif' }));

      expect(el.querySelector('.keychain-photo__name')?.textContent?.trim()).toBe('first.png');
    });

    it('releases the previous object URL when the photo is replaced', async () => {
      await create();
      await chooseFile(png('one.png'));
      createObjectURL.mockReturnValue('blob:photo-2');

      await chooseFile(png('two.png'));

      expect(revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
    });

    it('removes the photo from the artwork and releases its object URL', async () => {
      await create();
      await chooseFile(png());
      await flush();

      (el.querySelector('.keychain-photo .btn-outline-danger') as HTMLButtonElement).click();
      await settle();

      expect(el.querySelector('.keychain-photo')).toBeNull();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
      expect(lastRender().paths).toEqual([]);
      expect(svgPaths()).toEqual([]);
    });

    it('releases the object URL when the page is destroyed', async () => {
      await create();
      await chooseFile(png());

      fixture.destroy();

      expect(revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
    });

    it('does nothing when the picker is cancelled', async () => {
      await create();
      Object.defineProperty(photoInput(), 'files', { value: [], configurable: true });

      photoInput().dispatchEvent(new Event('change'));
      await settle();

      expect(trace).not.toHaveBeenCalled();
      expect(el.querySelector('.error-text')).toBeNull();
    });
  });

  describe('metal cap icon', () => {
    it('draws the icon on the metal cap of a loop in black, not in the leather ink', async () => {
      await create();
      await chooseKeychainType('leather-black');
      chooseDesign('loop-icon');
      await settle();
      await setSelect('markId-icon', 'bmw');
      await flush();

      expect(lastRender().metalPaths).toHaveLength(1);
      expect(lastRender().paths).toHaveLength(0);
      expect(lastRender().ink).toBe('#9d906c');
    });
  });

  describe('Gemini photo prompt', () => {
    const geminiButton = () => button('Зображення з Gemini');

    it('opens Gemini in a new tab and copies the photo prompt to the clipboard', async () => {
      await create();
      const open = vi.fn().mockReturnValue({ opener: 'page' });
      vi.stubGlobal('open', open);
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

      geminiButton().click();
      await flush();

      expect(open).toHaveBeenCalledWith(GEMINI_APP_URL, '_blank');
      expect(writeText).toHaveBeenCalledWith(GEMINI_PHOTO_PROMPT);
      expect(el.querySelector('.error-text')).toBeNull();
    });

    it('shows an error when the browser blocks the new tab', async () => {
      await create();
      vi.stubGlobal('open', vi.fn().mockReturnValue(null));
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
      });

      geminiButton().click();
      await flush();

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe(
        'Браузер заблокував нову вкладку. Дозвольте спливаючі вікна для цього сайту.',
      );
    });

    it('shows an error when the prompt cannot be copied', async () => {
      await create();
      vi.stubGlobal('open', vi.fn());
      const writeText = vi.fn().mockRejectedValue(new Error('denied'));
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

      geminiButton().click();
      await flush();

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe(
        'Не вдалося скопіювати текст промпту. Скопіюйте його вручну.',
      );
    });
  });

  describe('photo drop zone', () => {
    const dropzone = () => el.querySelector('.keychain-dropzone') as HTMLElement;
    const drag = (
      type: 'dragover' | 'dragleave' | 'drop',
      dataTransfer: unknown = { types: ['Files'], files: [] },
    ) => {
      const event = Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
        dataTransfer,
      });
      dropzone().dispatchEvent(event);
      fixture.detectChanges();
      return event;
    };

    it('is a large area that explains both ways to add a photo and wraps the file input', async () => {
      await create();

      expect(dropzone().textContent).toContain('Перетягніть фото сюди');
      expect(dropzone().textContent).toContain('або натисніть, щоб обрати файл');
      expect(dropzone().textContent).toContain('PNG, JPG, WebP до 10 МБ');
      expect(dropzone().contains(photoInput())).toBe(true);
      expect(dropzone().getAttribute('for')).toBe('photo');
    });

    it('highlights while a file is dragged over it and allows the drop', async () => {
      await create();

      const event = drag('dragover');

      expect(event.defaultPrevented).toBe(true);
      expect(dropzone().classList.contains('keychain-dropzone--active')).toBe(true);
    });

    it('does not react to dragged text or other things that are not files', async () => {
      await create();

      const event = drag('dragover', { types: ['text/plain'], files: [] });

      expect(event.defaultPrevented).toBe(false);
      expect(dropzone().classList.contains('keychain-dropzone--active')).toBe(false);
    });

    it('removes the highlight when the drag leaves', async () => {
      await create();
      drag('dragover');

      drag('dragleave');

      expect(dropzone().classList.contains('keychain-dropzone--active')).toBe(false);
    });

    it('takes a dropped photo exactly like a chosen one: preview, tracing and artwork', async () => {
      await create();

      const event = drag('drop', { types: ['Files'], files: [png('dropped.png')] });
      await flush();

      expect(event.defaultPrevented).toBe(true);
      expect((trace.mock.calls[0]?.[0] as File).name).toBe('dropped.png');
      expect(el.querySelector('.keychain-photo__name')?.textContent?.trim()).toBe('dropped.png');
      expect(lastRender().paths).toHaveLength(1);
      expectInsideArea(lastRender().paths[0] ?? '', WHITE_TAG_PRINT_AREA);
    });

    it('clears the highlight after a drop', async () => {
      await create();
      drag('dragover');

      drag('drop', { types: ['Files'], files: [png()] });

      expect(dropzone().classList.contains('keychain-dropzone--active')).toBe(false);
    });

    it('uses only the first of several dropped files', async () => {
      await create();

      drag('drop', { types: ['Files'], files: [png('first.png'), png('second.png')] });
      await flush();

      expect(trace).toHaveBeenCalledTimes(1);
      expect((trace.mock.calls[0]?.[0] as File).name).toBe('first.png');
    });

    it('validates a dropped file like a chosen one', async () => {
      await create();

      drag('drop', { types: ['Files'], files: [new File(['x'], 'a.gif', { type: 'image/gif' })] });

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe(
        'Підтримуються лише PNG, JPG та WebP',
      );
      expect(trace).not.toHaveBeenCalled();
    });

    it('ignores a drop without files, but still stops the browser from opening it', async () => {
      await create();

      const event = drag('drop', { types: [], files: [] });

      expect(event.defaultPrevented).toBe(true);
      expect(trace).not.toHaveBeenCalled();
    });

    it('still works when the file is chosen through the dialog', async () => {
      await create();

      await chooseFile(png('chosen.png'));

      expect(el.querySelector('.keychain-photo__name')?.textContent?.trim()).toBe('chosen.png');
    });
  });

  describe('marks', () => {
    it('loads the chosen mark and puts it on the keychain', async () => {
      await create();

      await setSelect('markId-main', 'bmw');
      await flush();

      expect(loadMark).toHaveBeenCalledWith(
        { id: 'bmw', label: 'BMW', variants: { icon: 'marks/bmw/icon.svg' } },
        'icon',
      );
      expect(lastRender().paths).toHaveLength(1);
      expect(svgPaths()).toHaveLength(1);
    });

    it('shows a message while the mark is loading', async () => {
      loadMark.mockImplementation(() => new Promise<VectorGraphic>(() => undefined));
      await create();

      await setSelect('markId-main', 'bmw');

      expect(el.textContent).toContain('Завантаження марки…');
    });

    it('takes the mark off again when "Без марки" is chosen', async () => {
      await create();
      await setSelect('markId-main', 'bmw');
      await flush();

      await setSelect('markId-main', 'none');
      await flush();

      expect(lastRender().paths).toEqual([]);
    });

    it('shows an error and no artwork when the mark cannot be loaded', async () => {
      loadMark.mockRejectedValue(new Error('404'));
      await create();

      await setSelect('markId-main', 'bmw');
      await flush();

      expect(el.textContent).toContain('Не вдалося завантажити марку');
      expect(lastRender().paths).toEqual([]);
    });

    it('draws a mark made of even-odd paths with the even-odd rule in the canvas request', async () => {
      loadMark.mockResolvedValue({
        width: 400,
        height: 40,
        paths: [],
        evenOddPaths: ['M0 0L400 0L400 40Z'],
      });
      await create();

      await setSelect('markId-main', 'benelli');
      await flush();

      expect(lastRender().paths).toEqual([]);
      expect(lastRender().evenOddPaths).toHaveLength(1);
      expect(button('Завантажити SVG').disabled).toBe(false);
    });

    it('stacks the photo above the mark', async () => {
      await create();
      await chooseFile(png());
      await setSelect('markId-main', 'bmw');
      await flush();

      const paths = svgPaths();
      expect(paths).toHaveLength(2);
      const y = (path: string | null) => Number(/^M[\d.]+ ([\d.]+)/.exec(path ?? '')?.[1]);
      expect(y(paths[0] ?? null)).toBeLessThan(y(paths[1] ?? null));
    });

    it('offers no type select for a mark that only has one variant', async () => {
      await create();

      await setSelect('markId-main', 'bmw');
      await flush();

      expect(el.querySelector('#markVariant-main')).toBeNull();
    });

    it('offers Іконка/Текст/Іконка + текст for a mark with all three, defaulting to Іконка + текст', async () => {
      await create();

      await setSelect('markId-main', 'lifan');
      await flush();

      expect(options('markVariant-main')).toEqual(['Іконка', 'Текст', 'Іконка + текст']);
      expect(dropdownValue(fixture, 'markVariant-main')).toBe('combined');
    });

    it('loads every variant of the chosen mark once, so switching the type does not reload it', async () => {
      await create();
      await setSelect('markId-main', 'lifan');
      await flush();

      expect(loadMark.mock.calls.map((call) => call[1]).sort()).toEqual([
        'combined',
        'icon',
        'text',
      ]);
      loadMark.mockClear();
      await setSelect('markVariant-main', 'icon');
      await flush();

      expect(loadMark).not.toHaveBeenCalled();
    });

    it('lets each zone of a two-zone design have its own type of mark', async () => {
      await create();
      chooseDesign('metal-v-3');
      await settle();
      await setSelect('markId-main', 'lifan');
      await setSelect('markId-small', 'lifan');
      await flush();

      expect(dropdownValue(fixture, 'markVariant-main')).toBe('combined');
      expect(dropdownValue(fixture, 'markVariant-small')).toBe('combined');
      expect(
        Array.from(el.querySelectorAll('.keychain-card--mark .keychain-card__title')).map((title) =>
          title.textContent?.trim(),
        ),
      ).toEqual(['Марка · Основна зона', 'Марка · Мала зона']);

      await setSelect('markVariant-main', 'text');
      await setSelect('markVariant-small', 'icon');
      await flush();

      expect(dropdownValue(fixture, 'markVariant-main')).toBe('text');
      expect(dropdownValue(fixture, 'markVariant-small')).toBe('icon');
    });

    it('resets to the default variant when switching to a mark that lacks the current one', async () => {
      await create();
      await setSelect('markId-main', 'lifan');
      await flush();
      await setSelect('markVariant-main', 'text');
      await flush();

      await setSelect('markId-main', 'bmw');
      await flush();

      expect(loadMark).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'bmw' }), 'icon');
      expect(el.querySelector('#markVariant-main')).toBeNull();
    });

    it('keeps a variant that both marks share when switching between two combined marks', async () => {
      await create();
      await setSelect('markId-main', 'lifan');
      await flush();
      await setSelect('markVariant-main', 'text');
      await flush();

      await setSelect('markId-main', 'honda');
      await flush();

      expect(dropdownValue(fixture, 'markVariant-main')).toBe('text');
    });

    it('hides the type select again for a single-variant mark and shows it again for a multi-variant one', async () => {
      await create();
      await setSelect('markId-main', 'bmw');
      await flush();
      expect(el.querySelector('#markVariant-main')).toBeNull();

      await setSelect('markId-main', 'lifan');
      await flush();

      expect(el.querySelector('#markVariant-main')).not.toBeNull();
    });
  });

  describe('text', () => {
    it('draws the text as one more path', async () => {
      await create();

      await setInput('text', 'SR220 4V');

      expect(lastRender().paths).toHaveLength(1);
      expect(svgPaths()).toHaveLength(1);
    });

    it('loads the default font at start and the other one when it is chosen', async () => {
      await create();
      expect(loadFont).toHaveBeenCalledTimes(1);

      await setSelect('fontId', 'nunito');

      expect(loadFont).toHaveBeenCalledTimes(2);
    });

    it('lists characters missing from the font', async () => {
      await create();

      await setInput('text', 'AЖB');

      expect(el.textContent).toContain('У цьому шрифті немає символів: Ж');
    });

    it('shows an error when the font cannot be loaded', async () => {
      loadFont.mockRejectedValue(new Error('404'));
      await create();
      await flush();

      expect(el.textContent).toContain('Не вдалося завантажити шрифт');
    });
  });

  describe('text size', () => {
    const lastTextHeight = () => {
      const paths = lastRender().paths;
      const values = (paths.at(-1)?.match(/-?\d+(?:\.\d+)?/g) ?? [])
        .map(Number)
        .filter((_, index) => index % 2 === 1);
      return Math.max(...values) - Math.min(...values);
    };

    it('offers XS to XL and starts on M', async () => {
      await create();

      expect(options('textScaleId')).toEqual(['XS', 'S', 'M', 'L', 'XL']);
      expect(dropdownValue(fixture, 'textScaleId')).toBe('m');
    });

    it('shrinks and enlarges only the text, leaving the mark alone', async () => {
      await create();
      chooseDesign('metal-v-3');
      await settle();
      await setSelect('markId-small', 'bmw');
      await flush();
      await setInput('text', 'AB');
      const markSize = () => {
        const values = (lastRender().paths[0]?.match(/-?\d+(?:\.\d+)?/g) ?? [])
          .map(Number)
          .filter((_, index) => index % 2 === 0);
        return Math.max(...values) - Math.min(...values);
      };
      const markBefore = markSize();
      const standard = lastTextHeight();

      await setSelect('textScaleId', 'xs');
      const small = lastTextHeight();
      await setSelect('textScaleId', 'l');
      const large = lastTextHeight();

      expect(small).toBeCloseTo((standard * 0.52) / 0.91, 0);
      expect(large).toBeGreaterThan(standard);
      expect(markSize()).toBeCloseTo(markBefore, 6);
    });

    it('also resizes the text in the SVG artwork', async () => {
      await create();
      await setInput('text', 'A');
      const height = () => {
        const values = (svgPaths()[0]?.match(/-?\d+(?:\.\d+)?/g) ?? [])
          .map(Number)
          .filter((_, index) => index % 2 === 1);
        return Math.max(...values) - Math.min(...values);
      };
      const standard = height();

      await setSelect('textScaleId', 's');

      expect(height()).toBeLessThan(standard);
    });
  });

  describe('design and scale of each block', () => {
    const numbers = (path: string | undefined) =>
      (path?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const span = (path: string | undefined, axis: 0 | 1) => {
      const values = numbers(path).filter((_, index) => index % 2 === axis);
      return Math.max(...values) - Math.min(...values);
    };
    const designIdOf = (image: Element | null) =>
      /([^/]+)\.svg$/.exec(image?.getAttribute('src') ?? '')?.[1];
    const designNames = () =>
      Array.from(el.querySelectorAll('.keychain-design__image')).map((image) => designIdOf(image));
    const activeDesign = () =>
      designIdOf(el.querySelector('.keychain-design--active .keychain-design__image'));
    const cardTitles = () =>
      Array.from(el.querySelectorAll('.keychain-form .keychain-card__title')).map((title) =>
        title.textContent?.trim(),
      );

    it('offers the designs of the chosen type and starts with the first one', async () => {
      await create();

      expect(designNames()).toEqual([
        'metal-v-2',
        'metal-v-3',
        'metal-h-1',
        'metal-h-2',
        'metal-h-3',
        'metal-h-t',
        'metal-v-t',
        'metla-v-1',
      ]);
      expect(activeDesign()).toBe('metal-v-2');
    });

    it('offers the round designs for the circle subleather and the loop designs for leather', async () => {
      await create();

      await chooseKeychainType('subleather-circle');
      expect(designNames()).toEqual(['eco-round-v', 'eco-round-h']);
      expect(activeDesign()).toBe('eco-round-v');

      await chooseKeychainType('leather-black');
      expect(designNames()).toEqual(['loop-icon', 'loop']);
    });

    it('shows only the cards the chosen design has zones for', async () => {
      await create();
      expect(cardTitles()).toEqual(['Брелок', 'Зображення', 'Марка', 'Текст']);

      chooseDesign('metal-h-1');
      await settle();
      expect(cardTitles()).toEqual(['Брелок', 'Зображення']);

      await chooseKeychainType('subleather-mint');
      chooseDesign('eco-v');
      await settle();
      expect(cardTitles()).toEqual(['Брелок', 'Марка', 'Текст']);
    });

    it('gives every mark zone its own mark card, labelled with the zone, and a text zone select for two text zones', async () => {
      await create();
      expect(el.querySelectorAll('.keychain-card--mark')).toHaveLength(1);
      expect(el.querySelector('#textZoneId')).toBeNull();

      chooseDesign('metal-v-3');
      await settle();

      const titles = () =>
        Array.from(el.querySelectorAll('.keychain-card--mark .keychain-card__title')).map((title) =>
          title.textContent?.trim(),
        );
      expect(titles()).toEqual(['Марка · Основна зона', 'Марка · Мала зона']);
      expect(dropdownValue(fixture, 'textZoneId')).toBe('main');
    });

    it('draws a mark in each zone that has one, from its own card', async () => {
      await create();
      chooseDesign('metal-v-3');
      await settle();
      await setSelect('markId-main', 'bmw');
      await flush();
      const single = lastRender().paths.length;

      await setSelect('markId-small', 'bmw');
      await flush();

      expect(single).toBe(1);
      expect(lastRender().paths).toHaveLength(2);
    });

    it('keeps the mark when a text is added to the single zone of the design', async () => {
      await create();
      await chooseKeychainType('subleather-mint');
      chooseDesign('eco-v');
      await settle();
      await setSelect('markId-main', 'bmw');
      await flush();
      const markOnly = lastRender().paths;

      await setInput('text', 'AB');

      expect(lastRender().paths).toEqual(markOnly);
    });

    it('puts the text into the zone chosen in the text card', async () => {
      await create();
      chooseDesign('metal-v-3');
      await settle();
      await setInput('text', 'AB');
      const defaultZone = lastRender().paths[0];

      await setSelect('textZoneId', 'small');

      expect(lastRender().paths[0]).not.toBe(defaultZone);
    });

    it('scales the image on its own: XS is smaller than L', async () => {
      await create();
      await chooseFile(png());
      await flush();
      const standard = span(lastRender().paths[0], 0);

      await setSelect('photoScaleId', 'xs');

      expect(span(lastRender().paths[0], 0)).toBeLessThan(standard);
    });

    it('scales the mark on its own without touching the photo or the text', async () => {
      await create();
      chooseDesign('metal-v-3');
      await settle();
      await chooseFile(png());
      await setSelect('markId-small', 'lifan');
      await flush();
      await setInput('text', 'ABC');
      const before = lastRender().paths.map((path) => span(path, 0));

      await setSelect('markScaleId-small', 'xs');

      const after = lastRender().paths.map((path) => span(path, 0));
      expect(after[1]).toBeLessThan(before[1] ?? 0);
      expect(after[0]).toBeCloseTo(before[0] ?? 0, 0);
      expect(after[2]).toBeCloseTo(before[2] ?? 0, 0);
    });

    it('scales the SVG artwork too', async () => {
      await create();
      await chooseFile(png());
      await flush();
      const size = () => span(svgPaths()[0] ?? undefined, 0);
      const standard = size();

      await setSelect('photoScaleId', 's');

      expect(size()).toBeLessThan(standard);
    });
  });

  describe('SVG download', () => {
    it('blocks the download while there is no artwork', async () => {
      await create();

      expect(button('Завантажити SVG').disabled).toBe(true);
    });

    it('downloads the artwork as an SVG at full photo resolution', async () => {
      await create();
      await chooseFile(png());
      await flush();

      button('Завантажити SVG').click();

      const blob = createObjectURL.mock.calls.at(-1)?.[0] as Blob;
      expect(blob.type).toBe('image/svg+xml');
      expect(clickedAnchors[0]?.download).toBe('keychain-artwork.svg');
    });

    it('does not download anything when there is no artwork', async () => {
      await create();
      const before = createObjectURL.mock.calls.length;

      button('Завантажити SVG').click();

      expect(createObjectURL.mock.calls.length).toBe(before);
    });
  });

  describe('PNG download and copy', () => {
    it('downloads the assembled mock-up as a PNG named after the keychain type', async () => {
      await create();

      button('Завантажити PNG').click();
      await flush();

      expect(toPng).toHaveBeenCalledWith(el.querySelector('.keychain-canvas'));
      expect((createObjectURL.mock.calls.at(-1)?.[0] as Blob).type).toBe('image/png');
      expect(clickedAnchors[0]?.download).toBe('keychain-metal-white.png');
    });

    it('blocks both actions while a slow assembly is shown', async () => {
      render.mockImplementation(() => new Promise<void>(() => undefined));
      await create();
      await new Promise((resolve) => setTimeout(resolve, 250));
      await settle();

      expect(button('Завантажити PNG').disabled).toBe(true);
      expect(button('Копіювати').disabled).toBe(true);
    });

    it('does nothing when an action is triggered before the assembly has finished, even if the buttons are still enabled', async () => {
      render.mockImplementation(() => new Promise<void>(() => undefined));
      await create();

      button('Завантажити PNG').click();
      await flush();

      expect(toPng).not.toHaveBeenCalled();
    });

    it('shows an error when the PNG cannot be encoded', async () => {
      toPng.mockRejectedValue(new Error('encode'));
      await create();

      button('Завантажити PNG').click();
      await flush();

      expect(el.querySelector('.keychain-previews .error-text')?.textContent?.trim()).toBe(
        'Не вдалося створити PNG',
      );
    });

    describe('clipboard', () => {
      let clipboardWrite: ReturnType<typeof vi.fn>;
      let clipboardItems: { data: Record<string, Promise<Blob>> }[];

      beforeEach(() => {
        clipboardItems = [];
        clipboardWrite = vi.fn().mockResolvedValue(undefined);
        class FakeClipboardItem {
          constructor(public data: Record<string, Promise<Blob>>) {
            clipboardItems.push(this);
          }
        }
        vi.stubGlobal('ClipboardItem', FakeClipboardItem);
        Object.defineProperty(navigator, 'clipboard', {
          value: { write: clipboardWrite },
          configurable: true,
        });
      });

      it('copies the mock-up as an image instead of downloading it', async () => {
        await create();

        button('Копіювати').click();
        await flush();

        expect(clipboardWrite).toHaveBeenCalledTimes(1);
        expect(Object.keys(clipboardItems[0]?.data ?? {})).toEqual(['image/png']);
        expect(clickedAnchors).toHaveLength(0);
      });

      it('confirms with "Скопійовано" and goes back after two seconds', async () => {
        await create();
        vi.useFakeTimers();

        button('Копіювати').click();
        await vi.advanceTimersByTimeAsync(0);
        fixture.detectChanges();
        expect(button('Скопійовано')).toBeDefined();

        await vi.advanceTimersByTimeAsync(2000);
        fixture.detectChanges();
        expect(button('Копіювати')).toBeDefined();
      });

      it('shows an error when the clipboard refuses', async () => {
        clipboardWrite.mockRejectedValue(new Error('denied'));
        await create();

        button('Копіювати').click();
        await flush();

        expect(el.querySelector('.keychain-previews .error-text')?.textContent?.trim()).toBe(
          'Не вдалося скопіювати зображення',
        );
      });
    });
  });
});
