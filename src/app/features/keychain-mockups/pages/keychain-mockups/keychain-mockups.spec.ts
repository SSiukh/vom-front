import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { GlyphSource } from '../../../sticker-generator/models/glyph-source.model';
import { FontLibraryService } from '../../../sticker-generator/services/font-library.service';
import { MockupRenderer } from '../../../sticker-generator/services/mockup-renderer.service';
import type { VectorGraphic } from '../../models/keychain.model';
import { KeychainRenderer } from '../../services/keychain-renderer.service';
import { MarkLibrary } from '../../services/mark-library.service';
import { NO_INK_ERROR, PhotoTracer } from '../../services/photo-tracer.service';
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
const PHOTO_ON_WHITE_TAG = 'M652.64 990.64L875.36 990.64L875.36 1213.36Z';

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
  const png = (name = 'bike.png', size = 100) => new File([new Uint8Array(size)], name, { type: 'image/png' });
  const chooseFile = async (file: File) => {
    Object.defineProperty(photoInput(), 'files', { value: [file], configurable: true });
    photoInput().dispatchEvent(new Event('change'));
    await settle();
  };
  const setSelect = async (id: string, value: string) => {
    const select = el.querySelector(`#${id}`) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await settle();
  };
  const setInput = async (id: string, value: string) => {
    const input = el.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const options = (id: string) => Array.from(el.querySelectorAll(`#${id} option`)).map((option) => option.textContent?.trim());
  const button = (text: string) =>
    Array.from(el.querySelectorAll('button')).find((candidate) => candidate.textContent?.includes(text)) as HTMLButtonElement;
  const lastRender = () =>
    render.mock.calls.at(-1)?.[1] as { imageUrl: string; paths: string[]; evenOddPaths: string[]; ink: string; blend: string };
  const svgPaths = () => Array.from(el.querySelectorAll('.keychain-svg__preview path')).map((path) => path.getAttribute('d'));

  beforeEach(() => {
    createObjectURL = vi.fn().mockReturnValue('blob:photo-1');
    revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    clickedAnchors = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
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
    it('shows the page title and puts the form on the left and the results on the right', async () => {
      await create();

      expect(el.querySelector('.page-title')?.textContent?.trim()).toBe('Брелки');
      const layout = el.querySelector('.keychain-layout') as HTMLElement;
      expect(layout.children[0]?.classList.contains('keychain-form')).toBe(true);
      expect(layout.children[1]?.classList.contains('keychain-results')).toBe(true);
    });

    it('puts the SVG block right after the mock-up block', async () => {
      await create();

      const results = el.querySelector('.keychain-results') as HTMLElement;
      expect(results.children[0]?.classList.contains('keychain-previews')).toBe(true);
      expect(results.children[1]?.classList.contains('keychain-svg')).toBe(true);
    });

    it('splits the settings into separate cards for the keychain, the image, the mark and the text', async () => {
      await create();

      const cards = Array.from(el.querySelectorAll('.keychain-form > .keychain-card'));
      expect(cards.map((card) => card.querySelector('.keychain-card__title')?.textContent?.trim())).toEqual([
        'Брелок',
        'Зображення',
        'Марка',
        'Текст',
      ]);
      const ids = (card: Element | undefined) =>
        Array.from(card?.querySelectorAll('select, input') ?? [])
          .map((control) => control.id)
          .filter(Boolean);
      expect(ids(cards[0])).toEqual(['keychainTypeId']);
      expect(ids(cards[1])).toEqual(['photo', 'photoScaleId', 'photoOrientation']);
      expect(ids(cards[2])).toEqual(['markId', 'markScaleId', 'markOrientation']);
      expect(ids(cards[3])).toEqual(['text', 'fontId', 'textScaleId', 'textOrientation']);
    });

    it('makes every card a panel of its own, all inside the one form', async () => {
      await create();

      const form = el.querySelector('form.keychain-form') as HTMLFormElement;
      expect(form.querySelectorAll('.form-panel.keychain-card')).toHaveLength(4);
      expect(form.classList.contains('form-panel')).toBe(false);
    });

    it('keeps the reserved block for mock-up styles', async () => {
      await create();

      expect(el.textContent).toContain('Стилі макета буде додано пізніше.');
    });
  });

  describe('form', () => {
    it('groups the thirteen keychain types by family, starting with metal', async () => {
      await create();

      const groups = Array.from(el.querySelectorAll('#keychainTypeId optgroup')).map((group) => group.getAttribute('label'));
      expect(groups).toEqual(['Металевий жетон', 'Екошкіра', 'Шкіряна петля']);
      expect(el.querySelectorAll('#keychainTypeId option')).toHaveLength(13);
      expect((el.querySelector('#keychainTypeId') as HTMLSelectElement).value).toBe('metal-white');
    });

    it('offers every mark, or none, and the two sticker fonts', async () => {
      await create();

      expect(options('markId')?.[0]).toBe('Без марки');
      expect(el.querySelectorAll('#markId option')).toHaveLength(37);
      expect(options('fontId')).toEqual(['Jua', 'Nunito (кирилиця)']);
    });

    it('starts without a mark, with empty text limited to 40 characters', async () => {
      await create();

      expect((el.querySelector('#markId') as HTMLSelectElement).value).toBe('none');
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

    it('offers the two orientations separately for the image, the mark and the text, all starting horizontal', async () => {
      await create();

      for (const id of ['photoOrientation', 'markOrientation', 'textOrientation']) {
        expect(options(id)).toEqual(['Горизонтально', 'Вертикально (повернуто на 90°)']);
        expect((el.querySelector(`#${id}`) as HTMLSelectElement).value).toBe('horizontal');
      }
    });

    it('offers XS to XL separately for the image, the mark and the text, starting on L, L and M', async () => {
      await create();

      for (const [id, start] of [
        ['photoScaleId', 'l'],
        ['markScaleId', 'l'],
        ['textScaleId', 'm'],
      ]) {
        expect(options(id ?? '')).toEqual(['XS', 'S', 'M', 'L', 'XL']);
        expect((el.querySelector(`#${id}`) as HTMLSelectElement).value).toBe(start);
      }
    });

    it('has no overall scale or orientation any more', async () => {
      await create();

      expect(el.querySelector('#contentScaleId')).toBeNull();
      expect(el.querySelector('#orientation')).toBeNull();
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
      });
    });

    it('renders the other photo with the fixed ink of that type when the type changes', async () => {
      await create();

      await setSelect('keychainTypeId', 'metal-black');
      expect(lastRender().imageUrl).toBe('keychains/metal-black.jpg');
      expect([lastRender().ink, lastRender().blend]).toEqual(['#ffffff', 'source-over']);

      await setSelect('keychainTypeId', 'subleather-mint');
      expect([lastRender().ink, lastRender().blend]).toEqual(['#6f4a2b', 'multiply']);

      await setSelect('keychainTypeId', 'leather-black');
      expect([lastRender().ink, lastRender().blend]).toEqual(['#6f4a2b', 'source-over']);
    });

    it('renders again when the scale or the orientation changes', async () => {
      await create();
      await setInput('text', 'A');
      const before = lastRender().paths[0];

      await setSelect('textScaleId', 'xs');
      const smaller = lastRender().paths[0];
      await setSelect('textOrientation', 'vertical');
      const rotated = lastRender().paths[0];

      expect(smaller).not.toBe(before);
      expect(rotated).not.toBe(smaller);
    });

    it('shows a loading overlay only when assembling takes longer than a moment', async () => {
      render.mockImplementation(() => new Promise<void>(() => undefined));
      await create();
      expect(el.querySelector('.keychain-loading')).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 250));
      await settle();

      expect(el.querySelector('.keychain-canvas-wrap .keychain-loading')?.textContent?.trim()).toBe('Збираємо макет…');
    });

    it('never flashes the loading overlay or the disabled buttons for a quick redraw', async () => {
      await create();
      const seen: boolean[] = [];
      const observer = new MutationObserver(() => seen.push(el.querySelector('.keychain-loading') !== null));
      observer.observe(el, { childList: true, subtree: true });

      await setSelect('keychainTypeId', 'metal-black');
      await setSelect('keychainTypeId', 'leather-brown');
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

      expect(el.querySelector('.keychain-previews .error-text')?.textContent?.trim()).toBe('Не вдалося зібрати макет');
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
      expect((el.querySelector('.keychain-photo__image') as HTMLImageElement).getAttribute('src')).toBe('blob:photo-1');
      expect(el.querySelector('.keychain-photo__name')?.textContent?.trim()).toBe('bike.png');
      expect(lastRender().paths).toEqual([PHOTO_ON_WHITE_TAG]);
      expect(svgPaths()).toEqual([PHOTO_ON_WHITE_TAG]);
    });

    it('shows a processing message while the photo is being traced', async () => {
      trace.mockImplementation(() => new Promise<VectorGraphic>(() => undefined));
      await create();

      await chooseFile(png());

      expect(el.querySelector('.keychain-photo ~ .loading-text')?.textContent?.trim()).toBe('Обробка фото…');
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
      trace.mockImplementationOnce(() => new Promise<VectorGraphic>((resolve) => (resolveFirst = resolve)));
      trace.mockResolvedValueOnce({ width: 50, height: 100, paths: ['M0 0L50 0L50 100Z'] });
      await create();
      await chooseFile(png('first.png'));
      createObjectURL.mockReturnValue('blob:photo-2');
      await chooseFile(png('second.png'));
      await flush();

      resolveFirst(PHOTO);
      await flush();

      expect(svgPaths()).toHaveLength(1);
      expect(svgPaths()[0]).not.toBe(PHOTO_ON_WHITE_TAG);
    });

    it('rejects an unsupported file type without tracing', async () => {
      await create();

      await chooseFile(new File(['x'], 'a.gif', { type: 'image/gif' }));

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Підтримуються лише PNG, JPG та WebP');
      expect(trace).not.toHaveBeenCalled();
      expect(el.querySelector('.keychain-photo')).toBeNull();
    });

    it('rejects a photo above 10 MB', async () => {
      await create();

      await chooseFile(png('big.png', 10 * 1024 * 1024 + 1));

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Файл завеликий, максимум 10 МБ');
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

  describe('photo drop zone', () => {
    const dropzone = () => el.querySelector('.keychain-dropzone') as HTMLElement;
    const drag = (type: 'dragover' | 'dragleave' | 'drop', dataTransfer: unknown = { types: ['Files'], files: [] }) => {
      const event = Object.assign(new Event(type, { bubbles: true, cancelable: true }), { dataTransfer });
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
      expect(lastRender().paths).toEqual([PHOTO_ON_WHITE_TAG]);
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

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Підтримуються лише PNG, JPG та WebP');
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

      await setSelect('markId', 'bmw');
      await flush();

      expect(loadMark).toHaveBeenCalledWith({ id: 'bmw', label: 'BMW', variants: { icon: 'marks/bmw/icon.svg' } }, 'icon');
      expect(lastRender().paths).toHaveLength(1);
      expect(svgPaths()).toHaveLength(1);
    });

    it('shows a message while the mark is loading', async () => {
      loadMark.mockImplementation(() => new Promise<VectorGraphic>(() => undefined));
      await create();

      await setSelect('markId', 'bmw');

      expect(el.textContent).toContain('Завантаження марки…');
    });

    it('takes the mark off again when "Без марки" is chosen', async () => {
      await create();
      await setSelect('markId', 'bmw');
      await flush();

      await setSelect('markId', 'none');
      await flush();

      expect(lastRender().paths).toEqual([]);
    });

    it('shows an error and no artwork when the mark cannot be loaded', async () => {
      loadMark.mockRejectedValue(new Error('404'));
      await create();

      await setSelect('markId', 'bmw');
      await flush();

      expect(el.textContent).toContain('Не вдалося завантажити марку');
      expect(lastRender().paths).toEqual([]);
    });

    it('draws a mark made of even-odd paths with the even-odd rule in the preview and the canvas request', async () => {
      loadMark.mockResolvedValue({ width: 400, height: 40, paths: [], evenOddPaths: ['M0 0L400 0L400 40Z'] });
      await create();

      await setSelect('markId', 'benelli');
      await flush();

      expect(lastRender().paths).toEqual([]);
      expect(lastRender().evenOddPaths).toHaveLength(1);
      const previewPath = el.querySelector('.keychain-svg__preview path') as SVGPathElement;
      expect(previewPath.getAttribute('fill-rule')).toBe('evenodd');
      expect(button('Завантажити SVG').disabled).toBe(false);
    });

    it('stacks the photo above the mark', async () => {
      await create();
      await chooseFile(png());
      await setSelect('markId', 'bmw');
      await flush();

      const paths = svgPaths();
      expect(paths).toHaveLength(2);
      const y = (path: string | null) => Number(/^M[\d.]+ ([\d.]+)/.exec(path ?? '')?.[1]);
      expect(y(paths[0] ?? null)).toBeLessThan(y(paths[1] ?? null));
    });

    it('offers no variant select for a mark that only has one variant', async () => {
      await create();

      await setSelect('markId', 'bmw');
      await flush();

      expect(el.querySelector('#markVariantId')).toBeNull();
    });

    it('offers Разом/Значок/Напис for a mark with all three, defaulting to Разом', async () => {
      await create();

      await setSelect('markId', 'lifan');
      await flush();

      expect(options('markVariantId')).toEqual(['Разом', 'Значок', 'Напис']);
      expect((el.querySelector('#markVariantId') as HTMLSelectElement).value).toBe('combined');
    });

    it('loads a different file when another variant is chosen for the same mark', async () => {
      await create();
      await setSelect('markId', 'lifan');
      await flush();
      loadMark.mockClear();

      await setSelect('markVariantId', 'icon');
      await flush();

      expect(loadMark).toHaveBeenCalledWith(expect.objectContaining({ id: 'lifan' }), 'icon');
    });

    it('resets to the default variant when switching to a mark that lacks the current one', async () => {
      await create();
      await setSelect('markId', 'lifan');
      await flush();
      await setSelect('markVariantId', 'text');
      await flush();

      await setSelect('markId', 'bmw');
      await flush();

      expect(loadMark).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'bmw' }), 'icon');
    });

    it('keeps a variant that both marks share when switching between two combined marks', async () => {
      await create();
      await setSelect('markId', 'lifan');
      await flush();
      await setSelect('markVariantId', 'text');
      await flush();
      loadMark.mockClear();

      await setSelect('markId', 'honda');
      await flush();

      expect((el.querySelector('#markVariantId') as HTMLSelectElement).value).toBe('text');
      expect(loadMark).toHaveBeenCalledWith(expect.objectContaining({ id: 'honda' }), 'text');
    });

    it('hides the variant select again for a single-variant mark and shows it again for a multi-variant one', async () => {
      await create();
      await setSelect('markId', 'bmw');
      await flush();
      expect(el.querySelector('#markVariantId')).toBeNull();

      await setSelect('markId', 'lifan');
      await flush();

      expect(el.querySelector('#markVariantId')).not.toBeNull();
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
      const values = (paths.at(-1)?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter((_, index) => index % 2 === 1);
      return Math.max(...values) - Math.min(...values);
    };

    it('offers XS to XL and starts on M', async () => {
      await create();

      expect(options('textScaleId')).toEqual(['XS', 'S', 'M', 'L', 'XL']);
      expect((el.querySelector('#textScaleId') as HTMLSelectElement).value).toBe('m');
    });

    it('shrinks and enlarges only the text, leaving the mark alone', async () => {
      await create();
      await setSelect('markId', 'bmw');
      await flush();
      await setInput('text', 'AB');
      const markSize = () => {
        const values = (lastRender().paths[0]?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter((_, index) => index % 2 === 0);
        return Math.max(...values) - Math.min(...values);
      };
      const markBefore = markSize();
      const standard = lastTextHeight();

      await setSelect('textScaleId', 'xs');
      const small = lastTextHeight();
      await setSelect('textScaleId', 'l');
      const large = lastTextHeight();

      expect(small).toBeCloseTo((standard * 0.4) / 0.7, 0);
      expect(large).toBeGreaterThan(standard);
      expect(markSize()).toBeCloseTo(markBefore, 6);
    });

    it('also resizes the text in the SVG artwork', async () => {
      await create();
      await setInput('text', 'A');
      const height = () => {
        const values = (svgPaths()[0]?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter((_, index) => index % 2 === 1);
        return Math.max(...values) - Math.min(...values);
      };
      const standard = height();

      await setSelect('textScaleId', 's');

      expect(height()).toBeLessThan(standard);
    });
  });

  describe('orientation and scale of each block', () => {
    const numbers = (path: string | undefined) => (path?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const span = (path: string | undefined, axis: 0 | 1) => {
      const values = numbers(path).filter((_, index) => index % 2 === axis);
      return Math.max(...values) - Math.min(...values);
    };

    it('turns the mark a quarter turn with its own orientation, so it becomes taller than wide', async () => {
      await create();
      await setSelect('markId', 'bmw');
      await flush();
      const upright = lastRender().paths[0];

      await setSelect('markOrientation', 'vertical');

      const rotated = lastRender().paths[0];
      expect(span(rotated, 1) / span(rotated, 0)).toBeCloseTo(span(upright, 0) / span(upright, 1), 1);
      expect(rotated).not.toBe(upright);
    });

    it('turns only that block: the traced photo stays upright when the mark is turned', async () => {
      await create();
      await chooseFile(png());
      await setSelect('markId', 'bmw');
      await flush();
      const before = lastRender().paths.length;

      await setSelect('markOrientation', 'vertical');

      expect(lastRender().paths).toHaveLength(before);
      const photo = lastRender().paths[0];
      expect(span(photo, 0)).toBeCloseTo(span(photo, 1), 0);
    });

    it('turns the traced photo with the image orientation', async () => {
      trace.mockResolvedValue({ width: 100, height: 200, paths: ['M0 0L100 0L100 200Z'] });
      await create();
      await chooseFile(png());
      await flush();
      const upright = lastRender().paths[0];
      expect(span(upright, 1)).toBeGreaterThan(span(upright, 0));

      await setSelect('photoOrientation', 'vertical');

      const turned = lastRender().paths[0];
      expect(span(turned, 0)).toBeGreaterThan(span(turned, 1));
    });

    it('turns the text on its own too: a wide line of text becomes a tall one', async () => {
      await create();
      await setInput('text', 'ABCDEF');
      const before = lastRender().paths[0];
      expect(span(before, 0)).toBeGreaterThan(span(before, 1));

      await setSelect('textOrientation', 'vertical');

      const turned = lastRender().paths[0];
      expect(span(turned, 1)).toBeGreaterThan(span(turned, 0));
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
      await chooseFile(png());
      await setSelect('markId', 'lifan');
      await flush();
      await setInput('text', 'ABC');
      const before = lastRender().paths.map((path) => span(path, 0));

      await setSelect('markScaleId', 'xs');

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

  describe('SVG block', () => {
    it('asks for content and blocks the download while there is no artwork', async () => {
      await create();

      expect(el.querySelector('.keychain-svg .keychain-reserved')?.textContent).toContain('Додайте фото, марку або текст');
      expect(button('Завантажити SVG').disabled).toBe(true);
    });

    it('previews the artwork in the ink of the keychain type, on a dark background for the white ink', async () => {
      await create();
      await setInput('text', 'A');
      expect((el.querySelector('.keychain-svg__preview g') as SVGGElement).getAttribute('fill')).toBe('#000000');
      expect(el.querySelector('.keychain-svg__preview--dark')).toBeNull();

      await setSelect('keychainTypeId', 'metal-black');

      expect((el.querySelector('.keychain-svg__preview g') as SVGGElement).getAttribute('fill')).toBe('#ffffff');
      expect(el.querySelector('.keychain-svg__preview--dark')).not.toBeNull();
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

      expect(el.querySelector('.keychain-previews .error-text')?.textContent?.trim()).toBe('Не вдалося створити PNG');
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
        Object.defineProperty(navigator, 'clipboard', { value: { write: clipboardWrite }, configurable: true });
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

        expect(el.querySelector('.keychain-previews .error-text')?.textContent?.trim()).toBe('Не вдалося скопіювати зображення');
      });
    });
  });
});
