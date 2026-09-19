import { ComponentFixture, TestBed } from '@angular/core/testing';
import { STICKER_FONTS } from '../../data/sticker-fonts';
import type { GlyphSource } from '../../models/glyph-source.model';
import { FontLibraryService } from '../../services/font-library.service';
import { MockupRenderer } from '../../services/mockup-renderer.service';
import { StickerGenerator } from './sticker-generator';

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

describe('StickerGenerator', () => {
  let fixture: ComponentFixture<StickerGenerator>;
  let el: HTMLElement;
  let load: ReturnType<typeof vi.fn>;
  let render: ReturnType<typeof vi.fn>;
  let toPng: ReturnType<typeof vi.fn>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let clickedAnchors: HTMLAnchorElement[];

  const create = async (loader: () => Promise<GlyphSource> = () => Promise.resolve(GLYPHS)) => {
    load = vi.fn(loader);
    TestBed.configureTestingModule({
      imports: [StickerGenerator],
      providers: [
        { provide: FontLibraryService, useValue: { load } },
        { provide: MockupRenderer, useValue: { render, toPng } },
      ],
    });
    fixture = TestBed.createComponent(StickerGenerator);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  const setInput = (id: string, value: string) => {
    const input = el.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const setSelect = (id: string, value: string) => {
    const select = el.querySelector(`#${id}`) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  const downloadButton = () => el.querySelector('.page-header .btn-primary') as HTMLButtonElement;
  const svg = () => el.querySelector('.sticker-preview__svg') as SVGSVGElement;
  const addButton = () => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Додати на фото')) as HTMLButtonElement;
  const pngButton = () => Array.from(el.querySelectorAll('.page-header button')).find((b) => b.textContent?.includes('PNG')) as HTMLButtonElement;
  const mockupItems = () => Array.from(el.querySelectorAll('.mockup-card'));
  const canvas = () => el.querySelector('.mockup-canvas') as HTMLCanvasElement | null;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const addSticker = async () => {
    addButton().click();
    await settle();
  };
  const paths = () => Array.from(el.querySelectorAll('.sticker-preview__svg path'));

  beforeEach(() => {
    render = vi.fn().mockResolvedValue(undefined);
    toPng = vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    createObjectURL = vi.fn().mockReturnValue('blob:sticker');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    clickedAnchors = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedAnchors.push(this);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loading the font', () => {
    it('requests the default font on start', async () => {
      await create();

      expect(load).toHaveBeenCalledTimes(1);
      expect(load).toHaveBeenCalledWith(STICKER_FONTS[0]);
    });

    it('shows a loading message and no preview while the font is loading', async () => {
      await create(() => new Promise<GlyphSource>(() => undefined));

      expect(el.querySelector('.loading-text')?.textContent?.trim()).toBe('Завантаження шрифту…');
      expect(svg()).toBeNull();
      expect(downloadButton().disabled).toBe(true);
    });

    it('shows an error and disables download when the font cannot be loaded', async () => {
      await create(() => Promise.reject(new Error('404')));

      expect(el.querySelector('.error-text')?.textContent?.trim()).toBe('Не вдалося завантажити шрифт');
      expect(svg()).toBeNull();
      expect(downloadButton().disabled).toBe(true);
    });
  });

  describe('controls', () => {
    it('offers the font, icon and size choices', async () => {
      await create();

      const labels = (id: string) =>
        Array.from(el.querySelectorAll(`#${id} option`)).map((option) => option.textContent?.trim());
      expect(labels('fontId')).toEqual(['Jua']);
      expect(labels('iconId')).toEqual(['Без іконки', 'Instagram', 'TikTok']);
      expect(labels('presetId')).toEqual(['10 × 2', '13 × 2', '16 × 3', '18 × 4', '20 × 4', '22 × 5', '25 × 5']);
    });

    it('starts with Instagram, the 18 x 4 size and white artwork on a black background', async () => {
      await create();

      expect((el.querySelector('#iconId') as HTMLSelectElement).value).toBe('instagram');
      expect((el.querySelector('#presetId') as HTMLSelectElement).value).toBe('18x4');
      expect((el.querySelector('#background') as HTMLInputElement).value).toBe('#000000');
      expect((el.querySelector('#artwork') as HTMLInputElement).value).toBe('#ffffff');
    });

    it('limits the text input length', async () => {
      await create();

      expect(el.querySelector('#text')?.getAttribute('maxlength')).toBe('40');
    });
  });

  describe('preview', () => {
    it('renders the sticker with the preset proportions', async () => {
      await create();

      expect(svg().getAttribute('viewBox')).toBe('0 0 1000 222.222');
      expect(svg().getAttribute('role')).toBe('img');
    });

    it('draws the three Instagram paths plus one compound text path by default', async () => {
      await create();

      expect(paths()).toHaveLength(4);
    });

    it('never uses innerHTML-style output: paths come from bound attributes only', async () => {
      await create();

      for (const path of paths()) {
        expect(path.getAttribute('d')).toMatch(/^M[MLHVCQZ\d\s,.eE+-]+$/);
      }
    });

    it('redraws the text path when the text changes', async () => {
      await create();
      const before = paths().at(-1)?.getAttribute('d');

      setInput('text', 'other');

      expect(paths().at(-1)?.getAttribute('d')).not.toBe(before);
    });

    it('drops the icon paths when "Без іконки" is chosen and adds TikTok\'s single path on request', async () => {
      await create();

      setSelect('iconId', 'none');
      expect(paths()).toHaveLength(1);

      setSelect('iconId', 'tiktok');
      expect(paths()).toHaveLength(2);
    });

    it('changes the canvas when another size is chosen', async () => {
      await create();

      setSelect('presetId', '10x2');

      expect(svg().getAttribute('viewBox')).toBe('0 0 1000 200');
    });

    it('applies the chosen background and artwork colours', async () => {
      await create();

      setInput('background', '#112233');
      setInput('artwork', '#ff8800');

      expect(svg().querySelector('rect')?.getAttribute('fill')).toBe('#112233');
      expect(svg().querySelector('g')?.getAttribute('fill')).toBe('#ff8800');
    });
  });

  describe('warnings', () => {
    it('lists characters missing from the font and blocks download', async () => {
      await create();

      setInput('text', 'AЖ');

      expect(el.querySelector('.error-text')?.textContent).toContain('Ж');
      expect(downloadButton().disabled).toBe(true);
    });

    it('asks for input and blocks download when there is nothing to draw', async () => {
      await create();

      setSelect('iconId', 'none');
      setInput('text', '');

      expect(el.querySelector('.sticker-hint')?.textContent?.trim()).toBe('Введіть текст або оберіть іконку.');
      expect(downloadButton().disabled).toBe(true);
    });

    it('still allows a sticker with only an icon', async () => {
      await create();

      setInput('text', '');

      expect(el.querySelector('.sticker-hint')).toBeNull();
      expect(downloadButton().disabled).toBe(false);
    });

    it('warns when background and artwork colours are almost the same', async () => {
      await create();
      expect(el.querySelector('.sticker-warning')).toBeNull();

      setInput('background', '#336699');
      setInput('artwork', '#336699');

      expect(el.querySelector('.sticker-warning')).not.toBeNull();
    });

    it('blocks download when the text is longer than allowed', async () => {
      await create();

      setInput('text', 'a'.repeat(41));

      expect(downloadButton().disabled).toBe(true);
    });
  });

  describe('download', () => {
    it('is enabled for the default sticker', async () => {
      await create();

      expect(downloadButton().disabled).toBe(false);
    });

    it('downloads an SVG file named after the text and size', async () => {
      await create();

      downloadButton().click();

      const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
      expect(blob.type).toBe('image/svg+xml');
      expect(blob.size).toBeGreaterThan(0);
      expect(clickedAnchors).toHaveLength(1);
      expect(clickedAnchors[0]?.download).toBe('sticker-username-18x4.svg');
    });

    it('is blocked while a font is being loaded, even if the previous glyphs are still known', async () => {
      await create();
      load.mockImplementation(() => new Promise<GlyphSource>(() => undefined));

      (fixture.componentInstance as unknown as { form: { controls: { fontId: { setValue(v: string): void } } } }).form.controls.fontId.setValue(
        STICKER_FONTS[0]?.id ?? '',
      );
      fixture.detectChanges();

      expect(downloadButton().disabled).toBe(true);
    });

    it('does nothing while the download is blocked', async () => {
      await create();
      setInput('text', 'AЖ');

      downloadButton().click();

      expect(createObjectURL).not.toHaveBeenCalled();
    });
  });

  describe('mock-up on a photo', () => {
    it('starts empty, without a canvas, and with the PNG download blocked', async () => {
      await create();

      expect(el.querySelector('.mockup-panel .field-label')?.textContent?.trim()).toBe('Макет на фото (0 / 5)');
      expect(canvas()).toBeNull();
      expect(pngButton().disabled).toBe(true);
      expect(render).not.toHaveBeenCalled();
    });

    it('snapshots the current sticker into the list and renders the canvas', async () => {
      await create();

      await addSticker();

      expect(mockupItems()).toHaveLength(1);
      expect(mockupItems()[0]?.textContent).toContain('username · 18 × 4');
      expect(el.querySelector('.mockup-panel .field-label')?.textContent?.trim()).toBe('Макет на фото (1 / 5)');
      expect(canvas()).not.toBeNull();
      expect(render).toHaveBeenCalledTimes(1);
      const [target, stickers] = render.mock.calls[0] as [HTMLCanvasElement, { presetWidth: number; presetHeight: number; fileName: string }[]];
      expect(target).toBe(canvas());
      expect(stickers).toHaveLength(1);
      expect(stickers[0]).toMatchObject({ presetWidth: 18, presetHeight: 4, fileName: 'sticker-username-18x4.svg' });
    });

    it('previews each added sticker in a card with its colours and paths', async () => {
      await create();
      setInput('background', '#e8871e');
      setInput('artwork', '#000000');
      await addSticker();

      const card = mockupItems()[0] as HTMLElement;
      const preview = card.querySelector('.mockup-card__preview') as SVGSVGElement;
      expect(preview.getAttribute('viewBox')).toBe('0 0 1000 222.222');
      expect(preview.querySelector('rect')?.getAttribute('fill')).toBe('#e8871e');
      expect(preview.querySelector('g')?.getAttribute('fill')).toBe('#000000');
      expect(preview.querySelectorAll('path')).toHaveLength(4);
    });

    it('keeps the added sticker unchanged when the form changes afterwards', async () => {
      await create();
      await addSticker();

      setInput('text', 'other');
      setSelect('presetId', '25x5');
      await settle();

      expect(mockupItems()[0]?.textContent).toContain('username · 18 × 4');
    });

    it('labels an icon-only sticker', async () => {
      await create();
      setInput('text', '');

      await addSticker();

      expect(mockupItems()[0]?.textContent).toContain('Лише іконка · 18 × 4');
    });

    it('blocks adding when the current sticker cannot be downloaded', async () => {
      await create();
      setInput('text', 'AЖ');

      expect(addButton().disabled).toBe(true);
    });

    it('accepts at most five stickers', async () => {
      await create();

      for (let count = 0; count < 5; count++) {
        await addSticker();
      }

      expect(mockupItems()).toHaveLength(5);
      expect(addButton().disabled).toBe(true);
      addButton().click();
      await settle();
      expect(mockupItems()).toHaveLength(5);
    });

    it('removes a sticker and drops the canvas with the last one', async () => {
      await create();
      await addSticker();
      await addSticker();

      (mockupItems()[0]?.querySelector('.btn-outline-danger') as HTMLButtonElement).click();
      await settle();
      expect(mockupItems()).toHaveLength(1);
      expect(render).toHaveBeenCalledTimes(3);

      (mockupItems()[0]?.querySelector('.btn-outline-danger') as HTMLButtonElement).click();
      await settle();
      expect(mockupItems()).toHaveLength(0);
      expect(canvas()).toBeNull();
      expect(pngButton().disabled).toBe(true);
    });

    it('downloads each sticker on its own as SVG', async () => {
      await create();
      await addSticker();

      (mockupItems()[0]?.querySelector('.btn-ghost') as HTMLButtonElement).click();

      const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
      expect(blob.type).toBe('image/svg+xml');
      expect(clickedAnchors[0]?.download).toBe('sticker-username-18x4.svg');
    });

    it('downloads the whole mock-up as a PNG once rendering has finished', async () => {
      await create();
      await addSticker();
      expect(pngButton().disabled).toBe(false);

      pngButton().click();
      await settle();

      expect(toPng).toHaveBeenCalledWith(canvas());
      expect((createObjectURL.mock.calls[0]?.[0] as Blob).type).toBe('image/png');
      expect(clickedAnchors[0]?.download).toBe('sticker-mockup.png');
    });

    it('blocks the PNG download while the mock-up is rendering', async () => {
      await create();
      render.mockImplementation(() => new Promise<void>(() => undefined));

      await addSticker();

      expect(el.querySelector('.loading-text')?.textContent?.trim()).toBe('Збираємо макет…');
      expect(pngButton().disabled).toBe(true);
    });

    it('shows an error and blocks the PNG when the mock-up cannot be rendered', async () => {
      await create();
      render.mockRejectedValue(new Error('no photo'));

      await addSticker();
      await new Promise((resolve) => setTimeout(resolve));
      await settle();

      expect(el.querySelector('.mockup-panel .error-text')?.textContent?.trim()).toBe('Не вдалося зібрати макет на фото');
      expect(pngButton().disabled).toBe(true);
    });

    it('shows an error when the PNG cannot be encoded', async () => {
      await create();
      await addSticker();
      toPng.mockRejectedValue(new Error('encode'));

      pngButton().click();
      await settle();

      expect(el.querySelector('.mockup-panel .error-text')?.textContent?.trim()).toBe('Не вдалося створити PNG');
      expect(createObjectURL).not.toHaveBeenCalled();
    });

    it('allows retrying the PNG after an encoding failure', async () => {
      await create();
      await addSticker();
      toPng.mockRejectedValueOnce(new Error('encode'));
      pngButton().click();
      await settle();

      expect(pngButton().disabled).toBe(false);
      pngButton().click();
      await settle();

      expect(el.querySelector('.mockup-panel .error-text')).toBeNull();
      expect(clickedAnchors[0]?.download).toBe('sticker-mockup.png');
    });
  });
});
