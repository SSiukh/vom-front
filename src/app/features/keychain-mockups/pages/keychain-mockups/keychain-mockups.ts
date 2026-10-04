import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  LucideCheck,
  LucideCopy,
  LucideDownload,
  LucideTrash2,
  LucideUpload,
} from '@lucide/angular';
import { catchError, forkJoin, from, map, of, startWith, switchMap, tap } from 'rxjs';
import { STICKER_FONTS } from '../../../sticker-generator/data/sticker-fonts';
import type { GlyphSource } from '../../../sticker-generator/models/glyph-source.model';
import { FontLibraryService } from '../../../sticker-generator/services/font-library.service';
import { MockupRenderer } from '../../../sticker-generator/services/mockup-renderer.service';
import { copyPngToClipboard } from '../../../sticker-generator/utils/copy-image';
import { downloadFile } from '../../../sticker-generator/utils/download-file';
import {
  DEFAULT_KEYCHAIN_SCALE_ID,
  DEFAULT_KEYCHAIN_TEXT_SCALE_ID,
  KEYCHAIN_SCALES,
  KEYCHAIN_TEXT_SCALES,
} from '../../data/keychain-scales';
import {
  Dropdown,
  dictionaryOptions,
  type DropdownOption,
} from '../../../../shared/ui/dropdown/dropdown';
import { RENDER_BUSY_DELAY_MS } from '../../data/keychain-config';
import {
  KEYCHAIN_FAMILY_LABELS,
  DEFAULT_KEYCHAIN_TYPE_ID,
  KEYCHAIN_TYPES,
  keychainSubtypeLabel,
} from '../../data/keychain-types';
import { GEMINI_APP_URL, GEMINI_PHOTO_PROMPT } from '../../data/gemini-photo-prompt';
import { KEYCHAIN_MARKS } from '../../data/keychain-marks';
import { designGroupOf, designsInGroup } from '../../data/keychain-designs';
import { PHOTO_ACCEPTED_TYPES } from '../../data/photo-upload';
import type {
  KeychainFamily,
  KeychainMark,
  KeychainType,
  MarkVariantKind,
  VectorGraphic,
} from '../../models/keychain.model';
import type { KeychainDesign, DesignSlot } from '../../models/keychain-design.model';
import { KeychainRenderer } from '../../services/keychain-renderer.service';
import { MarkLibrary } from '../../services/mark-library.service';
import { NO_INK_ERROR, PhotoTracer } from '../../services/photo-tracer.service';
import {
  availableVariants,
  defaultVariant,
  isMarkVariant,
  MARK_VARIANT_LABELS,
} from '../../utils/mark-variants';
import { exportArtworkSvg } from '../../utils/artwork-svg';
import {
  layoutDesign,
  resolveTextSlot,
  slotsAccepting,
  type MarkPlacement,
} from '../../utils/layout-design';
import { buildTextGraphic } from '../../utils/text-graphic';
import { validatePhoto } from '../../utils/validate-photo';

const MAX_TEXT_LENGTH = 40;
const COPIED_FEEDBACK_MS = 2000;
function factorOf(scales: readonly { id: string; factor: number }[], id: string): number {
  return scales.find((scale) => scale.id === id)?.factor ?? 1;
}

function zoneFactorOf(scales: readonly { id: string; factor: number }[], id: string): number {
  return factorOf(scales, id) / Math.max(...scales.map((scale) => scale.factor));
}

function samePaths(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((path, index) => path === right[index]);
}

const FAMILY_ORDER: readonly KeychainFamily[] = ['metal', 'subleather', 'leather'];

const MARK_CARD_KEYS = ['main', 'small', 'icon'] as const;
type MarkCardKey = (typeof MARK_CARD_KEYS)[number];

interface MarkCardItem {
  key: MarkCardKey;
  title: string;
  beforeText: boolean;
}

function isMarkCardKey(id: string): id is MarkCardKey {
  return (MARK_CARD_KEYS as readonly string[]).includes(id);
}

