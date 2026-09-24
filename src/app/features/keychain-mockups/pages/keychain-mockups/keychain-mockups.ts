import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LucideCopy, LucideDownload, LucideTrash2 } from '@lucide/angular';
import { STICKER_FONTS } from '../../../sticker-generator/data/sticker-fonts';
import { STICKER_ICONS } from '../../../sticker-generator/data/sticker-icons';
import type { IconChoice } from '../../../sticker-generator/models/sticker.model';
import { KEYCHAIN_TYPES } from '../../data/keychain-types';
import { PHOTO_ACCEPTED_TYPES } from '../../data/photo-upload';
import { validatePhoto } from '../../utils/validate-photo';

const MAX_TEXT_LENGTH = 40;

@Component({
  selector: 'app-keychain-mockups',
  imports: [ReactiveFormsModule, LucideCopy, LucideDownload, LucideTrash2],
  templateUrl: './keychain-mockups.html',
  styleUrl: './keychain-mockups.css',
})
export class KeychainMockups {
  private readonly fb = inject(FormBuilder);

  protected readonly keychainTypes = KEYCHAIN_TYPES;
  protected readonly logos = STICKER_ICONS;
  protected readonly fonts = STICKER_FONTS;
  protected readonly maxTextLength = MAX_TEXT_LENGTH;
  protected readonly acceptedPhotoTypes = PHOTO_ACCEPTED_TYPES.join(',');

  protected readonly form = this.fb.nonNullable.group({
    keychainTypeId: [''],
    logoId: ['none' as IconChoice],
    text: [''],
    fontId: [STICKER_FONTS[0]?.id ?? ''],
  });

  protected readonly photo = signal<File | null>(null);
  protected readonly photoUrl = signal<string | null>(null);
  protected readonly photoError = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.releasePhotoUrl());
  }

  protected selectPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const error = validatePhoto(file);
    if (error) {
      this.photoError.set(error);
      return;
    }
    this.releasePhotoUrl();
    this.photoError.set(null);
    this.photo.set(file);
    this.photoUrl.set(URL.createObjectURL(file));
  }

  protected removePhoto(): void {
    this.releasePhotoUrl();
    this.photo.set(null);
    this.photoError.set(null);
  }

  private releasePhotoUrl(): void {
    const url = this.photoUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.photoUrl.set(null);
    }
  }
}
