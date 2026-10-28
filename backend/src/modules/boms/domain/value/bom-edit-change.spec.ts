import {
  changeLineOf,
  FieldEditChange,
  MaterialEditChange,
} from './bom-edit-change';

function fieldChange(
  field: FieldEditChange['field'],
  previousValue: string,
  newValue: string,
): FieldEditChange {
  return { kind: 'field', field, previousValue, newValue };
}

function copperChange(
  previousWeight: number | null,
  newWeight: number | null,
): MaterialEditChange {
  return {
    kind: 'material',
    componentId: 'component-core',
    componentName: 'مغزی',
    materialId: 'material-copper',
    materialName: 'مسی',
    previousWeight,
    newWeight,
  };
}

describe('changeLineOf', () => {
  it('a weight change reads as one line naming its component and material, with weights as entered', () => {
    expect(changeLineOf(copperChange(3, 2.5))).toBe(
      'وزن جز مغزی مواد اولیه مسی از 3 به 2.5 تغییر کرد',
    );
  });

  it.each([
    ['orderNumber', 'شماره سفارش از ORD-1 به ORD-2 تغییر کرد'],
    ['trackingNumber', 'شماره ردیابی از ORD-1 به ORD-2 تغییر کرد'],
    ['description', 'توضیحات از ORD-1 به ORD-2 تغییر کرد'],
  ] as const)('a %s change reads with its Persian label', (field, line) => {
    expect(changeLineOf(fieldChange(field, 'ORD-1', 'ORD-2'))).toBe(line);
  });

  it('a description added where there was none reads its missing side as -', () => {
    expect(changeLineOf(fieldChange('description', '', 'جدید'))).toBe(
      'توضیحات از - به جدید تغییر کرد',
    );
  });

  it('a material added to a component reads as an addition with its weight', () => {
    expect(changeLineOf(copperChange(null, 2))).toBe(
      'مواد اولیه مسی با وزن 2 به جز مغزی اضافه شد',
    );
  });

  it('a material removed from a component reads as a removal with its former weight', () => {
    expect(changeLineOf(copperChange(3, null))).toBe(
      'مواد اولیه مسی با وزن 3 از جز مغزی حذف شد',
    );
  });
});