@Component({
  selector: 'app-keychain-mockups',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    Dropdown,
    LucideCheck,
    LucideCopy,
    LucideDownload,
    LucideTrash2,
    LucideUpload,
  ],
  templateUrl: './keychain-mockups.html',
  styleUrl: './keychain-mockups.css',
})
export class KeychainMockups {
  private readonly fb = inject(FormBuilder);
  private readonly fontLibrary = inject(FontLibraryService);
  private readonly photoTracer = inject(PhotoTracer);
  private readonly markLibrary = inject(MarkLibrary);
  private readonly renderer = inject(KeychainRenderer);
  private readonly mockupRenderer = inject(MockupRenderer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly previewCanvas = viewChild<ElementRef<HTMLCanvasElement>>('previewCanvas');
  private traceRun = 0;
  private renderInFlight = false;
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly keychainFamilyOptions: DropdownOption[] = FAMILY_ORDER.map((family) => ({
    value: family,
    label: KEYCHAIN_FAMILY_LABELS[family],
  }));
  protected readonly keychainSubtypeOptions = computed<DropdownOption[]>(() =>
    KEYCHAIN_TYPES.filter((type) => type.family === this.keychainType().family).map((type) => ({
      value: type.id,
      label: keychainSubtypeLabel(type),
    })),
  );
  private readonly marks = KEYCHAIN_MARKS;
  protected readonly markOptions: DropdownOption[] = [
    { value: 'none', label: 'Без марки' },
    ...dictionaryOptions(KEYCHAIN_MARKS),
  ];
  protected readonly fontOptions = dictionaryOptions(STICKER_FONTS);
  protected readonly imageScaleOptions = dictionaryOptions(KEYCHAIN_SCALES);
  protected readonly textScaleOptions = dictionaryOptions(KEYCHAIN_TEXT_SCALES);
  protected readonly maxTextLength = MAX_TEXT_LENGTH;
  protected readonly acceptedPhotoTypes = PHOTO_ACCEPTED_TYPES.join(',');

  protected readonly form = this.fb.nonNullable.group({
    keychainTypeId: [DEFAULT_KEYCHAIN_TYPE_ID],
    designId: [''],
    markCards: this.fb.nonNullable.group({
      main: this.markCardGroup(),
      small: this.markCardGroup(),
      icon: this.markCardGroup(),
    }),
    photoScaleId: [DEFAULT_KEYCHAIN_SCALE_ID],
    text: [''],
    fontId: [STICKER_FONTS[0]?.id ?? ''],
    textScaleId: [DEFAULT_KEYCHAIN_TEXT_SCALE_ID],
    textZoneId: [''],
  });

  private readonly values = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { requireSync: true },
  );

  protected readonly photo = signal<File | null>(null);
  protected readonly photoUrl = signal<string | null>(null);
  protected readonly photoError = signal<string | null>(null);
  protected readonly dragging = signal(false);
  protected readonly tracing = signal(false);
  protected readonly traceError = signal<string | null>(null);
  private readonly tracedPhoto = signal<VectorGraphic | null>(null);

  private readonly markGraphics = signal<
    Record<MarkCardKey, Partial<Record<MarkVariantKind, VectorGraphic>>>
  >({ main: {}, small: {}, icon: {} });
  protected readonly markLoading = signal(false);
  protected readonly markError = signal<string | null>(null);

  private readonly glyphs = signal<GlyphSource | null>(null);
  protected readonly fontLoading = signal(false);
  protected readonly fontError = signal<string | null>(null);

  protected readonly rendering = signal(false);
  protected readonly renderError = signal<string | null>(null);
  protected readonly copied = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly geminiError = signal<string | null>(null);

  protected readonly keychainType = computed<KeychainType>(
    () =>
      KEYCHAIN_TYPES.find((type) => type.id === this.values().keychainTypeId) ??
      (KEYCHAIN_TYPES[0] as KeychainType),
  );

  private markCardGroup() {
    return this.fb.nonNullable.group({
      markId: ['none'],
      variantId: [''],
      scaleId: [DEFAULT_KEYCHAIN_SCALE_ID],
    });
  }

  protected markCardOf(key: MarkCardKey) {
    return this.form.controls.markCards.controls[key];
  }

