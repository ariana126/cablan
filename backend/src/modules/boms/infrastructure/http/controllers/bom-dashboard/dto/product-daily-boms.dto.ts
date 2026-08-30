import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

// Same shape as `DashboardProductsDto`, the same `from`/`to` "absent
// means unfiltered" convention. `productId` itself is a path parameter
// validated at the controller's `@Param('productId')` (UUID), not here.
export class ProductDailyBomsDto {
  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-06-21T00:00:00.000Z' })
  from?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-06-26T00:00:00.000Z' })
  to?: string;
}
