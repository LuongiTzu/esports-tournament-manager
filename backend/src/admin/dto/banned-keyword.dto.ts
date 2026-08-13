import { BannedKeywordCategory } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBannedKeywordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  keyword!: string;

  @IsEnum(BannedKeywordCategory)
  category!: BannedKeywordCategory;
}