  protected selectedMarkFor(key: MarkCardKey): KeychainMark | null {
    return this.marks.find((mark) => mark.id === this.values().markCards[key].markId) ?? null;
  }

  protected markVariantOptionsFor(key: MarkCardKey): DropdownOption[] {
    return availableVariants(this.selectedMarkFor(key)).map((variant) => ({
      value: variant,
      label: MARK_VARIANT_LABELS[variant],
    }));
  }

  private readonly textResult = computed(() => {
    const glyphs = this.glyphs();
    const text = this.values().text.trim();
    return glyphs && text
      ? buildTextGraphic(text, glyphs)
      : { graphic: null, missingCharacters: [] };
  });

  protected readonly missingCharacters = computed(() => this.textResult().missingCharacters);

  protected readonly selectedGroup = computed(() => designGroupOf(this.keychainType()));
  protected readonly groupDesigns = computed(() => designsInGroup(this.selectedGroup()));
  protected readonly selectedDesign = computed<KeychainDesign>(() => {
    const designs = this.groupDesigns();
    return (
      designs.find((design) => design.id === this.values().designId) ??
      (designs[0] as KeychainDesign)
    );
  });
  protected readonly photoEnabled = computed(() => this.selectedDesign().photo !== null);
  protected readonly markSlots = computed(() => slotsAccepting(this.selectedDesign(), 'mark'));
  protected readonly textSlots = computed(() => slotsAccepting(this.selectedDesign(), 'text'));
  protected readonly markEnabled = computed(() => this.markSlots().length > 0);
  protected readonly textEnabled = computed(() => this.textSlots().length > 0);
  protected readonly markCards = computed<MarkCardItem[]>(() => {
    const slots = this.markSlots();
    return slots.flatMap((slot, index) =>
      isMarkCardKey(slot.id)
        ? [
            {
              key: slot.id,
              title: slots.length > 1 ? `Марка · ${slot.label}` : 'Марка',
              beforeText: index === 0 || slot.metal === true,
            },
          ]
        : [],
    );
  });
  protected readonly resolvedTextSlotId = computed(
    () => resolveTextSlot(this.selectedDesign(), this.values().textZoneId || null)?.id ?? '',
  );
  private readonly placedMarks = computed<Partial<Record<string, MarkPlacement>>>(() => {
    const graphics = this.markGraphics();
    const placed: Partial<Record<string, MarkPlacement>> = {};
    for (const slot of this.markSlots()) {
      if (!isMarkCardKey(slot.id)) {
        continue;
      }
      const card = this.values().markCards[slot.id];
      const variant = this.variantFor(slot.id);
      const graphic = variant ? graphics[slot.id][variant] : undefined;
      if (graphic && card.markId !== 'none') {
        placed[slot.id] = { graphic, factor: zoneFactorOf(KEYCHAIN_SCALES, card.scaleId) };
      }
    }
    return placed;
  });

  protected readonly artwork = computed(() =>
    layoutDesign({
      design: this.selectedDesign(),
      area: this.keychainType().printArea,
      photo: this.tracedPhoto(),
      marks: this.placedMarks(),
      text: this.textResult().graphic,
      textSlotId: this.values().textZoneId || null,
      scales: {
        photo: zoneFactorOf(KEYCHAIN_SCALES, this.values().photoScaleId),
        text: zoneFactorOf(KEYCHAIN_TEXT_SCALES, this.values().textScaleId),
      },
    }),
  );

  private readonly artworkPaths = computed(() => this.artwork().paths, { equal: samePaths });
  private readonly artworkMetalPaths = computed(() => this.artwork().metalPaths ?? [], {
    equal: samePaths,
  });
  private readonly artworkMetalEvenOddPaths = computed(
    () => this.artwork().metalEvenOddPaths ?? [],
    {
      equal: samePaths,
    },
  );
  private readonly artworkEvenOddPaths = computed(() => this.artwork().evenOddPaths, {
    equal: samePaths,
  });

