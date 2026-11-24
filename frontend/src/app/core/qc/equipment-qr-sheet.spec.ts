import {
  BinaryBitmap,
  HybridBinarizer,
  QRCodeDecoderErrorCorrectionLevel,
  QRCodeEncoder,
  QRCodeReader,
  RGBLuminanceSource,
} from '@zxing/library';
import { describe, expect, it } from 'vitest';

import { equipmentQrPayload } from './equipment-qr';
import { qrModules, qrSheetFileName } from './equipment-qr-sheet';

/** Draws the modules as a grey-scale picture (`scale` px a module, fractional allowed, a 4-module
 * quiet zone) and reads it back with ZXing's own decoder — the way a scanner would. The text read,
 * or `undefined` when the decoder gives up. */
function decode(modules: readonly (readonly boolean[])[], scale = 4): string | undefined {
  const quiet = 4;
  const size = Math.round((modules.length + 2 * quiet) * scale);
  const pixels = new Uint8ClampedArray(size * size);
  for (let py = 0; py < size; py++) {
    const y = Math.floor(py / scale) - quiet;
    for (let px = 0; px < size; px++) {
      const x = Math.floor(px / scale) - quiet;
      pixels[py * size + px] = modules[y]?.[x] ? 0 : 255;
    }
  }
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, size, size)));
  try {
    return new QRCodeReader().decode(bitmap).getText();
  } catch {
    return undefined;
  }
}

/** The modules ZXing's encoder gives on its own, with the mask pattern it picks itself. */
function defaultModules(text: string): boolean[][] {
  const matrix = QRCodeEncoder.encode(text, QRCodeDecoderErrorCorrectionLevel.M).getMatrix();
  return Array.from({ length: matrix.getHeight() }, (_, y) =>
    Array.from({ length: matrix.getWidth() }, (__, x) => matrix.get(x, y) === 1),
  );
}

/** Module sizes a camera might see a sticker at, a whole and a fractional number of pixels. */
const SCALES = [5, 8, 9.7];

/** `count` UUID-shaped ids from a seeded generator, so a failure names an id that fails again. */
function sampleIds(count: number): string[] {
  let seed = 134;
  const nextHex = (): string => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) & 0xf).toString(16);
  };
  const hex = (length: number): string => Array.from({ length }, nextHex).join('');
  return Array.from(
    { length: count },
    () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`,
  );
}

describe('qrModules', () => {
  it('encodes the payload so that a QR reader reads exactly it back', async () => {
    const payload = 'CABLAN-EQ:550e8400-e29b-41d4-a716-446655440000';

    const modules = await qrModules(payload);

    expect(modules.length).toBeGreaterThan(20);
    expect(modules.every((row) => row.length === modules.length)).toBe(true);
    expect(decode(modules)).toBe(payload);
  });

  it('prints the code ZXing encodes on its own when that one reads back', async () => {
    const payload = 'CABLAN-EQ:550e8400-e29b-41d4-a716-446655440000';

    expect(await qrModules(payload)).toEqual(defaultModules(payload));
  });

  it('prints a code ZXing reads even where its own encoder picks a mask ZXing cannot read', async () => {
    // Issue #134: in ZXing's own choice of mask pattern, this one's sticker never scans.
    const payload = equipmentQrPayload('b17b8c9c-fe14-465a-a0a0-9e985adb0ba4');
    expect(decode(defaultModules(payload))).toBeUndefined();

    const modules = await qrModules(payload);

    expect(modules.length).toBe(defaultModules(payload).length);
    for (const scale of SCALES) {
      expect(decode(modules, scale)).toBe(payload);
    }
  });

  it('prints, for every equipment id, a code ZXing reads back at every module size', async () => {
    const ids = ['329fe317-6792-43ea-88e7-2b78bc590c84', ...sampleIds(200)];
    const unreadable: string[] = [];

    for (const id of ids) {
      const payload = equipmentQrPayload(id);
      const modules = await qrModules(payload);
      if (SCALES.some((scale) => decode(modules, scale) !== payload)) {
        unreadable.push(id);
      }
    }

    expect(unreadable).toEqual([]);
  }, 120_000);
});

describe('qrSheetFileName', () => {
  it('names the file after the equipment', () => {
    expect(qrSheetFileName('اکسترودر 1')).toBe('QR اکسترودر 1.pdf');
  });

  it('drops the characters a file name cannot hold', () => {
    expect(qrSheetFileName('خط 1/2: "اصلی"')).toBe('QR خط 1-2- -اصلی-.pdf');
  });
});
