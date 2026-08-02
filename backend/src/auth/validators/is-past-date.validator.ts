import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Kiểm tra ngày phải NẰM TRONG QUÁ KHỨ (hoặc hôm nay),
 * không cho phép ngày sinh trong tương lai.
 *
 * Dùng trong RegisterDto/UpdateProfileDto cho field `birthDate`.
 */
@ValidatorConstraint({ name: 'isPastDate', async: false })
export class IsPastDateConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (typeof value !== 'string') return false;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    // Xoá phần giờ:phút:giây để chỉ so sánh theo ngày
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const inputDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

    return inputDay.getTime() <= today.getTime();
  }

  defaultMessage(args: ValidationArguments): string {
    return `Ngày sinh không hợp lệ (${args.value}) — ngày không được ở trong tương lai`;
  }
}
