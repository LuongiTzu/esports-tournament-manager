import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  @MaxLength(50, { message: 'Mật khẩu không được quá 50 ký tự' })
  password: string;

  @IsString()
  @MinLength(2, { message: 'Tên hiển thị phải có ít nhất 2 ký tự' })
  @MaxLength(50, { message: 'Tên hiển thị không được quá 50 ký tự' })
  displayName: string;
}
