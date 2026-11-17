import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from '@zxing/library';
import { describe, expect, it } from 'vitest';

import { qrModules, qrSheetFileName } from './equipment-qr-sheet';

/** Draws the modules as a grey-scale picture (4px a module, a 4-module quiet zone) and reads it back
 * with ZXing's own decoder — the way a scanner would. */
function decode(modules: readonly (readonly boolean[])[]): string {
  const scale = 4;
  const quiet = 4;
  const size = (modules.length + 2 * quiet) * scale;
  const pixels = new Uint8ClampedArray(size * size).fill(255);
  modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (!dark) {
        return;
      }
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          pixels[((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx] = 0;
        }
      }
    }),
  );
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, size, size)));
  return new QRCodeReader().decode(bitmap).getText();
}

describe('qrModules', () => {
  it('encodes the payload so that a QR reader reads exactly it back', async () => {
    const payload = 'CABLAN-EQ:550e8400-e29b-41d4-a716-446655440000';

    const modules = await qrModules(payload);

    expect(modules.length).toBeGreaterThan(20);
    expect(modules.every((row) => row.length === modules.length)).toBe(true);
    expect(decode(modules)).toBe(payload);
  });
});

describe('qrSheetFileName', () => {
  it('names the file after the equipment', () => {
    expect(qrSheetFileName('اکسترودر 1')).toBe('QR اکسترودر 1.pdf');
  });

  it('drops the characters a file name cannot hold', () => {
    expect(qrSheetFileName('خط 1/2: "اصلی"')).toBe('QR خط 1-2- -اصلی-.pdf');
  });
});
