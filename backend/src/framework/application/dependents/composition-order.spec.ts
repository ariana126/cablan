import {
  orderedByComponentIds,
  repositionedComponentLines,
} from './composition-order';

const line = (componentId: string) => ({ componentId });
const ids = (lines: { componentId: string }[]) =>
  lines.map(({ componentId }) => componentId);

describe('orderedByComponentIds', () => {
  it('lays the lines out in the given order of component ids', () => {
    const sut = orderedByComponentIds(
      [line('conductor'), line('insulation'), line('sheath')],
      ['sheath', 'conductor', 'insulation'],
    );

    expect(ids(sut)).toEqual(['sheath', 'conductor', 'insulation']);
  });

  it('keeps the lines whose component is not in the order after the others, in their own order', () => {
    const sut = orderedByComponentIds(
      [line('armour'), line('conductor'), line('filler'), line('sheath')],
      ['sheath', 'conductor'],
    );

    expect(ids(sut)).toEqual(['sheath', 'conductor', 'armour', 'filler']);
  });

  it('ignores components of the order the lines do not hold', () => {
    const sut = orderedByComponentIds(
      [line('conductor'), line('sheath')],
      ['sheath', 'insulation', 'conductor'],
    );

    expect(ids(sut)).toEqual(['sheath', 'conductor']);
  });

  it('matches a component listed twice occurrence by occurrence', () => {
    const lines = [
      { componentId: 'tape', name: 'first tape' },
      { componentId: 'conductor', name: 'conductor' },
      { componentId: 'tape', name: 'second tape' },
    ];

    const sut = orderedByComponentIds(lines, ['tape', 'conductor', 'tape']);

    expect(sut.map(({ name }) => name)).toEqual([
      'first tape',
      'conductor',
      'second tape',
    ]);
  });
});

function stored(
  id: string,
  parentId: string,
  componentId: string,
  position: number,
) {
  return { id, parentId, componentId, position };
}

describe('repositionedComponentLines', () => {
  it('gives each line of each snapshot its place in the new order', () => {
    const sut = repositionedComponentLines(
      [
        stored('a1', 'mi-a', 'conductor', 0),
        stored('a2', 'mi-a', 'insulation', 1),
        stored('a3', 'mi-a', 'sheath', 2),
        stored('b1', 'mi-b', 'conductor', 0),
        stored('b2', 'mi-b', 'sheath', 1),
      ],
      ['sheath', 'conductor', 'insulation'],
    );

    expect(sut).toEqual([
      { id: 'a3', position: 0 },
      { id: 'a1', position: 1 },
      { id: 'a2', position: 2 },
      { id: 'b2', position: 0 },
      { id: 'b1', position: 1 },
    ]);
  });

  it('names only the lines that move, reading each snapshot in its stored order', () => {
    const sut = repositionedComponentLines(
      [
        stored('a3', 'mi-a', 'armour', 2),
        stored('a1', 'mi-a', 'conductor', 0),
        stored('a2', 'mi-a', 'filler', 1),
        stored('b1', 'mi-b', 'sheath', 0),
        stored('b2', 'mi-b', 'conductor', 1),
      ],
      ['conductor', 'sheath'],
    );

    expect(sut).toEqual([
      { id: 'b2', position: 0 },
      { id: 'b1', position: 1 },
    ]);
  });
});
