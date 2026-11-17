import { DOCUMENT, Injectable, inject } from '@angular/core';

import { FileSaver } from '../files/file-saver';
import { equipmentQrPayload } from './equipment-qr';

/** The equipment a sheet is printed for. */
export interface QrSheetEquipment {
  readonly id: string;
  readonly name: string;
}

/**
 * The QR code's modules for a text, row by row, `true` for a dark one — ZXing's encoder at error
 * correction M (a sticker on a machine gets scuffed). Loaded on demand, like the PDF library.
 */
export async function qrModules(text: string): Promise<boolean[][]> {
  const { QRCodeEncoder, QRCodeDecoderErrorCorrectionLevel } = await import('@zxing/library');
  const matrix = QRCodeEncoder.encode(text, QRCodeDecoderErrorCorrectionLevel.M).getMatrix();
  return Array.from({ length: matrix.getHeight() }, (_, y) =>
    Array.from({ length: matrix.getWidth() }, (__, x) => matrix.get(x, y) === 1),
  );
}

/** `QR {name}.pdf`, every character a file system refuses replaced by a hyphen. */
export function qrSheetFileName(equipmentName: string): string {
  return `QR ${equipmentName.replace(/[\\/:*?"<>|]/g, '-')}.pdf`;
}

// The sheet: A5 portrait, in millimetres.
const PAGE_WIDTH = 148;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const QR_SIZE = 96;
const QUIET_ZONE = 4;

// The heading, drawn at print resolution: 80px type on a canvas `CONTENT_WIDTH` wide at 12 px/mm.
const PX_PER_MM = 12;
const HEADING_FONT = '700 80px Vazirmatn';
const HEADING_LINE_HEIGHT = 116;

/**
 * «دانلود QR تجهیز» (issue #119): a printable PDF for an equipment's sticker — its name as the
 * heading, the QR code (`CABLAN-EQ:<id>`) under it, the payload in small Latin type below as a
 * fallback for a person.
 *
 * **The Persian heading is drawn by the browser**, on a canvas in Vazirmatn (shaped and laid out
 * right to left as everywhere in the app), and put in the PDF as an image: a PDF's own text needs a
 * font embedded and Arabic-script shaping and bidi that `jspdf` does not do. The QR code is drawn as
 * vector squares, so it prints sharp at any size. `jspdf` and the encoder load only on a download.
 *
 * A browser adapter (canvas, fonts, a download), so specs substitute it; the encoding and the file
 * name are tested on their own.
 */
@Injectable({ providedIn: 'root' })
export class EquipmentQrSheet {
  private readonly document = inject(DOCUMENT);
  private readonly fileSaver = inject(FileSaver);

  async download(equipment: QrSheetEquipment): Promise<void> {
    const payload = equipmentQrPayload(equipment.id);
    const [{ jsPDF }, modules, heading] = await Promise.all([
      import('jspdf'),
      qrModules(payload),
      this.headingImage(equipment.name),
    ]);

    const pdf = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait', compress: true });
    const headingHeight = heading.height / PX_PER_MM;
    pdf.addImage(heading.dataUrl, 'PNG', MARGIN, MARGIN, CONTENT_WIDTH, headingHeight);

    const qrTop = MARGIN + headingHeight + 8;
    const qrLeft = (PAGE_WIDTH - QR_SIZE) / 2;
    const module = (QR_SIZE - 2 * QUIET_ZONE) / modules.length;
    pdf.setFillColor(0, 0, 0);
    modules.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) {
          // A hair of overlap so neighbouring squares print without a seam between them.
          pdf.rect(
            qrLeft + QUIET_ZONE + x * module,
            qrTop + QUIET_ZONE + y * module,
            module + 0.02,
            module + 0.02,
            'F',
          );
        }
      }),
    );

    pdf.setFontSize(8);
    pdf.setTextColor(80, 80, 80);
    pdf.text(payload, PAGE_WIDTH / 2, qrTop + QR_SIZE + 6, { align: 'center' });

    this.fileSaver.save(pdf.output('blob'), qrSheetFileName(equipment.name));
  }

  /** The name in Vazirmatn, wrapped to the sheet's width, centred, as a PNG data URL. */
  private async headingImage(name: string): Promise<{ dataUrl: string; height: number }> {
    await this.document.fonts?.load(HEADING_FONT, name);
    const canvas = this.document.createElement('canvas');
    const width = CONTENT_WIDTH * PX_PER_MM;
    const measure = canvas.getContext('2d');
    if (measure === null) {
      throw new Error('No 2D canvas to draw the heading on.');
    }
    measure.font = HEADING_FONT;
    const lines = wrap(name, width, (text) => measure.measureText(text).width);

    canvas.width = width;
    canvas.height = lines.length * HEADING_LINE_HEIGHT + 24;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#000000';
    context.font = HEADING_FONT;
    context.direction = 'rtl';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    lines.forEach((line, index) =>
      context.fillText(line, width / 2, 12 + index * HEADING_LINE_HEIGHT, width),
    );
    return { dataUrl: canvas.toDataURL('image/png'), height: canvas.height };
  }
}

/** Words onto lines no wider than `width`; a single word wider than that keeps a line of its own. */
function wrap(text: string, width: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  for (const word of text.trim().split(/\s+/)) {
    const current = lines.at(-1);
    if (current !== undefined && measure(`${current} ${word}`) <= width) {
      lines[lines.length - 1] = `${current} ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines.length > 0 ? lines : [''];
}
