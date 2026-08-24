import { ModerationStatus, ReportStatus, Role } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  BooleanQueryField,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';

export class AdminTournamentListQueryDto {
  @IsOptional()
  @IsEnum(ModerationStatus)
  moderationStatus?: ModerationStatus;
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
