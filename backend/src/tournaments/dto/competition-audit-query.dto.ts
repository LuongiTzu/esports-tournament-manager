import { CompetitionAuditAction } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CompetitionAuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(CompetitionAuditAction)
  action?: CompetitionAuditAction;
}
