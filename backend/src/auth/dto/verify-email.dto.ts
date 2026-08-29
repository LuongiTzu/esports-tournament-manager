import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Token một lần nhận trong email xác minh' })
  @IsString({ message: 'Token xác minh email không hợp lệ' })
  @MinLength(40, { message: 'Token xác minh email không hợp lệ' })
  @MaxLength(200, { message: 'Token xác minh email không hợp lệ' })
  token!: string;
}
