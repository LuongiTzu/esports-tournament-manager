import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class MatchCheckInDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  teamId!: string;
}

export class MatchCheckInResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  matchId!: string;

  @ApiProperty()
  teamId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  checkedInAt!: Date;
}
