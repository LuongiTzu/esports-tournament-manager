import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/** Đọc giá trị của 1 field khác trong cùng object đang validate */
function siblingValue(args: ValidationArguments): unknown {
  const [relatedField] = args.constraints as [string];
  return (args.object as Record<string, unknown>)[relatedField];
}

/**
 * Kiểm tra field hiện tại phải <= field được chỉ định.
 * Bỏ qua khi 1 trong 2 field không có giá trị (field optional).
 *
 * VD: `@IsLteField('maxTeamSize')` trên `minTeamSize`
 */
export function IsLteField(
  relatedField: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isLteField',
      target: object.constructor,
      propertyName,
      constraints: [relatedField],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const other = siblingValue(args);
          if (value == null || other == null) return true;
          return Number(value) <= Number(other);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} phải nhỏ hơn hoặc bằng ${relatedField}`;
        },
      },
    });
  };
}

/**
 * Kiểm tra mốc thời gian hiện tại phải TRƯỚC field thời gian được chỉ định.
 * Bỏ qua khi 1 trong 2 field không có giá trị.
 *
 * VD: `@IsBeforeField('endDate')` trên `startDate`
 */
export function IsBeforeField(
  relatedField: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isBeforeField',
      target: object.constructor,
      propertyName,
      constraints: [relatedField],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const other = siblingValue(args);
          if (value == null || other == null) return true;

          const a = new Date(value as string).getTime();
          const b = new Date(other as string).getTime();
          if (Number.isNaN(a) || Number.isNaN(b)) return true; // để @IsDateString báo lỗi

          return a < b;
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} phải trước ${relatedField}`;
        },
      },
    });
  };
}
