import { Gender, MemberRole } from '@prisma/client';

export interface RegistrationMemberInput {
  realName: string;
  ign: string;
  inGameId?: string;
  birthDate?: string;
  gender?: Gender;
  email?: string;
  phoneNumber?: string;
  position?: string;
  memberRole?: MemberRole;
}
