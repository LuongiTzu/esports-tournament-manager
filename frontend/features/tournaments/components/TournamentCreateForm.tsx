"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BracketsCurlyIcon,
  CalendarBlankIcon,
  CheckIcon,
  IdentificationCardIcon,
  PlusIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TrashIcon,
  TrophyIcon,
  UsersThreeIcon,
  type Icon,
} from "@phosphor-icons/react";
import {
  alertErrorClass,
  hintClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "@/components/ui";
import ImageUploadPicker from "@/components/ImageUploadPicker";
import SideRays from "@/components/effects/SideRays";
import { clearSession, useAuth } from "@/features/auth/store";
import { gamesApi } from "@/features/games/api";
import { accentVars } from "@/features/games/game-accent";
import type { Game } from "@/features/games/types";
import GameStructureFields, {
  type GameStructureValue,
} from "@/features/games/components/GameStructureFields";
import {
  DoubleEliminationIcon,
  GroupStageIcon,
  RoundRobinIcon,
  SingleEliminationIcon,
  SwissStageIcon,
  type TournamentFormatIcon,
} from "@/features/home/components/TournamentFormatIcons";
import { tournamentsApi } from "@/features/tournaments/api";
import {
  ROUND_FORMATS,
  type RoundFormatValue,
} from "@/features/tournaments/round-formats";
import TournamentLivePreview from "@/features/tournaments/components/TournamentLivePreview";
import type { CreateRoundRequest } from "@/features/tournaments/types";
import { ApiError } from "@/lib/api/client";
import { useLocale, type TranslationKey } from "@/features/locale/store";

interface RoundForm {
  name: string;
  format: RoundFormatValue;
  bestOf: string;
  roundRobin: {
    winPoints: string;
    drawPoints: string;
    lossPoints: string;
    allowDraws: boolean;
    meetingsPerPair: string;
  };
  groupStage: {
    numberOfGroups: string;
    advancingTeamsPerGroup: string;
    winPoints: string;
    drawPoints: string;
    lossPoints: string;
    allowDraws: boolean;
    meetingsPerPair: string;
  };
  swiss: {
    numberOfRounds: string;
    advancingTeamCount: string;
  };
  playoff: {
    thirdPlaceMatch: boolean;
  };
  doubleElim: {
    grandFinalReset: boolean;
  };
}

const DEFAULT_ROUND_ROBIN_SETTINGS: RoundForm["roundRobin"] = {
  winPoints: "3",
  drawPoints: "1",
  lossPoints: "0",
  allowDraws: false,
  meetingsPerPair: "1",
};

const DEFAULT_GROUP_STAGE_SETTINGS: RoundForm["groupStage"] = {
  numberOfGroups: "2",
  advancingTeamsPerGroup: "2",
  winPoints: "3",
  drawPoints: "1",
  lossPoints: "0",
  allowDraws: false,
  meetingsPerPair: "1",
};

const DEFAULT_SWISS_SETTINGS: RoundForm["swiss"] = {
  numberOfRounds: "",
  advancingTeamCount: "8",
};

const DEFAULT_PLAYOFF_SETTINGS: RoundForm["playoff"] = {
  thirdPlaceMatch: true,
};

const DEFAULT_DOUBLE_ELIM_SETTINGS: RoundForm["doubleElim"] = {
  grandFinalReset: true,
};

function createRoundForm(name: string, format: RoundFormatValue): RoundForm {
  return {
    name,
    format,
    bestOf: "1",
    roundRobin: { ...DEFAULT_ROUND_ROBIN_SETTINGS },
    groupStage: { ...DEFAULT_GROUP_STAGE_SETTINGS },
    swiss: { ...DEFAULT_SWISS_SETTINGS },
    playoff: { ...DEFAULT_PLAYOFF_SETTINGS },
    doubleElim: { ...DEFAULT_DOUBLE_ELIM_SETTINGS },
  };
}

interface TournamentFormState {
  name: string;
  gameId: string;
  teamSize: string;
  customGameName: string;
  description: string;
  rules: string;
  visibility: "PUBLIC" | "PRIVATE";
  status: "DRAFT" | "REGISTRATION";
  mode: "ONLINE" | "OFFLINE" | "HYBRID";
  location: string;
  registrationOpen: boolean;
  maxTeams: string;
  maxTeamSize: string;
  minAge: string;
  maxAge: string;
  allowedGenders: Array<"MALE" | "FEMALE" | "OTHER">;
  registrationStartDate: string;
  registrationDeadline: string;
  startDate: string;
  endDate: string;
  autoApproveTeams: boolean;
  requireMemberFullInfo: boolean;
  prizePool: string;
  contactEmail: string;
  contactPhone: string;
  contactLink: string;
}

const INITIAL_FORM: TournamentFormState = {
  name: "",
  gameId: "",
  teamSize: "",
  customGameName: "",
  description: "",
  rules: "",
  visibility: "PUBLIC",
  status: "REGISTRATION",
  mode: "ONLINE",
  location: "",
  registrationOpen: true,
  maxTeams: "",
  maxTeamSize: "",
  minAge: "",
  maxAge: "",
  allowedGenders: [],
  registrationStartDate: "",
  registrationDeadline: "",
  startDate: "",
  endDate: "",
  autoApproveTeams: false,
  requireMemberFullInfo: true,
  prizePool: "",
  contactEmail: "",
  contactPhone: "",
  contactLink: "",
};

const genderOptions = ["MALE", "FEMALE", "OTHER"] as const;

const ROUND_FORMAT_ICONS: Record<RoundFormatValue, TournamentFormatIcon> = {
  ROUND_ROBIN: RoundRobinIcon,
  GROUP_STAGE: GroupStageIcon,
  SWISS: SwissStageIcon,
  PLAYOFF: SingleEliminationIcon,
  DOUBLE_ELIM: DoubleEliminationIcon,
};

function RoundFormatMark({
  format,
  index,
}: {
  format: RoundFormatValue;
  index: number;
}) {
  const FormatIcon = ROUND_FORMAT_ICONS[format];

  return (
    <span className="flex items-center gap-2 self-center text-brand">
      <span className="grid size-10 place-items-center rounded-lg border border-brand/20 bg-brand/10">
        <FormatIcon className="size-6" />
      </span>
      <span className="font-mono text-xs font-bold">{index + 1}</span>
    </span>
  );
}

function optionalNumber(value: string) {
  return value === "" ? undefined : Number(value);
}

function optionalIsoDate(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function FormSection({
  id,
  Icon,
  title,
  description,
  children,
}: {
  id: string;
  Icon: Icon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 overflow-hidden rounded-xl border border-line bg-surface-card shadow-[0_1px_3px_rgb(15_23_42/0.05)]"
    >
      <div className="flex items-start gap-3 border-b border-line/80 px-5 py-5 sm:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand/25 bg-brand/12 text-brand-hover">
          <Icon size={22} weight="duotone" />
        </span>
        <div>
          <h2 className="font-bold text-ink">{title}</h2>
          <p className="mt-0.5 text-sm leading-6 text-ink-muted">
            {description}
          </p>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function ToggleField({
  name,
  checked,
  onChange,
  title,
  description,
}: {
  name: keyof TournamentFormState;
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface/55 p-4 transition-[border-color,background-color,transform] hover:border-brand/45 hover:bg-surface-hover/70 active:scale-[0.99]">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
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
  const [expandedRoundIndex, setExpandedRoundIndex] = useState<number | null>(0);
  const formRef = useRef<HTMLFormElement>(null);
  const wizardTopRef = useRef<HTMLDivElement>(null);
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
    wizardTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goToNextStep = () => {
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
      registrationOpen: status === "DRAFT" ? false : current.registrationOpen,
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
    for (const round of rounds) {
      if (round.format !== "SWISS") continue;
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
      const winPoints = Number(values.winPoints);
      const drawPoints = Number(values.drawPoints);
      const lossPoints = Number(values.lossPoints);
      const meetingsPerPair = Number(values.meetingsPerPair);
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
            bestOf: Number(round.bestOf),
          };
          if (round.format === "PLAYOFF") {
            return {
              ...base,
              format: "PLAYOFF",
              settings: {
                thirdPlaceMatch: round.playoff.thirdPlaceMatch,
              },
            };
          }
          if (round.format === "DOUBLE_ELIM") {
            return {
              ...base,
              format: "DOUBLE_ELIM",
              settings: {
                grandFinalReset: round.doubleElim.grandFinalReset,
              },
            };
          }
          if (round.format === "SWISS") {
            return {
              ...base,
              format: "SWISS",
              settings: {
                numberOfRounds:
                  optionalNumber(round.swiss.numberOfRounds) ?? null,
                advancingTeamCount: Number(round.swiss.advancingTeamCount),
              },
            };
          }
          if (round.format === "GROUP_STAGE") {
            return {
              ...base,
              format: "GROUP_STAGE",
              settings: {
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
              className="inline-flex rounded-lg bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-50"
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
      <SideRays
        speed={2.5}
        rayColor1="#EAB308"
        rayColor2="#96C8FF"
        intensity={2}
        spread={2}
        origin="top-right"
        tilt={0}
        saturation={1.5}
        blend={0.75}
        falloff={1.6}
        opacity={1}
      />

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
                      <span className={active ? "text-brand" : ""}>{label}</span>
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
          <form ref={formRef} onSubmit={handleSubmit} className="min-w-0 space-y-6">
            {currentStep === 0 && (
              <>
            <FormSection
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
                  crop={{ aspect: 16 / 6, maxWidth: 1600, maxHeight: 600 }}
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
                  placeholder={t("tournament.create.descriptionPlaceholder")}
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
            </FormSection>

            <FormSection
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
                        aria-pressed={form.visibility === visibility}
                        onClick={() =>
                          setForm((current) => ({ ...current, visibility }))
                        }
                        className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
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
                    placeholder={t("tournament.create.locationPlaceholder")}
                  />
                </div>
              )}
            </div>
            </FormSection>

              </>
            )}

            {currentStep === 1 && (
            <FormSection
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
            </FormSection>
            )}

            {currentStep === 2 && (
              <>
            <FormSection
              id="tournament-time"
              Icon={CalendarBlankIcon}
              title={t("tournament.create.section.time")}
              description={t("tournament.create.section.timeDescription")}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="registrationStartDate" className={labelClass}>
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
                <label htmlFor="registrationDeadline" className={labelClass}>
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
            </FormSection>

            <FormSection
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
                description={t("tournament.create.autoApproveDescription")}
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
            </FormSection>

            <FormSection
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
            </FormSection>

              </>
            )}

            {currentStep === 1 && (
            <FormSection
              id="tournament-rounds"
              Icon={BracketsCurlyIcon}
              title={t("tournament.create.section.rounds")}
              description={t("tournament.create.section.roundsDescription")}
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addRound}
                className={`${secondaryButtonClass} px-3 py-2 text-xs`}
              >
                <PlusIcon size={14} weight="bold" />
                {t("tournament.create.addRound")}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {rounds.map((round, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-line bg-surface/55 p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_7rem_auto_auto] sm:items-end">
                    <RoundFormatMark format={round.format} index={index} />
                    <label className={labelClass}>
                      {t("tournament.create.roundName")}
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={round.name}
                        onChange={(event) =>
                            updateRound(index, "name", event.target.value)
                          }
                          className={`${inputClass} mt-1 bg-surface`}
                          placeholder={t(
                            "tournament.create.roundNamePlaceholder",
                          )}
                        />
                      </label>
                    <label className={labelClass}>
                      {t("round.settings.bestOf")}
                      <select
                        value={round.bestOf}
                        onChange={(event) =>
                          updateRound(index, "bestOf", event.target.value)
                        }
                        className={`${inputClass} mt-1 bg-surface`}
                      >
                        {[1, 3, 5, 7, 9].map((bestOf) => (
                          <option key={bestOf} value={bestOf}>
                            BO{bestOf}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedRoundIndex((current) =>
                          current === index ? null : index,
                        )
                      }
                      className="mb-1 rounded-lg border border-line bg-surface-card px-3 py-2 text-xs font-semibold text-brand transition-colors hover:bg-brand/10"
                    >
                      {expandedRoundIndex === index
                        ? t("common.close")
                        : t("common.edit")}
                    </button>
                    {rounds.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRound(index)}
                        aria-label={`${t("tournament.create.removeRound")} ${index + 1}`}
                        className="mb-1 rounded-lg p-2 text-ink-faint transition hover:bg-rejected/10 hover:text-rejected"
                      >
                        <TrashIcon size={17} />
                      </button>
                    )}
                  </div>

                  <div className="mt-4">
                    <p className={labelClass}>
                      {t("tournament.create.roundFormat")}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                      {ROUND_FORMATS.map((format) => {
                        const FormatIcon = ROUND_FORMAT_ICONS[format.value];
                        const selected = round.format === format.value;

                        return (
                          <button
                            key={format.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              updateRound(index, "format", format.value)
                            }
                            className={`group flex min-h-24 flex-col items-center justify-center border px-3 py-3 text-center transition-[border-color,background-color,color,transform,box-shadow] active:scale-[0.98] ${
                              selected
                                ? "border-brand bg-brand/10 text-brand shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-brand)_22%,transparent)]"
                                : "border-line bg-surface-card text-ink-muted hover:border-brand/45 hover:bg-brand/5 hover:text-ink"
                            }`}
                          >
                            <FormatIcon
                              className={`size-9 transition-transform duration-200 group-hover:scale-105 ${
                                selected ? "text-brand" : "text-ink-faint"
                              }`}
                            />
                            <span className="mt-2 text-xs font-bold leading-4">
                              {t(format.labelKey)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {expandedRoundIndex === index && (
                    <>
                  {round.format === "ROUND_ROBIN" && (
                    <div className="mt-4 border-t border-line/70 pt-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
                        {t("tournament.create.roundRobinSettings")}
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <label className={labelClass}>
                          {t("tournament.create.meetingsPerPair")}
                          <input
                            type="number"
                            min={1}
                            max={4}
                            step={1}
                            value={round.roundRobin.meetingsPerPair}
                            onChange={(event) =>
                              updateRoundRobinSettings(
                                index,
                                "meetingsPerPair",
                                event.target.value,
                              )
                            }
                            className={`${inputClass} mt-1 bg-surface`}
                          />
                          <span className={`${hintClass} mt-1 block`}>
                            {t("tournament.create.meetingsHint")}
                          </span>
                        </label>
                        <label className={labelClass}>
                          {t("tournament.create.winPoints")}
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={round.roundRobin.winPoints}
                            onChange={(event) =>
                              updateRoundRobinSettings(
                                index,
                                "winPoints",
                                event.target.value,
                              )
                            }
                            className={`${inputClass} mt-1 bg-surface`}
                          />
                        </label>
                        <label className={labelClass}>
                          {t("tournament.create.lossPoints")}
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={round.roundRobin.lossPoints}
                            onChange={(event) =>
                              updateRoundRobinSettings(
                                index,
                                "lossPoints",
                                event.target.value,
                              )
                            }
                            className={`${inputClass} mt-1 bg-surface`}
                          />
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface/70 px-3 py-2.5 sm:self-start lg:mt-5">
                          <input
                            type="checkbox"
                            checked={round.roundRobin.allowDraws}
                            onChange={(event) =>
                              updateRoundRobinSettings(
                                index,
                                "allowDraws",
                                event.target.checked,
                              )
                            }
                            className="size-4 accent-[var(--color-brand)]"
                          />
                          <span className="text-sm font-semibold text-ink">
                            {t("tournament.create.allowDraws")}
                          </span>
                        </label>
                        <label
                          className={`${labelClass} ${
                            round.roundRobin.allowDraws ? "" : "opacity-50"
                          }`}
                        >
                          {t("tournament.create.drawPoints")}
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            disabled={!round.roundRobin.allowDraws}
                            value={round.roundRobin.drawPoints}
                            onChange={(event) =>
                              updateRoundRobinSettings(
                                index,
                                "drawPoints",
                                event.target.value,
                              )
                            }
                            className={`${inputClass} mt-1 bg-surface disabled:cursor-not-allowed`}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                  {round.format === "SWISS" && (
                    <div className="mt-4 border-t border-line/70 pt-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
                        {t("tournament.create.swissSettings")}
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className={labelClass}>
                          {t("tournament.create.swissRounds")}
                          <input
                            type="number"
                            min={1}
                            max={20}
                            step={1}
                            value={round.swiss.numberOfRounds}
                            onChange={(event) =>
                              updateSwissSettings(
                                index,
                                "numberOfRounds",
                                event.target.value,
                                )
                              }
                              className={`${inputClass} mt-1 bg-surface`}
                              placeholder={t(
                                "tournament.create.automaticPlaceholder",
                              )}
                            />
                            <span className={`${hintClass} mt-1 block`}>
                              {t("tournament.create.swissRoundsHint")}
                          </span>
                        </label>
                        <label className={labelClass}>
                          {t("tournament.create.advancingTeams")}
                          <input
                            type="number"
                            min={1}
                            max={256}
                            step={1}
                            value={round.swiss.advancingTeamCount}
                            onChange={(event) =>
                              updateSwissSettings(
                                index,
                                "advancingTeamCount",
                                event.target.value,
                              )
                            }
                            className={`${inputClass} mt-1 bg-surface`}
                          />
                          <span className={`${hintClass} mt-1 block`}>
                            {t("tournament.create.advancingTeamsHint")}
                          </span>
                          </label>
                        </div>
                        <div className="mt-3 rounded-lg border border-line bg-surface/70 px-3 py-2.5 text-xs leading-5 text-ink-muted">
                          <p>{t("tournament.create.swissBehavior")}</p>
                          {!round.swiss.numberOfRounds &&
                            optionalNumber(form.maxTeams) !== undefined && (
                              <p className="mt-1">
                              {t("tournament.create.estimatedCapacity")}:{" "}
                              {Math.ceil(
                                Math.log2(optionalNumber(form.maxTeams)!),
                              )}{" "}
                              {t("tournament.create.actualRoundsHint")}
                            </p>
                          )}
                      </div>
                    </div>
                  )}
                  {round.format === "PLAYOFF" && (
                    <div className="mt-4 border-t border-line/70 pt-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
                        {t("tournament.create.playoffSettings")}
                      </p>
                      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface/70 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={round.playoff.thirdPlaceMatch}
                          onChange={(event) =>
                            updateEliminationSetting(
                              index,
                              "PLAYOFF",
                              event.target.checked,
                            )
                          }
                          className="mt-0.5 size-4 accent-[var(--color-brand)]"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-ink">
                            {t("tournament.create.thirdPlace")}
                          </span>
                          <span className={`${hintClass} mt-1 block`}>
                            {t("tournament.create.thirdPlaceHint")}
                          </span>
                        </span>
                      </label>
                    </div>
                  )}
                  {round.format === "DOUBLE_ELIM" && (
                    <div className="mt-4 border-t border-line/70 pt-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
                        {t("tournament.create.doubleElimSettings")}
                      </p>
                      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface/70 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={round.doubleElim.grandFinalReset}
                          onChange={(event) =>
                            updateEliminationSetting(
                              index,
                              "DOUBLE_ELIM",
                              event.target.checked,
                            )
                          }
                          className="mt-0.5 size-4 accent-[var(--color-brand)]"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-ink">
                            {t("round.settings.grandFinalReset")}
                          </span>
                          <span className={`${hintClass} mt-1 block`}>
                            {t("tournament.create.grandFinalResetHint")}
                          </span>
                        </span>
                      </label>
                    </div>
                  )}
                  {round.format === "GROUP_STAGE" && (
                    <div className="mt-4 border-t border-line/70 pt-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
                        {t("tournament.create.groupSettings")}
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <label className={labelClass}>
                          {t("tournament.create.numberOfGroups")}
                          <input
                            type="number"
                            min={2}
                            max={16}
                            step={1}
                            value={round.groupStage.numberOfGroups}
                            onChange={(event) =>
                              updateGroupStageSettings(
                                index,
                                "numberOfGroups",
                                event.target.value,
                              )
                            }
                            className={`${inputClass} mt-1 bg-surface`}
                          />
                        </label>
                        <label className={labelClass}>
                          {t("tournament.create.advancePerGroup")}
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={round.groupStage.advancingTeamsPerGroup}
                            onChange={(event) =>
                              updateGroupStageSettings(
                                index,
                                "advancingTeamsPerGroup",
                                event.target.value,
                              )
                            }
                            className={`${inputClass} mt-1 bg-surface`}
                          />
                        </label>
                        <label className={labelClass}>
                          {t("tournament.create.meetingsPerPair")}
                          <select
                            value={round.groupStage.meetingsPerPair}
                            onChange={(event) =>
                              updateGroupStageSettings(
                                index,
                                "meetingsPerPair",
                                event.target.value,
                              )
                            }
                            className={`${inputClass} mt-1 bg-surface`}
                          >
                            {[1, 2, 3, 4].map((meetings) => (
                              <option key={meetings} value={meetings}>
                                {meetings}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={labelClass}>
                          {t("tournament.create.winPoints")}
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={round.groupStage.winPoints}
                            onChange={(event) =>
                              updateGroupStageSettings(
                                index,
                                "winPoints",
                                event.target.value,
                              )
                            }
                            className={`${inputClass} mt-1 bg-surface`}
                          />
                        </label>
                        <label className={labelClass}>
                          {t("tournament.create.lossPoints")}
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={round.groupStage.lossPoints}
                            onChange={(event) =>
                              updateGroupStageSettings(
                                index,
                                "lossPoints",
                                event.target.value,
                              )
                            }
                            className={`${inputClass} mt-1 bg-surface`}
                          />
                        </label>
                        <label
                          className={`${labelClass} ${
                            round.groupStage.allowDraws ? "" : "opacity-50"
                          }`}
                        >
                          {t("tournament.create.drawPoints")}
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            disabled={!round.groupStage.allowDraws}
                            value={round.groupStage.drawPoints}
                            onChange={(event) =>
                              updateGroupStageSettings(
                                index,
                                "drawPoints",
                                event.target.value,
                              )
                            }
                            className={`${inputClass} mt-1 bg-surface disabled:cursor-not-allowed`}
                          />
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface/70 px-3 py-2.5 sm:self-start">
                          <input
                            type="checkbox"
                            checked={round.groupStage.allowDraws}
                            onChange={(event) =>
                              updateGroupStageSettings(
                                index,
                                "allowDraws",
                                event.target.checked,
                              )
                            }
                            className="size-4 accent-[var(--color-brand)]"
                          />
                          <span className="text-sm font-semibold text-ink">
                            {t("tournament.create.allowDraws")}
                          </span>
                        </label>
                      </div>
                      <div className="mt-3 space-y-1 rounded-lg border border-line bg-surface/70 px-3 py-2.5 text-xs text-ink-muted">
                        {(() => {
                          const maxTeams = optionalNumber(form.maxTeams);
                          const numberOfGroups = Number(
                            round.groupStage.numberOfGroups,
                          );
                          const advancingTeamsPerGroup = Number(
                            round.groupStage.advancingTeamsPerGroup,
                          );
                          const hasValidPreview =
                            maxTeams !== undefined &&
                              Number.isInteger(numberOfGroups) &&
                              numberOfGroups >= 2;
                            const capacityDivides =
                              hasValidPreview &&
                              maxTeams % numberOfGroups === 0;
                            return (
                              <>
                                {capacityDivides ? (
                                  <p>
                                    {t("tournament.create.estimatedCapacity")}:{" "}
                                    {maxTeams / numberOfGroups}{" "}
                                    {t(
                                      "tournament.create.teamsPerGroupEstimated",
                                    )}
                                  </p>
                                ) : hasValidPreview ? (
                                  <p className="text-rejected" role="alert">
                                    {t("tournament.create.maxTeams")} {maxTeams}{" "}
                                    {t(
                                      "tournament.create.capacityCannotDivide",
                                    )}{" "}
                                    {numberOfGroups}{" "}
                                    {t("tournament.create.groupsUnit")}
                                  </p>
                                ) : (
                                  <p>
                                    {t(
                                      "tournament.create.teamsPerGroupActualHint",
                                    )}
                                  </p>
                                )}
                                {Number.isInteger(numberOfGroups) &&
                                Number.isInteger(advancingTeamsPerGroup) && (
                                  <p>
                                    {t("tournament.create.total")}{" "}
                                    {numberOfGroups * advancingTeamsPerGroup}{" "}
                                    {t("tournament.create.advanceNextRound")}
                                  </p>
                                )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </FormSection>
            )}

            {currentStep === 3 && (
              <FormSection
                id="tournament-review"
                Icon={CheckIcon}
                title={t("tournament.create.reviewReady")}
                description={t("tournament.create.reviewHint")}
              >
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
              </FormSection>
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
