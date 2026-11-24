import { Answerable, d, Interaction } from '@serenity-js/core';
import { PlaywrightPage } from '@serenity-js/playwright';
import { create as encodeQr } from 'qrcode';

/**
 * A camera the browser can be pointed at things with. The product reads QR codes from
 * `navigator.mediaDevices.getUserMedia({ video: … })` through `@zxing/browser`, and has no test hook
 * — nor should it. So this replaces `getUserMedia` itself, before any page script runs, with a
 * stream captured from an off-screen `<canvas>`; "showing the camera" a payload means drawing its
 * QR code onto that canvas, and the product's real decoder reads it off the frames like any other.
 *
 * The same narrowly-scoped drop to the native Playwright page as `uploads.ts` and `downloads.ts`:
 * Serenity/JS has no init-script interaction, and this is the one place the suite runs its own
 * code in the page.
 *
 * **Secure context.** `navigator.mediaDevices` exists only in a secure context. The suite browses
 * the frontend at `http://localhost:4201` (`support/config.ts`), and `localhost` is one, so Chromium
 * already has it; the script still defines `navigator.mediaDevices` when it is missing, so a
 * non-localhost `APP_BASE_URL` would work too. No `--unsafely-treat-insecure-origin-as-secure` flag.
 */

/** The page-side handle the init script leaves on `window`. */
const HANDLE = '__cablanFakeCamera';

/** A QR code's modules, row by row. */
interface QrPicture {
  size: number;
  /** `size * size` cells, 1 = dark. */
  modules: number[];
}

/**
 * Runs in the page, on every document the actor's browser context opens, before the page's own
 * scripts. Self-contained: Playwright serialises it, so it may close over nothing.
 */
function installFakeCamera(handle: string): void {
  const page = window as unknown as Record<string, unknown>;
  if (page[handle]) {
    return;
  }
  const width = 640;
  const height = 480;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  // Nothing (a white frame), or the same code in several mask patterns, held in turn.
  let pictures: QrPicture[] = [];
  let tick = 0;
  // ~700 ms per picture: longer than the decoder's 500 ms between reads, so each one is read.
  const ticksPerPicture = 7;

  const paint = (): void => {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    if (pictures.length === 0) {
      return;
    }
    const picture =
      pictures[Math.floor(tick / ticksPerPicture) % pictures.length];
    // Large, on white, with a quiet zone of four modules all round.
    const quietZone = 4;
    const cells = picture.size + 2 * quietZone;
    const cell = Math.floor((Math.min(width, height) - 20) / cells);
    const originX = Math.floor((width - cells * cell) / 2) + quietZone * cell;
    const originY = Math.floor((height - cells * cell) / 2) + quietZone * cell;
    context.fillStyle = '#000000';
    for (let row = 0; row < picture.size; row++) {
      for (let column = 0; column < picture.size; column++) {
        if (picture.modules[row * picture.size + column]) {
          context.fillRect(
            originX + column * cell,
            originY + row * cell,
            cell,
            cell,
          );
        }
      }
    }
  };
  paint();
  // A canvas stream only carries a frame when the canvas is drawn on; keep drawing, so the video
  // never starves whenever the product starts reading it.
  setInterval(() => {
    tick++;
    paint();
  }, 100);

  const getUserMedia = (): Promise<MediaStream> =>
    Promise.resolve(canvas.captureStream(10));

  const nav = navigator as unknown as { mediaDevices?: MediaDevices };
  if (!nav.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {},
      configurable: true,
    });
  }
  const devices = navigator.mediaDevices as unknown as Record<string, unknown>;
  devices.getUserMedia = getUserMedia;
  devices.enumerateDevices = () =>
    Promise.resolve([
      {
        deviceId: 'cablan-fake-camera',
        groupId: 'cablan-fake-camera',
        kind: 'videoinput',
        label: 'Cablan fake camera',
        toJSON: () => ({}),
      },
    ]);

  page[handle] = {
    show: (next: QrPicture[]) => {
      pictures = next;
      tick = 0;
      paint();
    },
  };
}

/**
 * Gives the actor's browser the fake camera, for every page it opens from now on. Install it
 * **before** navigating to the page that scans; installing it twice is harmless.
 */
export const InstallTheFakeCamera = (): Interaction =>
  Interaction.where(
    '#actor gets a camera to point at things',
    async (actor) => {
      const page = await actor.answer(PlaywrightPage.current());
      const nativePage = await page.nativePage();
      await nativePage.context().addInitScript(installFakeCamera, HANDLE);
    },
  );

const MASK_PATTERNS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/**
 * The QR code of `payload`, as the modules the in-page painter draws — once in the mask pattern the
 * encoder picks, then in each of the other seven.
 *
 * Why more than one: the product's decoder (`@zxing/library`'s `QRCodeReader`, which
 * `@zxing/browser` runs on every frame) fails on about 5% of codes drawn perfectly square, sharp and
 * upright — a pure picture no real camera produces — and fails on the same code every time, at
 * any module size or position (it threw `ChecksumException` for one equipment's id in a CI run, so
 * that scan never completed). It fails on a matrix, not on a payload: that code decoded in all seven
 * other mask patterns, and in a sample of 600 random ids every code that failed decoded in at least
 * one other mask. Every mask pattern carries the same payload, so the product reads the same text.
 */
const qrPicturesOf = (payload: string): QrPicture[] => {
  const chosen = encodeQr(payload, { errorCorrectionLevel: 'M' });
  const others = MASK_PATTERNS.filter(
    (maskPattern) => maskPattern !== chosen.maskPattern,
  ).map((maskPattern) =>
    encodeQr(payload, { errorCorrectionLevel: 'M', maskPattern }),
  );
  return [chosen, ...others].map(({ modules }) => ({
    size: modules.size,
    modules: Array.from(modules.data),
  }));
};

/**
 * Holds a QR code of `payload` in front of the fake camera — what a person does with the sticker on
 * the equipment. The page must have been opened after `InstallTheFakeCamera`. The code is shown in
 * each mask pattern in turn (`qrPicturesOf`), one every ~700 ms, so a full round takes about 6 s.
 */
export const ShowTheCameraTheQrOf = (
  payload: Answerable<string>,
): Interaction =>
  Interaction.where(
    d`#actor holds ${payload} up to the camera`,
    async (actor) => {
      const text = await actor.answer(payload);
      const page = await actor.answer(PlaywrightPage.current());
      const nativePage = await page.nativePage();
      await nativePage.evaluate(
        ([handle, pictures]) => {
          const camera = (window as unknown as Record<string, unknown>)[
            handle as string
          ] as { show: (next: unknown) => void } | undefined;
          if (!camera) {
            throw new Error(
              'No fake camera in this page: install it before opening the page.',
            );
          }
          camera.show(pictures);
        },
        [HANDLE, qrPicturesOf(text)] as const,
      );
    },
  );
