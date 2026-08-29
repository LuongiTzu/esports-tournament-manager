import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsDateString,
  IsEnum,
  Matches,
  Validate,
} from 'class-validator';
import { Gender } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsPastDateConstraint } from '../validators/is-past-date.validator';

export class RegisterDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  @MaxLength(50, { message: 'Mật khẩu không được quá 50 ký tự' })
  password!: string;

  @IsString()
  @MinLength(2, { message: 'Tên hiển thị phải có ít nhất 2 ký tự' })
  @MaxLength(50, { message: 'Tên hiển thị không được quá 50 ký tự' })
  displayName!: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'Ngày sinh không hợp lệ (định dạng YYYY-MM-DD)' },
  )
  @Validate(IsPastDateConstraint, {
    message: 'Ngày sinh không được ở trong tương lai',
  })
  birthDate?: string;

  @IsOptional()
  @IsString({ message: 'Nơi ở hiện tại phải là chuỗi' })
  @MaxLength(200, { message: 'Nơi ở hiện tại không được quá 200 ký tự' })
  currentAddress?: string;

  @IsOptional()
  @Matches(/^[0-9+\-\s]{9,15}$/, {
    message:
      'Số điện thoại không hợp lệ (9-15 ký tự số, có thể gồm +, -, khoảng trắng)',
  })
  phoneNumber?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'Giới tính không hợp lệ (MALE, FEMALE, OTHER)' })
  gender?: Gender;

  @IsOptional()
  @IsString({ message: 'Giới thiệu phải là chuỗi' })
  @MaxLength(500, { message: 'Giới thiệu không được quá 500 ký tự' })
  bio?: string;
}
