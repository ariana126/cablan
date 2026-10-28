import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

// The OpenAPI shape of `BomEditRecordItem` — one record of a daily BOM's edit
// details («جزئیات ویرایش») — as a named component schema, `BomEditRecord`,
// shared by `GET /boms/{id}`, the report rows and the dashboard's daily-BOM
// rows so all three document one shape. A controller that references it
// registers it with `@ApiExtraModels(BomEditRecordSchema)`.
@ApiSchema({ name: 'BomEditRecord' })
export class BomEditRecordSchema {
  @ApiProperty({
    example: 'نیکروش',
    description: 'The display name of whoever made the edit',
  })
  editedBy!: string;

  @ApiProperty({
    example: '2024-09-05T06:30:00.000Z',
    format: 'date-time',
    description: 'When the edit was made, as an ISO 8601 instant',
  })
  editedAt!: string;

  @ApiProperty({ example: 'خطای ترازو', description: 'Why the edit was made' })
  reason!: string;

  @ApiProperty({
    example:
      'کاربر نیکروش در 1403/06/15 ساعت 10:00 به علت خطای ترازو تغییرات زیر را انجام داد',
    description:
      'The rendered heading line: who, the Jalali date and 24-hour time in Asia/Tehran (Latin digits) and why. Show it as is, above `changes`',
  })
  heading!: string;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد'],
    description:
      'One Persian line per change the edit made: material lines first, in composition order with removed lines last, then the order number, tracking number and description',
  })
  changes!: string[];
}

export const EditHistoryProperty = {
  editHistory: {
    type: 'array',
    items: { $ref: getSchemaPath(BomEditRecordSchema) },
    description:
      "The daily BOM's edit details («جزئیات ویرایش»): one record per correction (every effective edit except a reviewer's from the dashboard), oldest first; empty when never corrected. Show each record's `heading`, then its `changes`, one line each",
  },
} as const;
