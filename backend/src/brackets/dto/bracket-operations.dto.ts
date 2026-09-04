import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  IsOptional,
  MaxLength,
  Length,
  ArrayUnique,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SeedAssignmentDto {
  @IsString()
  teamId!: string;

  @IsInt()
  @Min(1)
  seed!: number;
}

export class UpdateSeedsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SeedAssignmentDto)
  seeds!: SeedAssignmentDto[];
}

export class GenerateRoundDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  previewToken?: string;
}

export class AdvanceRoundDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(256)
  @ArrayUnique()
  @IsString({ each: true })
  qualifiedTeamIds?: string[];
}

export class ResetDownstreamDto {
  @IsString()
  @Length(64, 64)
  previewToken!: string;
}
