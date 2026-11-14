import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export function BooleanQueryField(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    Transform(toBooleanQueryValue)(target, propertyKey);
    IsOptional()(target, propertyKey);
    IsBoolean()(target, propertyKey);
  };
}

function toBooleanQueryValue({ value }: TransformFnParams): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}
