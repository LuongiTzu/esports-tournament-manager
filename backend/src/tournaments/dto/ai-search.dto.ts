import { Transform } from 'class-transformer';
import { IsIn, IsString, Length } from 'class-validator';

export class AiSearchDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 500)
  query!: string;

  @IsIn(['vi', 'en'])
  locale: 'vi' | 'en' = 'vi';
}
