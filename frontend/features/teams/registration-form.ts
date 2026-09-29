import type { Gender, MemberRole, TeamRegistrationForm } from "./types";

export interface MemberForm {
  realName: string;
  ign: string;
  email: string;
  phoneNumber: string;
  birthDate: string;
  gender: "" | Gender;
  position: string;
  memberRole: Extract<MemberRole, "CAPTAIN" | "PLAYER" | "SUBSTITUTE">;
}

export const GENDER_OPTIONS: Gender[] = ["MALE", "FEMALE", "OTHER"];

export function emptyMember(
  memberRole: MemberForm["memberRole"] = "SUBSTITUTE",
): MemberForm {
  return {
    realName: "",
    ign: "",
    email: "",
    phoneNumber: "",
    birthDate: "",
    gender: "",
    position: "",
    memberRole,
  };
}

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

export function initialMembers(config: TeamRegistrationForm): MemberForm[] {
  const captain = config.prefill.captainMember;
  const firstMember: MemberForm = {
    ...emptyMember("CAPTAIN"),
    realName: captain.realName,
    email: captain.email,
    phoneNumber: captain.phoneNumber ?? "",
    birthDate: toDateInput(captain.birthDate),
    gender: captain.gender ?? "",
  };

  return Array.from({ length: config.tournament.minTeamSize }, (_, index) =>
    index === 0 ? firstMember : emptyMember("PLAYER"),
  );
}
