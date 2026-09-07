import {
  ModerationStatus,
  ReportStatus,
  Role,
  TournamentStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import {
  BooleanQueryField,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';

export class AdminTournamentListQueryDto {
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
  @IsEnum(ModerationStatus)
  moderationStatus?: ModerationStatus;
}

export class AdminDashboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 30])
  periodDays?: 7 | 30;
}

export class AdminReportListQueryDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;
}

export class AdminCommentListQueryDto {
  @BooleanQueryField()
  isHidden?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @BooleanQueryField()
  isLocked?: boolean;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
