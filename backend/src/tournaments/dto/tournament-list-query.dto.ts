import { TournamentMode, TournamentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  BooleanQueryField,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';

export class TournamentListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  gameId?: string;

  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;

  @IsOptional()
  @IsEnum(TournamentMode)
  mode?: TournamentMode;

  @BooleanQueryField()
  isVerified?: boolean;
}
