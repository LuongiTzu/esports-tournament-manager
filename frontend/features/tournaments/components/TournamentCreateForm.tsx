"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarBlankIcon,
  CheckIcon,
  IdentificationCardIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import {
  alertErrorClass,
  hintClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "@/components/ui";
import ImageUploadPicker from "@/components/ImageUploadPicker";
import { clearSession, useAuth } from "@/features/auth/store";
import EmailVerificationNotice from "@/features/auth/components/EmailVerificationNotice";
import { isEmailNotVerifiedError } from "@/features/auth/email-verification";
import { gamesApi } from "@/features/games/api";
import { accentVars } from "@/features/games/game-accent";
import type { Game } from "@/features/games/types";
import GameStructureFields, {
  type GameStructureValue,
} from "@/features/games/components/GameStructureFields";
import { tournamentsApi } from "@/features/tournaments/api";
import type { RoundFormatValue } from "@/features/tournaments/round-formats";
import TournamentLivePreview from "@/features/tournaments/components/TournamentLivePreview";
import type {
  CreateRoundRequest,
  MatchScoringMode,
} from "@/features/tournaments/types";
import { ApiError } from "@/lib/api/client";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import TournamentFormSection from "./create/TournamentFormSection";
import TournamentRoundsSection from "./create/TournamentRoundsSection";
import {
  createRoundForm,
  INITIAL_FORM,
  optionalIsoDate,
  optionalNumber,
  type RoundForm,
  type TournamentFormState,
} from "./create/create-form-model";

const genderOptions = ["MALE", "FEMALE", "OTHER"] as const;

function ToggleField({
  name,
  checked,
  onChange,
  title,
  description,
  disabled = false,
}: {
  name: keyof TournamentFormState;
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border border-line bg-surface/55 p-4 transition-[border-color,background-color,transform] ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:border-brand/45 hover:bg-surface-hover/70 active:scale-[0.99]"
      }`}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-1 size-4 accent-[var(--color-brand)]"
      />
      <span>
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-ink-faint">
          {description}
        </span>
      </span>
    </label>
  );
}

export default function TournamentCreateForm() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const { t } = useLocale();
  const [games, setGames] = useState<Game[]>([]);
  const [gamesError, setGamesError] = useState(false);
  const [form, setForm] = useState<TournamentFormState>(INITIAL_FORM);
  const [rounds, setRounds] = useState<RoundForm[]>(() => [
    createRoundForm(t("tournament.create.defaultGroupRound"), "GROUP_STAGE"),
  ]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [expandedRoundIndex, setExpandedRoundIndex] = useState<number | null>(
    0,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const wizardTopRef = useRef<HTMLDivElement>(null);
  const contactDefaultsAppliedForUserRef = useRef<string | null>(null);
  const [createdTournament, setCreatedTournament] = useState<{
    id: string;
    slug: string;
    uploadError: string;
  } | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.push("/login");
      return;
    }

    let cancelled = false;
    gamesApi
      .findAll()
      .then((data) => {
        if (!cancelled) setGames(data);
      })
      .catch(() => {
        if (!cancelled) setGamesError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [router, ready, user]);

  useEffect(() => {
    if (!ready || !user) return;
    if (contactDefaultsAppliedForUserRef.current === user.id) return;

    contactDefaultsAppliedForUserRef.current = user.id;
    setForm((current) => ({
      ...current,
      contactEmail: current.contactEmail || user.email,
      contactPhone: current.contactPhone || user.phoneNumber?.trim() || "",
    }));
  }, [ready, user]);

  const selectedGame = games.find((game) => game.id === form.gameId);
  const minimumMembers = optionalNumber(form.teamSize);
  const maximumMembers = optionalNumber(form.maxTeamSize);
  const steps = [
    t("tournament.create.step.general"),
    t("tournament.create.step.format"),
    t("tournament.create.step.configuration"),
    t("tournament.create.step.review"),
  ];

  const showStep = (step: number) => {
    setError("");
    setCurrentStep(step);
    wizardTopRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const goToNextStep = (event?: React.SyntheticEvent) => {
    // The next button becomes the submit button when entering the final step.
    // Prevent the original click from submitting that reused DOM node.
    event?.preventDefault();
    if (!formRef.current?.reportValidity()) return;
    showStep(Math.min(steps.length - 1, currentStep + 1));
  };

  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = event.target;
    const nextValue =
      type === "checkbox" ? (event.target as HTMLInputElement).checked : value;

    setForm((current) => ({ ...current, [name]: nextValue }));
  };

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const status = event.target.value as TournamentFormState["status"];
    setForm((current) => ({
      ...current,
      status,
      visibility: status === "DRAFT" ? "PRIVATE" : "PUBLIC",
      registrationOpen: status === "REGISTRATION",
    }));
  };

  const handleGameStructureChange = (structure: GameStructureValue) => {
    setForm((current) => ({
      ...current,
      ...structure,
    }));
  };

  const toggleGender = (
    gender: TournamentFormState["allowedGenders"][number],
  ) => {
    setForm((current) => ({
      ...current,
      allowedGenders: current.allowedGenders.includes(gender)
        ? current.allowedGenders.filter((item) => item !== gender)
        : [...current.allowedGenders, gender],
    }));
  };

  const updateRound = (
    index: number,
    field: "name" | "format" | "bestOf",
    value: string,
  ) => {
    setRounds((current) =>
      current.map((round, roundIndex) =>
        roundIndex === index
          ? {
              ...round,
              [field]: field === "format" ? (value as RoundFormatValue) : value,
            }
          : round,
      ),
    );
  };

  const updateScoringMode = (index: number, scoringMode: MatchScoringMode) => {
    setRounds((current) =>
      current.map((round, roundIndex) =>
        roundIndex === index
          ? {
              ...round,
              scoringMode,
              bestOf: scoringMode === "POINT_SCORE" ? "1" : round.bestOf,
            }
          : round,
      ),
    );
  };

  const updateRoundRobinSettings = (
    index: number,
    field: keyof RoundForm["roundRobin"],
    value: string | boolean,
  ) => {
    setRounds((current) =>
      current.map((round, roundIndex) =>
        roundIndex === index
          ? {
              ...round,
              roundRobin: { ...round.roundRobin, [field]: value },
            }
          : round,
      ),
    );
  };

  const updateGroupStageSettings = (
    index: number,
    field: keyof RoundForm["groupStage"],
    value: string | boolean,
  ) => {
    setRounds((current) =>
      current.map((round, roundIndex) =>
        roundIndex === index
          ? {
              ...round,
              groupStage: { ...round.groupStage, [field]: value },
            }
          : round,
      ),
    );
  };

  const updateSwissSettings = (
    index: number,
    field: keyof RoundForm["swiss"],
    value: string,
  ) => {
    setRounds((current) =>
      current.map((round, roundIndex) =>
        roundIndex === index
          ? { ...round, swiss: { ...round.swiss, [field]: value } }
          : round,
      ),
    );
  };

  const updateEliminationSetting = (
    index: number,
    format: "PLAYOFF" | "DOUBLE_ELIM",
    checked: boolean,
  ) => {
    setRounds((current) =>
      current.map((round, roundIndex) =>
        roundIndex !== index
          ? round
          : format === "PLAYOFF"
            ? {
                ...round,
                playoff: { ...round.playoff, thirdPlaceMatch: checked },
              }
            : {
                ...round,
                doubleElim: { ...round.doubleElim, grandFinalReset: checked },
              },
      ),
    );
  };

  const addRound = () => {
    setRounds((current) => [
      ...current,
      createRoundForm(
        `${t("tournament.create.defaultRound")} ${current.length + 1}`,
        "PLAYOFF",
      ),
    ]);
  };

  const removeRound = (index: number) => {
    setRounds((current) =>
      current.filter((_, roundIndex) => roundIndex !== index),
    );
  };

  const validateForm = () => {
    if (form.mode !== "ONLINE" && !form.location.trim()) {
      return t("tournament.create.locationRequired");
    }

    if (!selectedGame) {
      return t("tournament.create.gameRequired");
    }

    if (
      minimumMembers === undefined ||
      !Number.isInteger(minimumMembers) ||
      minimumMembers < 1
    ) {
      return t("game.structure.teamSizeInvalid");
    }

    if (selectedGame.code === "CUSTOM" && !form.customGameName.trim()) {
      return t("game.structure.customNameRequired");
    }

    if (
      maximumMembers === undefined ||
      !Number.isInteger(maximumMembers) ||
      maximumMembers < minimumMembers ||
      maximumMembers > selectedGame.maxTeamSize
    ) {
      return `${t("tournament.create.maxMembersRange")} (${minimumMembers}–${selectedGame.maxTeamSize})`;
    }

    const minAge = optionalNumber(form.minAge);
    const maxAge = optionalNumber(form.maxAge);
    if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) {
      return t("tournament.create.ageRangeInvalid");
    }

    const timeline = [
      [t("tournament.create.registrationOpensAt"), form.registrationStartDate],
      [t("tournament.create.registrationDeadline"), form.registrationDeadline],
      [t("tournament.create.startsAt"), form.startDate],
      [t("tournament.create.endsAt"), form.endDate],
    ] as const;
    const suppliedDates = timeline
      .filter(([, value]) => value)
      .map(([label, value]) => [label, new Date(value).getTime()] as const);

    for (let index = 1; index < suppliedDates.length; index += 1) {
      if (suppliedDates[index][1] < suppliedDates[index - 1][1]) {
        return `${suppliedDates[index][0]} ${t("tournament.create.mustBeAfter")} ${suppliedDates[index - 1][0]}.`;
      }
    }

    if (rounds.some((round) => !round.name.trim())) {
      return t("tournament.create.roundNameRequired");
    }
    if (
      rounds.some(
        (round) =>
          round.scoringMode === "POINT_SCORE" && Number(round.bestOf) !== 1,
      )
    ) {
      return t("tournament.create.pointScoreRequiresBo1");
    }
    for (const round of rounds) {
      if (round.format !== "SWISS") continue;
      if (round.swiss.mode === "THRESHOLD") {
        if (
          [round.swiss.winsToAdvance, round.swiss.lossesToEliminate].some(
            (value) =>
              !Number.isInteger(Number(value)) ||
              Number(value) < 1 ||
              Number(value) > 10,
          )
        )
          return t("swiss.thresholdInvalid");
        continue;
      }
      const numberOfRounds = optionalNumber(round.swiss.numberOfRounds);
      const advancingTeamCount = Number(round.swiss.advancingTeamCount);
      if (
        numberOfRounds !== undefined &&
        (!Number.isInteger(numberOfRounds) ||
          numberOfRounds < 1 ||
          numberOfRounds > 20)
      ) {
        return t("tournament.create.swissRoundsInvalid");
      }
      if (
        !Number.isInteger(advancingTeamCount) ||
        advancingTeamCount < 1 ||
        advancingTeamCount > 256
      ) {
        return t("tournament.create.swissAdvanceInvalid");
      }
    }
    for (const round of rounds) {
      if (round.format !== "GROUP_STAGE") continue;
      const values = round.groupStage;
      const numberOfGroups = Number(values.numberOfGroups);
      const advancingTeamsPerGroup = Number(values.advancingTeamsPerGroup);
      const winPoints = Number(values.winPoints);
      const drawPoints = Number(values.drawPoints);
      const lossPoints = Number(values.lossPoints);
      const meetingsPerPair = Number(values.meetingsPerPair);
      if (
        !Number.isInteger(numberOfGroups) ||
        numberOfGroups < 2 ||
        numberOfGroups > 16
      ) {
        return t("tournament.create.groupsInvalid");
      }
      if (
        !Number.isInteger(advancingTeamsPerGroup) ||
        advancingTeamsPerGroup < 1
      ) {
        return t("tournament.create.advancePerGroupInvalid");
      }
      if (
        ![winPoints, drawPoints, lossPoints].every(
          (value) => Number.isInteger(value) && value >= 0 && value <= 100,
        )
      ) {
        return t("tournament.create.groupPointsInvalid");
      }
      if (
        !Number.isInteger(meetingsPerPair) ||
        meetingsPerPair < 1 ||
        meetingsPerPair > 4
      ) {
        return t("tournament.create.meetingsInvalid");
      }
      if (winPoints <= lossPoints) {
        return t("tournament.create.winPointsInvalid");
      }
      if (
        values.allowDraws &&
        (winPoints <= drawPoints || drawPoints < lossPoints)
      ) {
        return t("tournament.create.drawPointsInvalid");
      }
      const maxTeams = optionalNumber(form.maxTeams);
      if (maxTeams !== undefined) {
        if (maxTeams % numberOfGroups !== 0) {
          return t("tournament.create.capacityDivisibilityInvalid");
        }
        if (advancingTeamsPerGroup >= maxTeams / numberOfGroups) {
          return t("tournament.create.advanceTooMany");
        }
      }
    }
    for (const round of rounds) {
      if (round.format !== "ROUND_ROBIN") continue;
      const values = round.roundRobin;
      const advancingTeamCount = Number(values.advancingTeamCount);
      const winPoints = Number(values.winPoints);
      const drawPoints = Number(values.drawPoints);
      const lossPoints = Number(values.lossPoints);
      const meetingsPerPair = Number(values.meetingsPerPair);
      if (
        !Number.isInteger(advancingTeamCount) ||
        advancingTeamCount < 1 ||
        advancingTeamCount > 256
      ) {
        return t("tournament.create.roundRobinAdvanceInvalid");
      }
      if (
        ![winPoints, drawPoints, lossPoints].every(
          (value) => Number.isInteger(value) && value >= 0 && value <= 100,
        )
      ) {
        return t("tournament.create.roundRobinPointsInvalid");
      }
      if (
        !Number.isInteger(meetingsPerPair) ||
        meetingsPerPair < 1 ||
        meetingsPerPair > 4
      ) {
        return t("tournament.create.meetingsInvalid");
      }
      if (winPoints <= lossPoints) {
        return t("tournament.create.winPointsInvalid");
      }
      if (
        values.allowDraws &&
        (winPoints <= drawPoints || drawPoints < lossPoints)
      ) {
        return t("tournament.create.drawPointsInvalid");
      }
    }
    return "";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    // Native form submission (for example, pressing Enter) must not skip the
    // remaining review step.
    if (currentStep < steps.length - 1) {
      goToNextStep();
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (
      !selectedGame ||
      minimumMembers === undefined ||
      maximumMembers === undefined
    ) {
      return;
    }

    setLoading(true);
    try {
      const tournament = await tournamentsApi.create({
        isOfficial: user?.role === "ADMIN" ? form.isOfficial : undefined,
        name: form.name.trim(),
        gameId: form.gameId,
        teamSize: minimumMembers,
        customGameName:
          selectedGame.code === "CUSTOM"
            ? form.customGameName.trim()
            : undefined,
        description: form.description.trim() || undefined,
        rules: form.rules.trim() || undefined,
        visibility: form.visibility,
        status: form.status,
        mode: form.mode,
        location: form.mode === "ONLINE" ? undefined : form.location.trim(),
        registrationOpen: form.registrationOpen,
        maxTeams: optionalNumber(form.maxTeams),
        maxTeamSize: maximumMembers,
        minAge: optionalNumber(form.minAge),
        maxAge: optionalNumber(form.maxAge),
        allowedGenders:
          form.allowedGenders.length > 0 ? form.allowedGenders : undefined,
        registrationStartDate: optionalIsoDate(form.registrationStartDate),
        registrationDeadline: optionalIsoDate(form.registrationDeadline),
        startDate: optionalIsoDate(form.startDate),
        endDate: optionalIsoDate(form.endDate),
        autoApproveTeams: form.autoApproveTeams,
        requireMemberFullInfo: form.requireMemberFullInfo,
        prizePool: form.prizePool.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        contactLink: form.contactLink.trim() || undefined,
        rounds: rounds.map((round): CreateRoundRequest => {
          const base = {
            name: round.name.trim(),
            bestOf: Number(round.bestOf) as NonNullable<
              CreateRoundRequest["bestOf"]
            >,
          };
          if (round.format === "PLAYOFF") {
            return {
              ...base,
              format: "PLAYOFF",
              settings: {
                scoringMode: round.scoringMode,
                thirdPlaceMatch: round.playoff.thirdPlaceMatch,
              },
            };
          }
          if (round.format === "DOUBLE_ELIM") {
            return {
              ...base,
              format: "DOUBLE_ELIM",
              settings: {
                scoringMode: round.scoringMode,
                grandFinalReset: round.doubleElim.grandFinalReset,
              },
            };
          }
          if (round.format === "SWISS") {
            return {
              ...base,
              format: "SWISS",
              settings: {
                scoringMode: round.scoringMode,
                mode:
                  round.swiss.mode === "THRESHOLD"
                    ? "THRESHOLD"
                    : "FIXED_ROUNDS",
                ...(round.swiss.mode === "THRESHOLD"
                  ? {
                      winsToAdvance: Number(round.swiss.winsToAdvance),
                      lossesToEliminate: Number(round.swiss.lossesToEliminate),
                    }
                  : {}),
                numberOfRounds:
                  round.swiss.mode === "THRESHOLD"
                    ? null
                    : (optionalNumber(round.swiss.numberOfRounds) ?? null),
                advancingTeamCount: Number(round.swiss.advancingTeamCount),
              },
            };
          }
          if (round.format === "GROUP_STAGE") {
            return {
              ...base,
              format: "GROUP_STAGE",
              settings: {
                scoringMode: round.scoringMode,
                numberOfGroups: Number(round.groupStage.numberOfGroups),
                advancingTeamsPerGroup: Number(
                  round.groupStage.advancingTeamsPerGroup,
                ),
                winPoints: Number(round.groupStage.winPoints),
                drawPoints: Number(round.groupStage.drawPoints),
                lossPoints: Number(round.groupStage.lossPoints),
                allowDraws: round.groupStage.allowDraws,
                meetingsPerPair: Number(round.groupStage.meetingsPerPair),
              },
            };
          }
          return {
            ...base,
            format: "ROUND_ROBIN",
            settings: {
              scoringMode: round.scoringMode,
              advancingTeamCount: Number(round.roundRobin.advancingTeamCount),
              winPoints: Number(round.roundRobin.winPoints),
              drawPoints: Number(round.roundRobin.drawPoints),
              lossPoints: Number(round.roundRobin.lossPoints),
              allowDraws: round.roundRobin.allowDraws,
              meetingsPerPair: Number(round.roundRobin.meetingsPerPair),
            },
          };
        }),
      });
      if (bannerFile) {
        try {
          await tournamentsApi.uploadBanner(tournament.id, bannerFile);
        } catch (uploadError) {
          setCreatedTournament({
            id: tournament.id,
            slug: tournament.slug,
            uploadError:
              uploadError instanceof Error
                ? uploadError.message
                : t("tournament.create.bannerUploadError"),
          });
          return;
        }
      }
      router.push(`/tournaments/${tournament.slug}`);
    } catch (submitError) {
      if (isEmailNotVerifiedError(submitError)) {
        setError(t("emailVerification.required"));
        return;
      }
      if (submitError instanceof ApiError && submitError.status === 401) {
        clearSession();
        setError(t("tournament.create.sessionExpired"));
        return;
      }
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("tournament.create.submitError"),
      );
    } finally {
      setLoading(false);
    }
  };

  const retryBannerUpload = async () => {
    if (!createdTournament || !bannerFile) return;
    setLoading(true);
    try {
      await tournamentsApi.uploadBanner(createdTournament.id, bannerFile);
      router.push(`/tournaments/${createdTournament.slug}`);
    } catch (uploadError) {
      setCreatedTournament((current) =>
        current
          ? {
              ...current,
              uploadError:
                uploadError instanceof Error
                  ? uploadError.message
                  : t("tournament.create.bannerUploadError"),
            }
          : current,
      );
    } finally {
      setLoading(false);
    }
  };

  if (ready && user?.emailVerifiedAt === null) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-16">
        <EmailVerificationNotice email={user.email} className="w-full" />
      </div>
    );
  }

  if (createdTournament) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-16">
        <section className="w-full rounded-2xl border border-approved/30 bg-surface-card p-6 shadow-[var(--shadow-elevated)] sm:p-8">
          <h1 className="text-xl font-bold text-ink">
            {t("tournament.create.created")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            {t("tournament.create.partialBannerPrefix")}{" "}
            {createdTournament.uploadError}{" "}
            {t("tournament.create.partialBannerSuffix")}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={retryBannerUpload}
              className="inline-flex rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {loading
                ? t("tournament.create.retryingBanner")
                : t("tournament.create.retryBanner")}
            </button>
            <Link
              href={`/tournaments/${createdTournament.slug}`}
              className={secondaryButtonClass}
            >
              {t("tournament.create.goToTournament")}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      style={accentVars(selectedGame?.name)}
      className="tournament-create-page relative w-full flex-1 overflow-x-clip px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
    >
      <div
        ref={wizardTopRef}
        className="relative z-10 mx-auto max-w-7xl scroll-mt-24"
      >
        <header className="max-w-2xl">
          <p className="text-sm font-semibold text-brand">
            {t("tournament.createHero.eyebrow")}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {t("tournament.createHero.title")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink-muted sm:text-base">
            {t("tournament.createHero.description")}
          </p>
        </header>

        <nav
          aria-label={t("tournament.createHero.title")}
          className="mt-8 overflow-x-auto rounded-xl border border-line bg-surface-card px-4 py-5 shadow-[0_1px_3px_rgb(15_23_42/0.05)] sm:px-6"
        >
          <div className="relative min-w-[38rem]">
            <div className="absolute left-[12.5%] right-[12.5%] top-5 h-0.5 bg-surface-sub" />
            <div
              className="absolute left-[12.5%] top-5 h-0.5 bg-brand transition-[width] duration-300"
              style={{ width: `${(currentStep / (steps.length - 1)) * 75}%` }}
            />
            <ol className="relative grid grid-cols-4 gap-2">
              {steps.map((label, index) => {
                const completed = index < currentStep;
                const active = index === currentStep;
                return (
                  <li key={label} className="text-center">
                    <button
                      type="button"
                      disabled={index > currentStep}
                      onClick={() => showStep(index)}
                      aria-current={active ? "step" : undefined}
                      className="group inline-flex w-full flex-col items-center gap-2 text-xs font-semibold text-ink-muted disabled:cursor-default"
                    >
                      <span
                        style={
                          active || completed
                            ? {
                                backgroundColor: "var(--color-brand)",
                                color: "var(--color-on-brand)",
                              }
                            : undefined
                        }
                        className={`relative grid size-10 place-items-center rounded-full border-2 bg-surface-card transition-colors ${
                          active || completed
                            ? "border-brand bg-brand text-on-brand"
                            : "border-line-strong text-ink-faint"
                        }`}
                      >
                        {completed ? (
                          <CheckIcon size={16} weight="bold" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span className={active ? "text-brand" : ""}>
                        {label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </nav>

        <div
          className={`mt-8 grid items-start gap-7 ${
            currentStep === 3
              ? "lg:grid-cols-[minmax(0,1.85fr)_minmax(18rem,1fr)]"
              : "grid-cols-1"
          }`}
        >
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="min-w-0 space-y-6"
          >
            {currentStep === 0 && (
              <>
                <TournamentFormSection
                  id="tournament-info"
                  Icon={IdentificationCardIcon}
                  title={t("tournament.create.section.info")}
                  description={t("tournament.create.section.infoDescription")}
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label htmlFor="name" className={labelClass}>
                        {t("tournament.create.name")}{" "}
                        <span className="text-rejected">*</span>
                      </label>
                      <input
                        id="name"
                        type="text"
                        name="name"
                        required
                        maxLength={150}
                        value={form.name}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder={t("tournament.create.namePlaceholder")}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <GameStructureFields
                        games={games}
                        value={{
                          gameId: form.gameId,
                          teamSize: form.teamSize,
                          maxTeamSize: form.maxTeamSize,
                          customGameName: form.customGameName,
                        }}
                        onChange={handleGameStructureChange}
                      />
                      {gamesError && (
                        <p className="mt-1.5 text-xs text-rejected">
                          {t("tournament.create.gamesLoadError")}
                        </p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <ImageUploadPicker
                        label={t("tournament.create.deviceBanner")}
                        file={bannerFile}
                        onFileChange={setBannerFile}
                        variant="banner"
                        dropzone
                        crop={{
                          aspect: 16 / 6,
                          maxWidth: 1600,
                          maxHeight: 600,
                        }}
                        disabled={loading}
                        uploading={loading && Boolean(bannerFile)}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="description" className={labelClass}>
                        {t("tournament.create.description")}
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        rows={3}
                        maxLength={2000}
                        value={form.description}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder={t(
                          "tournament.create.descriptionPlaceholder",
                        )}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="rules" className={labelClass}>
                        {t("tournament.create.rules")}
                      </label>
                      <textarea
                        id="rules"
                        name="rules"
                        rows={5}
                        maxLength={5000}
                        value={form.rules}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder={t("tournament.create.rulesPlaceholder")}
                      />
                    </div>
                  </div>
                </TournamentFormSection>

                <TournamentFormSection
                  id="tournament-organization"
                  Icon={SlidersHorizontalIcon}
                  title={t("tournament.create.section.organization")}
                  description={t(
                    "tournament.create.section.organizationDescription",
                  )}
                >
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label htmlFor="status" className={labelClass}>
                        {t("tournament.create.initialStatus")}
                      </label>
                      <select
                        id="status"
                        name="status"
                        value={form.status}
                        onChange={handleStatusChange}
                        className={inputClass}
                      >
                        <option value="REGISTRATION">
                          {t("tournament.create.openRegistration")}
                        </option>
                        <option value="DRAFT">
                          {t("tournament.create.draft")}
                        </option>
                      </select>
                    </div>
                    <fieldset>
                      <legend className={labelClass}>
                        {t("tournament.create.visibility")}
                      </legend>
                      <div className="grid grid-cols-2 rounded-xl border border-line bg-surface-sub p-1">
                        {(["PUBLIC", "PRIVATE"] as const).map((visibility) => (
                          <button
                            key={visibility}
                            type="button"
                            disabled={form.status === "DRAFT"}
                            aria-pressed={form.visibility === visibility}
                            onClick={() =>
                              setForm((current) => ({ ...current, visibility }))
                            }
                            className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
                              form.visibility === visibility
                                ? "bg-surface-card text-brand shadow-sm"
                                : "text-ink-muted hover:text-ink"
                            }`}
                          >
                            {t(
                              visibility === "PUBLIC"
                                ? "tournament.create.public"
                                : "tournament.create.private",
                            )}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className="sm:col-span-2 lg:col-span-1">
                      <legend className={labelClass}>
                        {t("tournament.create.mode")}
                      </legend>
                      <div className="grid grid-cols-3 rounded-xl border border-line bg-surface-sub p-1">
                        {(["ONLINE", "OFFLINE", "HYBRID"] as const).map(
                          (mode) => (
                            <button
                              key={mode}
                              type="button"
                              aria-pressed={form.mode === mode}
                              onClick={() =>
                                setForm((current) => ({ ...current, mode }))
                              }
                              className={`rounded-lg px-2 py-2.5 text-xs font-semibold transition-colors ${
                                form.mode === mode
                                  ? "bg-surface-card text-brand shadow-sm"
                                  : "text-ink-muted hover:text-ink"
                              }`}
                            >
                              {t(`tournament.mode.${mode}` as TranslationKey)}
                            </button>
                          ),
                        )}
                      </div>
                    </fieldset>
                    {form.mode !== "ONLINE" && (
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label htmlFor="location" className={labelClass}>
                          {t("tournament.create.location")}{" "}
                          <span className="text-rejected">*</span>
                        </label>
                        <input
                          id="location"
                          type="text"
                          name="location"
                          required
                          maxLength={255}
                          value={form.location}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder={t(
                            "tournament.create.locationPlaceholder",
                          )}
                        />
                      </div>
                    )}
                  </div>
                </TournamentFormSection>
              </>
            )}

            {currentStep === 1 && (
              <TournamentFormSection
                id="tournament-capacity"
                Icon={UsersThreeIcon}
                title={t("tournament.create.section.capacity")}
                description={t("tournament.create.section.capacityDescription")}
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="maxTeams" className={labelClass}>
                      {t("tournament.create.maxTeams")}
                    </label>
                    <input
                      id="maxTeams"
                      type="number"
                      name="maxTeams"
                      min={2}
                      max={256}
                      value={form.maxTeams}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder={t("common.unlimited")}
                    />
                  </div>
                </div>

                <div className="mt-6 grid gap-5 border-t border-line/70 pt-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="minAge" className={labelClass}>
                      {t("tournament.create.minAge")}
                    </label>
                    <input
                      id="minAge"
                      type="number"
                      name="minAge"
                      min={5}
                      max={100}
                      value={form.minAge}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder={t("common.unlimited")}
                    />
                  </div>
                  <div>
                    <label htmlFor="maxAge" className={labelClass}>
                      {t("tournament.create.maxAge")}
                    </label>
                    <input
                      id="maxAge"
                      type="number"
                      name="maxAge"
                      min={5}
                      max={100}
                      value={form.maxAge}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder={t("common.unlimited")}
                    />
                  </div>
                  <fieldset className="sm:col-span-2">
                    <legend className={labelClass}>
                      {t("tournament.create.allowedGenders")}
                    </legend>
                    <div className="flex flex-wrap gap-3">
                      {genderOptions.map((option) => (
                        <label
                          key={option}
                          className={`cursor-pointer rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                            form.allowedGenders.includes(option)
                              ? "border-brand/55 bg-brand/15 text-brand-hover"
                              : "border-line bg-surface text-ink-muted hover:border-line-strong"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={form.allowedGenders.includes(option)}
                            onChange={() => toggleGender(option)}
                            className="sr-only"
                          />
                          {t(
                            `auth.register.gender.${option.toLowerCase()}` as TranslationKey,
                          )}
                        </label>
                      ))}
                    </div>
                    <p className={hintClass}>
                      {t("tournament.create.genderHint")}
                    </p>
                  </fieldset>
                </div>
              </TournamentFormSection>
            )}

            {currentStep === 2 && (
              <>
                <TournamentFormSection
                  id="tournament-time"
                  Icon={CalendarBlankIcon}
                  title={t("tournament.create.section.time")}
                  description={t("tournament.create.section.timeDescription")}
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="registrationStartDate"
                        className={labelClass}
                      >
                        {t("tournament.create.registrationOpens")}
                      </label>
                      <input
                        id="registrationStartDate"
                        type="datetime-local"
                        name="registrationStartDate"
                        value={form.registrationStartDate}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="registrationDeadline"
                        className={labelClass}
                      >
                        {t("tournament.create.registrationDeadline")}
                      </label>
                      <input
                        id="registrationDeadline"
                        type="datetime-local"
                        name="registrationDeadline"
                        min={form.registrationStartDate || undefined}
                        value={form.registrationDeadline}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="startDate" className={labelClass}>
                        {t("tournament.create.tournamentStarts")}
                      </label>
                      <input
                        id="startDate"
                        type="datetime-local"
                        name="startDate"
                        min={
                          form.registrationDeadline ||
                          form.registrationStartDate ||
                          undefined
                        }
                        value={form.startDate}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="endDate" className={labelClass}>
                        {t("tournament.create.tournamentEnds")}
                      </label>
                      <input
                        id="endDate"
                        type="datetime-local"
                        name="endDate"
                        min={form.startDate || undefined}
                        value={form.endDate}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </TournamentFormSection>

                <TournamentFormSection
                  id="tournament-registration"
                  Icon={ShieldCheckIcon}
                  title={t("tournament.create.section.registration")}
                  description={t(
                    "tournament.create.section.registrationDescription",
                  )}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ToggleField
                      name="registrationOpen"
                      checked={form.registrationOpen}
                      onChange={handleChange}
                      disabled={form.status === "DRAFT"}
                      title={t("tournament.create.allowTeamRegistration")}
                      description={t(
                        "tournament.create.allowTeamRegistrationDescription",
                      )}
                    />
                    <ToggleField
                      name="autoApproveTeams"
                      checked={form.autoApproveTeams}
                      onChange={handleChange}
                      title={t("tournament.create.autoApprove")}
                      description={t(
                        "tournament.create.autoApproveDescription",
                      )}
                    />
                    <ToggleField
                      name="requireMemberFullInfo"
                      checked={form.requireMemberFullInfo}
                      onChange={handleChange}
                      title={t("tournament.create.requireMemberInfo")}
                      description={t(
                        "tournament.create.requireMemberInfoDescription",
                      )}
                    />
                  </div>
                </TournamentFormSection>

                <TournamentFormSection
                  id="tournament-prize"
                  Icon={TrophyIcon}
                  title={t("tournament.create.section.prize")}
                  description={t("tournament.create.section.prizeDescription")}
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label htmlFor="prizePool" className={labelClass}>
                        {t("tournament.create.prizePool")}
                      </label>
                      <textarea
                        id="prizePool"
                        name="prizePool"
                        rows={3}
                        maxLength={1000}
                        value={form.prizePool}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder={t("tournament.create.prizePlaceholder")}
                      />
                    </div>
                    <div>
                      <label htmlFor="contactEmail" className={labelClass}>
                        {t("tournament.create.contactEmail")}
                      </label>
                      <input
                        id="contactEmail"
                        type="email"
                        name="contactEmail"
                        value={form.contactEmail}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="organizer@example.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="contactPhone" className={labelClass}>
                        {t("tournament.create.contactPhone")}
                      </label>
                      <input
                        id="contactPhone"
                        type="tel"
                        name="contactPhone"
                        pattern="(0|\+84)[0-9]{9}"
                        value={form.contactPhone}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="0901234567"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="contactLink" className={labelClass}>
                        {t("tournament.create.contactLink")}
                      </label>
                      <input
                        id="contactLink"
                        type="url"
                        name="contactLink"
                        maxLength={500}
                        value={form.contactLink}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="https://discord.gg/..."
                      />
                    </div>
                  </div>
                </TournamentFormSection>
              </>
            )}

            {currentStep === 1 && (
              <TournamentRoundsSection
                rounds={rounds}
                maxTeams={form.maxTeams}
                expandedRoundIndex={expandedRoundIndex}
                setExpandedRoundIndex={setExpandedRoundIndex}
                addRound={addRound}
                removeRound={removeRound}
                updateRound={updateRound}
                updateScoringMode={updateScoringMode}
                updateRoundRobinSettings={updateRoundRobinSettings}
                updateGroupStageSettings={updateGroupStageSettings}
                updateSwissSettings={updateSwissSettings}
                updateEliminationSetting={updateEliminationSetting}
              />
            )}
            {currentStep === 3 && (
              <TournamentFormSection
                id="tournament-review"
                Icon={CheckIcon}
                title={t("tournament.create.reviewReady")}
                description={t("tournament.create.reviewHint")}
              >
                {user?.role === "ADMIN" && (
                  <div className="mb-5">
                    <ToggleField
                      name="isOfficial"
                      checked={form.isOfficial}
                      onChange={handleChange}
                      title={t("tournament.create.official")}
                      description={t("tournament.create.officialDescription")}
                    />
                  </div>
                )}
                <dl className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-ink-faint">
                      {t("tournament.create.name")}
                    </dt>
                    <dd className="mt-1 font-semibold text-ink">
                      {form.name || t("tournament.create.previewName")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-ink-faint">
                      {t("tournament.create.game")}
                    </dt>
                    <dd className="mt-1 font-semibold text-ink">
                      {selectedGame?.code === "CUSTOM"
                        ? form.customGameName
                        : selectedGame?.name ||
                          t("tournament.create.previewGame")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-ink-faint">
                      {t("tournament.create.maxTeams")}
                    </dt>
                    <dd className="mt-1 font-semibold text-ink">
                      {form.maxTeams || t("common.unlimited")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-ink-faint">
                      {t("tournament.create.section.rounds")}
                    </dt>
                    <dd className="mt-1 font-semibold text-ink">
                      {rounds.length}
                    </dd>
                  </div>
                </dl>
              </TournamentFormSection>
            )}

            {error && (
              <p role="alert" className={alertErrorClass}>
                {error}
              </p>
            )}

            <div className="sticky bottom-4 z-30 flex flex-col-reverse gap-3 rounded-xl border border-line bg-surface-card/95 p-4 shadow-[0_8px_24px_rgb(15_23_42/0.08)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-ink-faint">
                {t("tournament.create.systemManaged")}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    currentStep === 0
                      ? router.back()
                      : showStep(currentStep - 1)
                  }
                  className={secondaryButtonClass}
                >
                  {currentStep === 0
                    ? t("common.cancel")
                    : t("common.previous")}
                </button>
                {currentStep < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={goToNextStep}
                    className="inline-flex min-h-[var(--control-height)] items-center justify-center rounded-[var(--radius-control)] bg-brand px-6 py-3 text-sm font-semibold text-on-brand transition-[transform,filter] hover:brightness-110 active:scale-[0.98]"
                  >
                    {t("common.next")}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading || !ready || !user}
                    className="inline-flex min-h-[var(--control-height)] items-center justify-center rounded-[var(--radius-control)] bg-brand px-6 py-3 text-sm font-semibold text-on-brand transition-[transform,filter] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading
                      ? t("tournament.create.submitting")
                      : t("tournament.create.submit")}
                  </button>
                )}
              </div>
            </div>
          </form>
          {currentStep === 3 && (
            <TournamentLivePreview
              name={form.name}
              bannerFile={bannerFile}
              customGameName={form.customGameName}
              selectedGame={selectedGame}
              maxTeams={form.maxTeams}
              prizePool={form.prizePool}
              status={form.status}
            />
          )}
        </div>
      </div>
    </div>
  );
}
