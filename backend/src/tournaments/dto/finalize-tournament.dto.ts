import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmFinalStandingsDto {
  @ApiPropertyOptional({
    description:
      'Organizer-selected champion when competitive standings are tied at rank one',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  championTeamId?: string;
}
