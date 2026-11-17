import { describe, expect, it } from 'vitest';

import { equipmentIdInQrPayload, equipmentQrPayload } from './equipment-qr';

const ID = '550e8400-e29b-41d4-a716-446655440000';

describe('equipmentQrPayload', () => {
  it('is the plain text CABLAN-EQ: followed by the equipment id', () => {
    expect(equipmentQrPayload(ID)).toBe(`CABLAN-EQ:${ID}`);
  });
});

describe('equipmentIdInQrPayload', () => {
  it('reads the equipment id back out of a payload', () => {
    expect(equipmentIdInQrPayload(`CABLAN-EQ:${ID}`)).toBe(ID);
  });

  it('tolerates the whitespace a scanner may add around the text', () => {
    expect(equipmentIdInQrPayload(` CABLAN-EQ:${ID}\n`)).toBe(ID);
  });

  it('reads an id written in capitals the same way', () => {
    expect(equipmentIdInQrPayload(`CABLAN-EQ:${ID.toUpperCase()}`)).toBe(ID);
  });

  it.each([
    ['another prefix', `OTHER:${ID}`],
    ['a URL', `https://example.com/${ID}`],
    ['the prefix alone', 'CABLAN-EQ:'],
    ['an id that is no uuid', 'CABLAN-EQ:e1'],
    ['an id followed by more text', `CABLAN-EQ:${ID}/extra`],
    ['empty text', ''],
  ])('recognises nothing in %s', (_, text) => {
    expect(equipmentIdInQrPayload(text)).toBeUndefined();
  });
});
