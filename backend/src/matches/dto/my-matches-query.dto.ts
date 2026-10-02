import { MatchStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  IsIn,
  IsISO8601,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class MyMatchesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  gameId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tournamentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  teamId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['NEEDS_ACTION', 'CHECK_IN', 'CONFIRM', 'DISPUTED'])
  attention?: 'NEEDS_ACTION' | 'CHECK_IN' | 'CONFIRM' | 'DISPUTED';

  @IsOptional()
  @IsIn(['DEFAULT', 'NEWEST', 'OLDEST'])
  sort?: 'DEFAULT' | 'NEWEST' | 'OLDEST';

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
