import assert from "node:assert/strict";
import test from "node:test";
import {
  createRoundForm,
  INITIAL_FORM,
  optionalIsoDate,
  optionalNumber,
} from "../features/tournaments/components/create/create-form-model.ts";
import { initialMembers } from "../features/teams/registration-form.ts";

const registration = (minTeamSize) => ({
  tournament: { minTeamSize },
  prefill: {
    captainMember: {
      realName: "Nguyễn An",
      email: "captain@example.com",
      phoneNumber: null,
      birthDate: "2000-03-04T00:00:00.000Z",
      gender: "FEMALE",
    },
  },
});

test("1v1 registration prefills the only captain from the backend", () => {
  assert.deepEqual(initialMembers(registration(1)), [
    {
      realName: "Nguyễn An",
      ign: "",
      email: "captain@example.com",
      phoneNumber: "",
      birthDate: "2000-03-04",
      gender: "FEMALE",
      position: "",
      memberRole: "CAPTAIN",
    },
  ]);
});

test("team registration creates one captain and independent player forms", () => {
  const members = initialMembers(registration(5));
  assert.equal(members.length, 5);
  assert.deepEqual(
    members.map((member) => member.memberRole),
    ["CAPTAIN", "PLAYER", "PLAYER", "PLAYER", "PLAYER"],
  );
  members[1].ign = "Player 1";
  assert.equal(members[2].ign, "");
});

test("new rounds keep format settings independent between form instances", () => {
  const first = createRoundForm("Vòng 1", "SWISS");
  const second = createRoundForm("Vòng 2", "SWISS");
  first.swiss.advancingTeamCount = "4";
  first.groupStage.numberOfGroups = "8";

  assert.equal(second.name, "Vòng 2");
  assert.equal(second.format, "SWISS");
  assert.equal(second.swiss.advancingTeamCount, "8");
  assert.equal(second.groupStage.numberOfGroups, "2");
  assert.equal(second.bestOf, "1");
});

test("optional tournament fields stay absent when blank and retain entered values", () => {
  assert.equal(optionalNumber(""), undefined);
  assert.equal(optionalNumber("0"), 0);
  assert.equal(optionalNumber("16"), 16);
  assert.equal(optionalIsoDate(""), undefined);
  assert.equal(
    optionalIsoDate("2030-06-15T20:00"),
    new Date("2030-06-15T20:00").toISOString(),
  );
  assert.equal(INITIAL_FORM.visibility, "PUBLIC");
  assert.equal(INITIAL_FORM.status, "REGISTRATION");
});
