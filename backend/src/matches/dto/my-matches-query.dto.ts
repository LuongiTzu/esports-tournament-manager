import { MatchStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class MyMatchesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;
}
