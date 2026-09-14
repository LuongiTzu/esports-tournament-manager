import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PaginationQueryDto,
  BooleanQueryField,
} from '../common/dto/pagination-query.dto';

export class SaveRatingDto {
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;
}

export class ModerateRatingDto {
  @IsBoolean()
  isHidden!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminRatingQueryDto extends PaginationQueryDto {
  @BooleanQueryField()
  isHidden?: boolean;
}
