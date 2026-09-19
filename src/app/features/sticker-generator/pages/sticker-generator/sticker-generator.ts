import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LucideDownload, LucidePlus, LucideTrash2 } from '@lucide/angular';
import { catchError, from, map, of, startWith, switchMap, tap } from 'rxjs';
import { MAX_MOCKUP_STICKERS } from '../../data/mockup-config';
import { DEFAULT_SIZE_PRESET_ID, SIZE_PRESETS } from '../../data/size-presets';
import { STICKER_FONTS } from '../../data/sticker-fonts';
import { STICKER_ICONS } from '../../data/sticker-icons';
import type { GlyphSource } from '../../models/glyph-source.model';
import type { MockupSticker } from '../../models/mockup.model';
import type { IconChoice, StickerDocument } from '../../models/sticker.model';
import { FontLibraryService } from '../../services/font-library.service';
import { MockupRenderer } from '../../services/mockup-renderer.service';
import { MIN_READABLE_CONTRAST, contrastRatio } from '../../utils/contrast';
import { downloadFile } from '../../utils/download-file';
import { buildFileName } from '../../utils/file-name';
import { layoutSticker } from '../../utils/layout-sticker';
import { formatNumber } from '../../utils/path-data';
import { exportSvg } from '../../utils/svg-export';

const MAX_TEXT_LENGTH = 40;
const DEFAULT_TEXT = 'username';
const MOCKUP_FILE_NAME = 'sticker-mockup.png';

@Component({
  selector: 'app-sticker-generator',
  imports: [ReactiveFormsModule, LucideDownload, LucidePlus, LucideTrash2],
  templateUrl: './sticker-generator.html',
  styleUrl: './sticker-generator.css',
})
export class StickerGenerator {
  private readonly fb = inject(FormBuilder);
  private readonly fontLibrary = inject(FontLibraryService);
  private readonly mockupRenderer = inject(MockupRenderer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mockupCanvas = viewChild<ElementRef<HTMLCanvasElement>>('mockupCanvas');
  private nextMockupId = 1;

  protected readonly fonts = STICKER_FONTS;
  protected readonly icons = STICKER_ICONS;
  protected readonly presets = SIZE_PRESETS;
  protected readonly maxTextLength = MAX_TEXT_LENGTH;
  protected readonly maxMockupStickers = MAX_MOCKUP_STICKERS;

  protected readonly form = this.fb.nonNullable.group({
    text: [DEFAULT_TEXT],
    fontId: [STICKER_FONTS[0]?.id ?? ''],
    iconId: ['instagram' as IconChoice],
    presetId: [DEFAULT_SIZE_PRESET_ID],
    background: ['#000000'],
    artwork: ['#ffffff'],
  });

  protected readonly glyphs = signal<GlyphSource | null>(null);
  protected readonly fontLoading = signal(false);
  protected readonly fontError = signal<string | null>(null);

  private readonly values = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { requireSync: true },
  );

  protected readonly layout = computed(() => {
    const glyphs = this.glyphs();
    if (!glyphs) {
      return null;
    }
    const values = this.values();
    const preset = SIZE_PRESETS.find((candidate) => candidate.id === values.presetId) ?? SIZE_PRESETS[0];
    if (!preset) {
      return null;
    }
    const icon = STICKER_ICONS.find((candidate) => candidate.id === values.iconId) ?? null;
    return layoutSticker({ text: values.text, glyphs, icon, preset });
  });

  protected readonly stickerDocument = computed<StickerDocument | null>(() => {
    const layout = this.layout();
    if (!layout) {
      return null;
    }
    const values = this.values();
    return {
      width: layout.width,
      height: layout.height,
      cornerRadius: 0,
      background: values.background,
      artwork: values.artwork,
      artPaths: layout.artPaths,
    };
  });

  protected readonly missingCharacters = computed(() => this.layout()?.missingCharacters ?? []);
  protected readonly isEmpty = computed(() => this.layout()?.artPaths.length === 0);
  protected readonly lowContrast = computed(() => {
    const values = this.values();
    return contrastRatio(values.background, values.artwork) < MIN_READABLE_CONTRAST;
  });
  protected readonly previewLabel = computed(() => {
    const text = this.values().text.trim();
    return text ? `Попередній перегляд наклейки: ${text}` : 'Попередній перегляд наклейки';
  });
  protected readonly canDownload = computed(
    () =>
      !this.fontLoading() &&
      this.stickerDocument() !== null &&
      !this.isEmpty() &&
      this.missingCharacters().length === 0 &&
      this.values().text.length <= MAX_TEXT_LENGTH,
  );

