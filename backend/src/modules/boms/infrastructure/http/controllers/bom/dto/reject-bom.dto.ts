import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// `reason` is only type-checked here, never required: a missing, empty or
// whitespace-only reason reaches `Bom.reject()`, which refuses it as
// `RejectionReasonRequired` — the 400 `rejection-reason-required` problem a
// client can tell apart from a malformed body.
export class RejectBomDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'وزن مس خارج از محدوده است',
    description:
      'Why the daily BOM is rejected («دلیل عدم تایید»); stored trimmed as its management note. Required in substance: missing, empty or whitespace-only is a 400 `rejection-reason-required`.',
  })
  reason?: string;
}