  protected readonly hasArtwork = computed(
    () =>
      this.artworkPaths().length +
        this.artworkEvenOddPaths().length +
        this.artworkMetalPaths().length +
        this.artworkMetalEvenOddPaths().length >
      0,
  );
  protected readonly ink = computed(() => this.keychainType().inkColor);
  protected readonly canExport = computed(() => !this.rendering() && !this.renderError());

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.traceRun++;
      this.releasePhotoUrl();
      this.clearCopiedTimer();
    });
    for (const key of MARK_CARD_KEYS) {
      this.watchMark(key);
    }
    this.watchFont();
    this.watchRender();
  }

  protected async openGeminiPhoto(): Promise<void> {
    this.geminiError.set(null);
    const copy = this.copyGeminiPrompt();
    const tab = window.open(GEMINI_APP_URL, '_blank');
    if (tab) {
      tab.opener = null;
    } else {
      this.geminiError.set(
        'Браузер заблокував нову вкладку. Дозвольте спливаючі вікна для цього сайту.',
      );
    }
    try {
      await copy;
    } catch {
      this.geminiError.set('Не вдалося скопіювати текст промпту. Скопіюйте його вручну.');
    }
  }

  private async copyGeminiPrompt(): Promise<void> {
    await navigator.clipboard.writeText(GEMINI_PHOTO_PROMPT);
  }

  protected selectDesign(id: string): void {
    this.form.controls.designId.setValue(id);
  }

  protected setMarkVariant(key: MarkCardKey, value: string): void {
    if (isMarkVariant(value)) {
      this.markCardOf(key).controls.variantId.setValue(value);
    }
  }

  protected onTextZoneChange(slotId: string): void {
    this.form.controls.textZoneId.setValue(slotId);
  }

  protected slotOptions(slots: readonly DesignSlot[]): DropdownOption[] {
    return slots.map((slot) => ({ value: slot.id, label: slot.label }));
  }

  protected onFamilyChange(family: string): void {
    const first = KEYCHAIN_TYPES.find((type) => type.family === family);
    if (first) {
      this.form.controls.keychainTypeId.setValue(first.id);
    }
  }

  protected selectPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.acceptPhoto(file);
    }
  }

  protected onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    this.dragging.set(true);
  }

  protected onDragLeave(): void {
    this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.acceptPhoto(file);
    }
  }

  private acceptPhoto(file: File): void {
    const error = validatePhoto(file);
    if (error) {
      this.photoError.set(error);
      return;
    }
    this.releasePhotoUrl();
    this.photoError.set(null);
    this.photo.set(file);
    this.photoUrl.set(URL.createObjectURL(file));
    this.tracePhoto(file);
  }

  protected removePhoto(): void {
    this.traceRun++;
    this.releasePhotoUrl();
    this.photo.set(null);
    this.photoError.set(null);
    this.tracedPhoto.set(null);
    this.tracing.set(false);
    this.traceError.set(null);
  }

  protected downloadPng(): void {
    const canvas = this.previewCanvas()?.nativeElement;
    if (!canvas || !this.canExport() || this.renderInFlight) {
      return;
    }
    this.actionError.set(null);
    this.mockupRenderer
      .toPng(canvas)
      .then((blob) => downloadFile(`keychain-${this.keychainType().id}.png`, blob, 'image/png'))
      .catch(() => this.actionError.set('Не вдалося створити PNG'));
  }

  protected async copyPng(): Promise<void> {
    const canvas = this.previewCanvas()?.nativeElement;
    if (!canvas || !this.canExport() || this.renderInFlight) {
      return;
    }
    this.actionError.set(null);
    try {
      await copyPngToClipboard(() => this.mockupRenderer.toPng(canvas));
    } catch {
      this.actionError.set('Не вдалося скопіювати зображення');
      return;
    }
    this.clearCopiedTimer();
    this.copied.set(true);
    this.copiedTimer = setTimeout(() => this.copied.set(false), COPIED_FEEDBACK_MS);
  }

  protected downloadSvg(): void {
    if (!this.hasArtwork()) {
      return;
    }
    downloadFile(
      'keychain-artwork.svg',
      exportArtworkSvg(this.artwork(), this.ink(), this.keychainType().inkOpacity ?? 1),
      'image/svg+xml',
    );
  }

  private tracePhoto(file: File): void {
    const run = ++this.traceRun;
    this.tracedPhoto.set(null);
    this.traceError.set(null);
    this.tracing.set(true);
    this.photoTracer
      .trace(file)
      .then((graphic) => {
        if (run === this.traceRun) {
          this.tracedPhoto.set(graphic);
          this.tracing.set(false);
        }
      })
      .catch((error: unknown) => {
        if (run === this.traceRun) {
          this.tracing.set(false);
          this.traceError.set(
            error instanceof Error && error.message === NO_INK_ERROR
              ? 'На фото не знайдено темних ліній. Потрібне чорно-біле зображення.'
              : 'Не вдалося обробити фото',
          );
        }
      });
  }

  private watchMark(key: MarkCardKey): void {
    const markId = this.markCardOf(key).controls.markId;
    markId.valueChanges
      .pipe(
        startWith(markId.value),
        tap(() => {
          this.markError.set(null);
          this.setMarkGraphics(key, {});
        }),
        switchMap(() => {
          const mark = this.marks.find((candidate) => candidate.id === markId.value);
          const variants = availableVariants(mark ?? null);
          if (!mark || variants.length === 0) {
            return of({});
          }
          this.markLoading.set(true);
          return forkJoin(
            variants.map((variant) =>
              from(this.markLibrary.load(mark, variant)).pipe(
                map((graphic) => [variant, graphic] as const),
              ),
            ),
          ).pipe(
            map(
              (entries) =>
                Object.fromEntries(entries) as Partial<Record<MarkVariantKind, VectorGraphic>>,
            ),
            catchError(() => {
              this.markError.set('Не вдалося завантажити марку');
              return of({});
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((graphics) => {
        this.markLoading.set(false);
        this.setMarkGraphics(key, graphics);
      });
  }

  private setMarkGraphics(
    key: MarkCardKey,
    graphics: Partial<Record<MarkVariantKind, VectorGraphic>>,
  ): void {
    this.markGraphics.update((current) => ({ ...current, [key]: graphics }));
  }

  protected variantFor(key: MarkCardKey): MarkVariantKind | null {
    const mark = this.selectedMarkFor(key);
    const variants = availableVariants(mark);
    const explicit = this.values().markCards[key].variantId;
    if (isMarkVariant(explicit) && variants.includes(explicit)) {
      return explicit;
    }
    return defaultVariant(mark);
  }

  private watchFont(): void {
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

  private watchRender(): void {
    effect((onCleanup) => {
      const canvas = this.previewCanvas()?.nativeElement;
      const type = this.keychainType();
      const paths = this.artworkPaths();
      const evenOddPaths = this.artworkEvenOddPaths();
      const metalPaths = this.artworkMetalPaths();
      const metalEvenOddPaths = this.artworkMetalEvenOddPaths();
      const ink = type.inkColor;
      const blend = type.inkBlend;
      const opacity = type.inkOpacity ?? 1;
      if (!canvas) {
        return;
      }
      const controller = new AbortController();
      const busyTimer = setTimeout(() => this.rendering.set(true), RENDER_BUSY_DELAY_MS);
      onCleanup(() => {
        controller.abort();
        clearTimeout(busyTimer);
      });
      this.renderInFlight = true;
      this.renderError.set(null);
      const finish = (error: string | null): void => {
        if (controller.signal.aborted) {
          return;
        }
        clearTimeout(busyTimer);
        this.renderInFlight = false;
        this.rendering.set(false);
        this.renderError.set(error);
      };
      this.renderer
        .render(
          canvas,
          {
            imageUrl: type.imageUrl,
            paths,
            evenOddPaths,
            ink,
            blend,
            opacity,
            metalPaths,
            metalEvenOddPaths,
          },
          controller.signal,
        )
        .then(() => finish(null))
        .catch(() => finish('Не вдалося зібрати макет'));
    });
  }

  private releasePhotoUrl(): void {
    const url = this.photoUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.photoUrl.set(null);
    }
  }

  private clearCopiedTimer(): void {
    if (this.copiedTimer !== null) {
      clearTimeout(this.copiedTimer);
      this.copiedTimer = null;
    }
  }
}
