// The OpenAPI shape of `MaterialWeightDifference`, shared by the dashboard's
// per-product rows and the post-registration preview so both document — and
// return — one line shape.
export const MaterialWeightDifferenceSchema = {
  properties: {
    componentId: {
      type: 'string',
      example: '550e8400-e29b-41d4-a716-446655440001',
    },
    componentName: { type: 'string', example: 'مغزی' },
    materialId: {
      type: 'string',
      example: '550e8400-e29b-41d4-a716-446655440002',
    },
    materialName: { type: 'string', example: 'مس' },
    actualWeight: { type: 'number', example: 12 },
    standardWeight: {
      type: 'number',
      example: 10,
      description:
        "The weight on the standard BOM's current composition; 0 when the component/material pair is no longer on it",
    },
    difference: {
      type: 'number',
      example: 2,
      description:
        '|actualWeight - standardWeight|, the absolute deviation from the standard weight (above and below count alike), rounded to 6 decimal places',
    },
  },
} as const;
