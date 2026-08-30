import { Type, Transform, type TransformFnParams } from 'class-transformer';
import { IsEmail, IsString, MaxLength, ValidateNested } from 'class-validator';
import { RegisterTeamDto } from './register-team.dto';

export class CreateTeamInvitationDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email được mời không hợp lệ' })
  @MaxLength(320, { message: 'Email được mời quá dài' })
  email!: string;
}

function normalizeEmail({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class AcceptTeamInvitationDto {
  @IsString({ message: 'Token lời mời không hợp lệ' })
  token!: string;

  @ValidateNested()
  @Type(() => RegisterTeamDto)
  team!: RegisterTeamDto;
}

export class AcceptAccountLinkInvitationDto {
  @IsString({ message: 'Token lời mời không hợp lệ' })
  token!: string;
}