  protected readonly mockupStickers = signal<readonly MockupSticker[]>([]);
  protected readonly mockupRendering = signal(false);
  protected readonly mockupError = signal<string | null>(null);
  protected readonly pngError = signal<string | null>(null);
  protected readonly canAddToMockup = computed(() => this.canDownload() && this.mockupStickers().length < MAX_MOCKUP_STICKERS);
  protected readonly canDownloadMockup = computed(() => this.mockupStickers().length > 0 && !this.mockupRendering() && !this.mockupError());

  constructor() {
    effect((onCleanup) => {
      const canvas = this.mockupCanvas()?.nativeElement;
      const stickers = this.mockupStickers();
      if (stickers.length === 0) {
        this.mockupRendering.set(false);
        this.mockupError.set(null);
        this.pngError.set(null);
        return;
      }
      if (!canvas) {
        return;
      }
      const controller = new AbortController();
      onCleanup(() => controller.abort());
      this.mockupRendering.set(true);
      this.mockupError.set(null);
      this.mockupRenderer
        .render(canvas, stickers, controller.signal)
        .then(() => {
          if (!controller.signal.aborted) {
            this.mockupRendering.set(false);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            this.mockupRendering.set(false);
            this.mockupError.set('Не вдалося зібрати макет на фото');
          }
        });
    });

    this.form.controls.fontId.valueChanges
      .pipe(
        startWith(this.form.controls.fontId.value),
        tap(() => {
          this.fontLoading.set(true);
          this.fontError.set(null);
        }),
        switchMap((fontId) => {
          const font = STICKER_FONTS.find((candidate) => candidate.id === fontId);
          if (!font) {
            return of(null);
          }
          return from(this.fontLibrary.load(font)).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((glyphs) => {
        this.fontLoading.set(false);
        this.glyphs.set(glyphs);
        if (!glyphs) {
          this.fontError.set('Не вдалося завантажити шрифт');
        }
      });
  }

  protected download(): void {
    const sticker = this.stickerDocument();
    if (!sticker || !this.canDownload()) {
      return;
    }
    const values = this.values();
    downloadFile(buildFileName(values.text, values.presetId), exportSvg(sticker), 'image/svg+xml');
  }

  protected addToMockup(): void {
    const document = this.stickerDocument();
    if (!document || !this.canAddToMockup()) {
      return;
    }
    const values = this.values();
    const preset = SIZE_PRESETS.find((candidate) => candidate.id === values.presetId);
    if (!preset) {
      return;
    }
    const sticker: MockupSticker = {
      id: this.nextMockupId++,
      label: values.text.trim() || 'Лише іконка',
      presetId: preset.id,
      presetWidth: preset.width,
      presetHeight: preset.height,
      fileName: buildFileName(values.text, preset.id),
      document,
    };
    this.mockupStickers.update((stickers) => [...stickers, sticker]);
  }

  protected removeFromMockup(id: number): void {
    this.mockupStickers.update((stickers) => stickers.filter((sticker) => sticker.id !== id));
  }

  protected downloadMockupSticker(sticker: MockupSticker): void {
    downloadFile(sticker.fileName, exportSvg(sticker.document), 'image/svg+xml');
  }

  protected async downloadMockup(): Promise<void> {
    const canvas = this.mockupCanvas()?.nativeElement;
    if (!canvas || !this.canDownloadMockup()) {
      return;
    }
    this.pngError.set(null);
    try {
      downloadFile(MOCKUP_FILE_NAME, await this.mockupRenderer.toPng(canvas), 'image/png');
    } catch {
      this.pngError.set('Не вдалося створити PNG');
    }
  }

  protected viewBox(sticker: StickerDocument): string {
    return `0 0 ${formatNumber(sticker.width)} ${formatNumber(sticker.height)}`;
  }
}
