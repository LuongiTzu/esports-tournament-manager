import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateMatchYouTubeDto {
  @ApiProperty({
    type: String,
    nullable: true,
    maxLength: 2048,
    description: 'YouTube video/live URL; null removes the link.',
  })
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @MaxLength(2048)
  youtubeUrl!: string | null;
}

export class MatchYouTubeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  youtubeUrl!: string | null;
}
