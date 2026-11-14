import { NotificationType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum NotificationScope {
  WHOLE_TOURNAMENT = 'WHOLE_TOURNAMENT',
  TEAM = 'TEAM',
}

export class CreateTournamentNotificationDto {
  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @IsEnum(NotificationScope)
  scope!: NotificationScope;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  teamId?: string;
}
