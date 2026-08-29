import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RequestEmailChangeDto {
  @ApiProperty({ example: 'new-email@example.com' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Email mới không hợp lệ' })
  newEmail!: string;

  @ApiPropertyOptional({ description: 'Bắt buộc với tài khoản có mật khẩu' })
  @IsOptional()
  @IsString({ message: 'Mật khẩu hiện tại phải là chuỗi' })
  @MinLength(6, { message: 'Mật khẩu hiện tại phải có ít nhất 6 ký tự' })
  @MaxLength(50, { message: 'Mật khẩu hiện tại không được quá 50 ký tự' })
  currentPassword?: string;
}
