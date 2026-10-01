import { TournamentStaffRole } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AddTournamentStaffDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ enum: TournamentStaffRole })
  @IsEnum(TournamentStaffRole)
  role!: TournamentStaffRole;
}

export class UpdateTournamentStaffDto {
  @ApiProperty({ enum: TournamentStaffRole })
  @IsEnum(TournamentStaffRole)
  role!: TournamentStaffRole;
}

export class CloneTournamentDto {
  @ApiProperty({ minLength: 3, maxLength: 150 })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  name!: string;
}

class TournamentStaffUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl!: string | null;
}

export class TournamentStaffDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: TournamentStaffRole })
  role!: TournamentStaffRole;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: TournamentStaffUserDto })
  user!: TournamentStaffUserDto;
}
