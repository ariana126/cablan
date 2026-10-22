import { BomReportFiltersDto } from '@boms/infrastructure/http/controllers/bom/dto/report-boms.dto';
import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

// Same shape as `DashboardProductsDto`: the same `from`/`to` "absent means
// unfiltered" convention, and the report's `approvalStatuses`/`approvers`
// picked from `BomReportFiltersDto` with their validation and Swagger docs.
// `productId` itself is a path parameter, not part of this body.
export class ProductDailyBomsDto extends PickType(BomReportFiltersDto, [
  'approvalStatuses',
  'approvers',
] as const) {
  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-06-21T00:00:00.000Z' })
  from?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-06-26T00:00:00.000Z' })
  to?: string;
}
