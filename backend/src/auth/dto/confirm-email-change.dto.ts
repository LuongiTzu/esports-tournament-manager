import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmEmailChangeDto {
  @ApiProperty({ description: 'Token một lần nhận tại email mới' })
  @IsString({ message: 'Token đổi email không hợp lệ' })
  @MinLength(40, { message: 'Token đổi email không hợp lệ' })
  @MaxLength(200, { message: 'Token đổi email không hợp lệ' })
  token!: string;
}
