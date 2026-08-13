import { NotificationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum NotificationScope {
  WHOLE_TOURNAMENT = 'WHOLE_TOURNAMENT',
  TEAM = 'TEAM',
}

export class CreateTournamentNotificationDto {
  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsEnum(NotificationScope)
  scope!: NotificationScope;

  @IsOptional()
  @IsString()
  teamId?: string;
}
