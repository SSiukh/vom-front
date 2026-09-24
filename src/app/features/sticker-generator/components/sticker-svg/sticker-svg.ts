import { Component, computed, input } from '@angular/core';
import type { StickerDocument } from '../../models/sticker.model';
import { formatNumber } from '../../utils/path-data';

@Component({
  selector: 'app-sticker-svg',
  templateUrl: './sticker-svg.html',
  styleUrl: './sticker-svg.css',
})
export class StickerSvg {
  readonly document = input.required<StickerDocument>();
  readonly label = input.required<string>();

  protected readonly viewBox = computed(() => {
    const document = this.document();
    return `0 0 ${formatNumber(document.width)} ${formatNumber(document.height)}`;
  });
}
