import { Answerable, d, Interaction } from '@serenity-js/core';
import { PlaywrightPage } from '@serenity-js/playwright';
import { PageElement } from '@serenity-js/web';

/** A file as a visitor would pick it: its name, its type and its bytes. */
export interface FileToUpload {
  name: string;
  mimeType: string;
  buffer: Answerable<Buffer>;
}

/**
 * Clicks `trigger` — the button a visitor presses to pick a file — and answers the browser's file
 * chooser with `file`, the way a person picks it in the dialog that opens. The counterpart of
 * `downloads.ts#CaptureTheDownloadTriggeredBy`, and the same narrowly-scoped drop to the native
 * Playwright page: Serenity/JS has no file-chooser interaction, and racing the click against the
 * `filechooser` event is the standard Playwright pattern. Going through the visible button rather
 * than the (usually hidden) `<input type="file">` behind it keeps the locator on the accessible
 * name a person reads.
 */
export const ChooseFileThrough = (
  trigger: Answerable<PageElement>,
  file: FileToUpload,
): Interaction =>
  Interaction.where(d`#actor picks the file "${file.name}"`, async (actor) => {
    const page = await actor.answer(PlaywrightPage.current());
    const nativePage = await page.nativePage();
    const element = await actor.answer(trigger);
    const buffer = await actor.answer(file.buffer);

    const [chooser] = await Promise.all([
      nativePage.waitForEvent('filechooser'),
      element.click(),
    ]);
    await chooser.setFiles({
      name: file.name,
      mimeType: file.mimeType,
      buffer,
    });
  });
