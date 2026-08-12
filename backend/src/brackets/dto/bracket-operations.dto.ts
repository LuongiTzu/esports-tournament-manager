import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
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
