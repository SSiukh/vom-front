const PNG_MIME_TYPE = 'image/png';

export async function copyPngToClipboard(createPng: () => Promise<Blob>): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || typeof navigator.clipboard?.write !== 'function') {
    throw new Error('Copying images is not supported in this browser');
  }
  await navigator.clipboard.write([new ClipboardItem({ [PNG_MIME_TYPE]: createPng() })]);
}
