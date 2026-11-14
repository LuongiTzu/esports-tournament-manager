import { TournamentMode, TournamentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  BooleanQueryField,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';

export enum TournamentListSort {
  RECOMMENDED = 'recommended',
  NAME = 'name',
  NEWEST = 'newest',
  TEAMS = 'teams',
}

export class TournamentListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  gameId?: string;

  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;

  @IsOptional()
  @IsEnum(TournamentMode)
  mode?: TournamentMode;

  @BooleanQueryField()
  isVerified?: boolean;

  @IsOptional()
  @IsEnum(TournamentListSort)
  sort?: TournamentListSort;
}
