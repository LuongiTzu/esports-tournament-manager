"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BracketsCurlyIcon,
  CalendarBlankIcon,
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
import { clearSession, useAuth } from "@/features/auth/store";
import { gamesApi } from "@/features/games/api";
import { accentVars } from "@/features/games/game-accent";
import type { Game } from "@/features/games/types";
import { tournamentsApi } from "@/features/tournaments/api";
import {
  ROUND_FORMATS,
  type RoundFormatValue,
} from "@/features/tournaments/round-formats";
import TournamentCreateHero from "@/features/tournaments/components/TournamentCreateHero";
import type { CreateRoundRequest } from "@/features/tournaments/types";
import { ApiError } from "@/lib/api/client";

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
  description: string;
  rules: string;
  bannerUrl: string;
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
  description: "",
  rules: "",
  bannerUrl: "",
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

const genderOptions = [
  { value: "MALE", label: "Nam" },
  { value: "FEMALE", label: "Nữ" },
  { value: "OTHER", label: "Khác" },
] as const;

function optionalNumber(value: string) {
  return value === "" ? undefined : Number(value);
}

function optionalIsoDate(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function FormSection({
  Icon,
  title,
  description,
  children,
}: {
  Icon: Icon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface-card/90 shadow-[var(--shadow-elevated)]">
      <div className="flex items-start gap-3 border-b border-line/80 bg-surface-sub/45 px-5 py-4 sm:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand/20 to-brand-secondary/15 text-brand-hover">
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
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface/55 p-4 transition hover:border-brand/35">
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
  const [games, setGames] = useState<Game[]>([]);
  const [gamesError, setGamesError] = useState(false);
  const [form, setForm] = useState<TournamentFormState>(INITIAL_FORM);
  const [rounds, setRounds] = useState<RoundForm[]>([
    createRoundForm("Vòng bảng", "GROUP_STAGE"),
  ]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
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
  const minimumMembers = selectedGame?.defaultTeamSize;
  const maximumMembers = optionalNumber(form.maxTeamSize);
  const maximumSubstitutes =
    minimumMembers !== undefined && maximumMembers !== undefined
      ? Math.max(0, maximumMembers - minimumMembers)
      : undefined;

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

  const handleGameChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const gameId = event.target.value;
    const game = games.find((item) => item.id === gameId);
    setForm((current) => ({
      ...current,
      gameId,
      maxTeamSize: game ? String(game.maxTeamSize) : "",
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
      createRoundForm(`Vòng ${current.length + 1}`, "PLAYOFF"),
    ]);
  };

  const removeRound = (index: number) => {
    setRounds((current) =>
      current.filter((_, roundIndex) => roundIndex !== index),
    );
  };

  const validateForm = () => {
    if (form.mode !== "ONLINE" && !form.location.trim()) {
      return "Vui lòng nhập địa điểm cho giải Offline hoặc Hybrid.";
    }

    if (!selectedGame) {
      return "Vui lòng chọn trò chơi.";
    }

    if (
      maximumMembers === undefined ||
      !Number.isInteger(maximumMembers) ||
      maximumMembers < selectedGame.defaultTeamSize ||
      maximumMembers > selectedGame.maxTeamSize
    ) {
      return `Số thành viên tối đa phải từ ${selectedGame.defaultTeamSize} đến ${selectedGame.maxTeamSize}.`;
    }

    const minAge = optionalNumber(form.minAge);
    const maxAge = optionalNumber(form.maxAge);
    if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) {
      return "Tuổi tối thiểu không được lớn hơn tuổi tối đa.";
    }

    const timeline = [
      ["Thời điểm mở đăng ký", form.registrationStartDate],
      ["Hạn đăng ký", form.registrationDeadline],
      ["Thời điểm bắt đầu", form.startDate],
      ["Thời điểm kết thúc", form.endDate],
    ] as const;
    const suppliedDates = timeline
      .filter(([, value]) => value)
      .map(([label, value]) => [label, new Date(value).getTime()] as const);

    for (let index = 1; index < suppliedDates.length; index += 1) {
      if (suppliedDates[index][1] < suppliedDates[index - 1][1]) {
        return `${suppliedDates[index][0]} phải sau ${suppliedDates[index - 1][0]}.`;
      }
    }

    if (rounds.some((round) => !round.name.trim())) {
      return "Tên vòng đấu không được để trống.";
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
        return "S\u1ed1 v\u00f2ng Swiss ph\u1ea3i l\u00e0 s\u1ed1 nguy\u00ean t\u1eeb 1 \u0111\u1ebfn 20, ho\u1eb7c \u0111\u1ec3 tr\u1ed1ng \u0111\u1ec3 t\u1ef1 \u0111\u1ed9ng t\u00ednh.";
      }
      if (
        !Number.isInteger(advancingTeamCount) ||
        advancingTeamCount < 1 ||
        advancingTeamCount > 256
      ) {
        return "S\u1ed1 \u0111\u1ed9i \u0111i ti\u1ebfp t\u1eeb Swiss ph\u1ea3i l\u00e0 s\u1ed1 nguy\u00ean t\u1eeb 1 \u0111\u1ebfn 256.";
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
        return "S\u1ed1 b\u1ea3ng ph\u1ea3i l\u00e0 s\u1ed1 nguy\u00ean t\u1eeb 2 \u0111\u1ebfn 16.";
      }
      if (
        !Number.isInteger(advancingTeamsPerGroup) ||
        advancingTeamsPerGroup < 1
      ) {
        return "S\u1ed1 \u0111\u1ed9i \u0111i ti\u1ebfp m\u1ed7i b\u1ea3ng ph\u1ea3i l\u00e0 s\u1ed1 nguy\u00ean d\u01b0\u01a1ng.";
      }
      if (
        ![winPoints, drawPoints, lossPoints].every(
          (value) => Number.isInteger(value) && value >= 0 && value <= 100,
        )
      ) {
        return "\u0110i\u1ec3m v\u00f2ng b\u1ea3ng ph\u1ea3i l\u00e0 s\u1ed1 nguy\u00ean t\u1eeb 0 \u0111\u1ebfn 100.";
      }
      if (
        !Number.isInteger(meetingsPerPair) ||
        meetingsPerPair < 1 ||
        meetingsPerPair > 4
      ) {
        return "S\u1ed1 l\u01b0\u1ee3t g\u1eb7p nhau ph\u1ea3i l\u00e0 s\u1ed1 nguy\u00ean t\u1eeb 1 \u0111\u1ebfn 4.";
      }
      if (winPoints <= lossPoints) {
        return "\u0110i\u1ec3m th\u1eafng ph\u1ea3i l\u1edbn h\u01a1n \u0111i\u1ec3m thua.";
      }
      if (
        values.allowDraws &&
        (winPoints <= drawPoints || drawPoints < lossPoints)
      ) {
        return "Khi cho ph\u00e9p h\u00f2a, \u0111i\u1ec3m ph\u1ea3i th\u1ecfa: th\u1eafng > h\u00f2a \u2265 thua.";
      }
      const maxTeams = optionalNumber(form.maxTeams);
      if (maxTeams !== undefined) {
        if (maxTeams % numberOfGroups !== 0) {
          return "S\u1ed1 \u0111\u1ed9i t\u1ed1i \u0111a ph\u1ea3i chia h\u1ebft cho s\u1ed1 b\u1ea3ng \u0111\u1ec3 c\u00e1c b\u1ea3ng b\u1eb1ng nhau.";
        }
        if (advancingTeamsPerGroup >= maxTeams / numberOfGroups) {
          return "S\u1ed1 \u0111\u1ed9i \u0111i ti\u1ebfp m\u1ed7i b\u1ea3ng ph\u1ea3i \u00edt h\u01a1n s\u1ed1 \u0111\u1ed9i d\u1ef1 ki\u1ebfn trong b\u1ea3ng.";
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
        return "Điểm Round Robin phải là số nguyên từ 0 đến 100.";
      }
      if (
        !Number.isInteger(meetingsPerPair) ||
        meetingsPerPair < 1 ||
        meetingsPerPair > 4
      ) {
        return "Số lượt gặp nhau phải là số nguyên từ 1 đến 4.";
      }
      if (winPoints <= lossPoints) {
        return "Điểm thắng phải lớn hơn điểm thua.";
      }
      if (
        values.allowDraws &&
        (winPoints <= drawPoints || drawPoints < lossPoints)
      ) {
        return "Khi cho phép hòa, điểm phải thỏa: thắng > hòa ≥ thua.";
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

    setLoading(true);
    try {
      const tournament = await tournamentsApi.create({
        name: form.name.trim(),
        gameId: form.gameId,
        description: form.description.trim() || undefined,
        rules: form.rules.trim() || undefined,
        bannerUrl: form.bannerUrl.trim() || undefined,
        visibility: form.visibility,
        status: form.status,
        mode: form.mode,
        location: form.mode === "ONLINE" ? undefined : form.location.trim(),
        registrationOpen: form.registrationOpen,
        maxTeams: optionalNumber(form.maxTeams),
        maxTeamSize: maximumMembers!,
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
                : "Không thể tải banner lên.",
          });
          return;
        }
      }
      router.push(`/tournaments/${tournament.slug}`);
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 401) {
        clearSession();
        setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        return;
      }
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Tạo giải đấu thất bại.",
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
                  : "Không thể tải banner lên.",
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
          <h1 className="text-xl font-bold text-ink">Giải đấu đã được tạo</h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Banner chưa tải lên được: {createdTournament.uploadError} Giải đấu
            vẫn được giữ nguyên và sẽ không bị tạo lại.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={retryBannerUpload}
              className="inline-flex rounded-lg bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-50"
            >
              {loading ? "Đang tải lại…" : "Thử tải banner lại"}
            </button>
            <Link
              href={`/tournaments/${createdTournament.slug}`}
              className={secondaryButtonClass}
            >
              Đi tới giải đấu
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      style={accentVars(selectedGame?.name)}
      className="relative w-full flex-1 overflow-x-clip px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
    >
      <div className="mx-auto max-w-[90rem]">
        <TournamentCreateHero />

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-8 max-w-6xl space-y-6"
        >
          <FormSection
            Icon={IdentificationCardIcon}
            title="Thông tin giải đấu"
            description="Những nội dung người tham gia nhìn thấy đầu tiên khi khám phá giải."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="name" className={labelClass}>
                  Tên giải đấu <span className="text-rejected">*</span>
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
                  placeholder="Ví dụ: ArenaVERSE Summer Championship 2026"
                />
              </div>

              <div>
                <label htmlFor="gameId" className={labelClass}>
                  Trò chơi <span className="text-rejected">*</span>
                </label>
                <select
                  id="gameId"
                  name="gameId"
                  required
                  value={form.gameId}
                  onChange={handleGameChange}
                  className={inputClass}
                >
                  <option value="">Chọn trò chơi</option>
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.name} ({game.defaultTeamSize} người/đội)
                    </option>
                  ))}
                </select>
                {gamesError && (
                  <p className="mt-1.5 text-xs text-rejected">
                    Không tải được danh sách trò chơi. Vui lòng tải lại trang.
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="bannerUrl" className={labelClass}>
                  URL ảnh banner
                </label>
                <input
                  id="bannerUrl"
                  type="url"
                  name="bannerUrl"
                  maxLength={500}
                  value={form.bannerUrl}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="https://example.com/tournament-banner.jpg"
                />
                <p className={hintClass}>
                  Có thể giữ URL ảnh ngoài hoặc chọn một tệp từ thiết bị bên dưới.
                </p>
              </div>

              <div className="sm:col-span-2">
                <ImageUploadPicker
                  label="Banner từ thiết bị"
                  file={bannerFile}
                  onFileChange={setBannerFile}
                  existingUrl={form.bannerUrl}
                  variant="banner"
                  disabled={loading}
                  uploading={loading && Boolean(bannerFile)}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="description" className={labelClass}>
                  Mô tả
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  maxLength={2000}
                  value={form.description}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Giới thiệu mục tiêu, đối tượng và điểm nổi bật của giải đấu"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="rules" className={labelClass}>
                  Thể lệ
                </label>
                <textarea
                  id="rules"
                  name="rules"
                  rows={5}
                  maxLength={5000}
                  value={form.rules}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Luật thi đấu, quy định đội hình, cách xử lý vi phạm..."
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            Icon={SlidersHorizontalIcon}
            title="Cách tổ chức"
            description="Quyết định giải được công bố như thế nào và thi đấu ở đâu."
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="status" className={labelClass}>
                  Trạng thái khi tạo
                </label>
                <select
                  id="status"
                  name="status"
                  value={form.status}
                  onChange={handleStatusChange}
                  className={inputClass}
                >
                  <option value="REGISTRATION">Mở đăng ký</option>
                  <option value="DRAFT">Bản nháp</option>
                </select>
              </div>
              <div>
                <label htmlFor="visibility" className={labelClass}>
                  Chế độ hiển thị
                </label>
                <select
                  id="visibility"
                  name="visibility"
                  value={form.visibility}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="PUBLIC">Công khai</option>
                  <option value="PRIVATE">Riêng tư</option>
                </select>
              </div>
              <div>
                <label htmlFor="mode" className={labelClass}>
                  Hình thức tổ chức
                </label>
                <select
                  id="mode"
                  name="mode"
                  value={form.mode}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="ONLINE">Online</option>
                  <option value="OFFLINE">Offline</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </div>
              {form.mode !== "ONLINE" && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <label htmlFor="location" className={labelClass}>
                    Địa điểm <span className="text-rejected">*</span>
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
                    placeholder="Nhập địa chỉ tổ chức thi đấu"
                  />
                </div>
              )}
            </div>
          </FormSection>

          <FormSection
            Icon={UsersThreeIcon}
            title="Quy mô và điều kiện đội"
            description="Thiết lập sức chứa giải, kích thước đội hình và giới hạn người tham gia."
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="maxTeams" className={labelClass}>
                  Số đội tối đa
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
                  placeholder="Không giới hạn"
                />
              </div>
              <div>
                <label htmlFor="minTeamSize" className={labelClass}>
                  Thành viên tối thiểu
                </label>
                <input
                  id="minTeamSize"
                  type="number"
                  readOnly
                  value={minimumMembers ?? ""}
                  className={inputClass}
                  placeholder="Chọn game"
                />
                <p className={hintClass}>
                  {selectedGame
                    ? `Đội hình thi đấu mặc định của ${selectedGame.name}`
                    : "Tự động lấy theo trò chơi"}
                </p>
              </div>
              <div>
                <label htmlFor="maxTeamSize" className={labelClass}>
                  Thành viên tối đa
                </label>
                <input
                  id="maxTeamSize"
                  type="number"
                  name="maxTeamSize"
                  min={minimumMembers}
                  max={selectedGame?.maxTeamSize}
                  required
                  disabled={!selectedGame}
                  value={form.maxTeamSize}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Chọn game"
                />
                {selectedGame && (
                  <p className={hintClass}>
                    Cho phép từ {selectedGame.defaultTeamSize} đến{" "}
                    {selectedGame.maxTeamSize} cầu thủ
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="maxSubstitutes" className={labelClass}>
                  Dự bị tối đa
                </label>
                <input
                  id="maxSubstitutes"
                  type="number"
                  readOnly
                  value={maximumSubstitutes ?? ""}
                  className={inputClass}
                  placeholder="0"
                />
                <p className={hintClass}>
                  Tự động tính từ số thành viên tối đa
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 border-t border-line/70 pt-6 sm:grid-cols-2">
              <div>
                <label htmlFor="minAge" className={labelClass}>
                  Tuổi tối thiểu
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
                  placeholder="Không giới hạn"
                />
              </div>
              <div>
                <label htmlFor="maxAge" className={labelClass}>
                  Tuổi tối đa
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
                  placeholder="Không giới hạn"
                />
              </div>
              <fieldset className="sm:col-span-2">
                <legend className={labelClass}>Giới tính được phép</legend>
                <div className="flex flex-wrap gap-3">
                  {genderOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                        form.allowedGenders.includes(option.value)
                          ? "border-brand/55 bg-brand/15 text-brand-hover"
                          : "border-line bg-surface text-ink-muted hover:border-line-strong"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.allowedGenders.includes(option.value)}
                        onChange={() => toggleGender(option.value)}
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <p className={hintClass}>
                  Không chọn mục nào nếu giải không giới hạn giới tính.
                </p>
              </fieldset>
            </div>
          </FormSection>

          <FormSection
            Icon={CalendarBlankIcon}
            title="Thời gian"
            description="Các mốc được sắp theo thứ tự mở đăng ký, đóng đăng ký, bắt đầu và kết thúc."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="registrationStartDate" className={labelClass}>
                  Mở đăng ký
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
                  Hạn đăng ký
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
                  Bắt đầu giải
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
                  Kết thúc giải
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
            Icon={ShieldCheckIcon}
            title="Đăng ký và duyệt đội"
            description="Kiểm soát cách đội gửi hồ sơ và đi vào danh sách tham dự."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <ToggleField
                name="registrationOpen"
                checked={form.registrationOpen}
                onChange={handleChange}
                title="Cho phép đăng ký đội"
                description="Các đội có thể gửi hồ sơ ngay khi giải được công bố."
              />
              <ToggleField
                name="autoApproveTeams"
                checked={form.autoApproveTeams}
                onChange={handleChange}
                title="Tự động duyệt đội"
                description="Đội hợp lệ được duyệt ngay mà không cần chờ ban tổ chức."
              />
              <ToggleField
                name="requireMemberFullInfo"
                checked={form.requireMemberFullInfo}
                onChange={handleChange}
                title="Yêu cầu đầy đủ hồ sơ thành viên"
                description="Mỗi thành viên phải cung cấp đủ thông tin theo yêu cầu của hệ thống."
              />
            </div>
          </FormSection>

          <FormSection
            Icon={TrophyIcon}
            title="Giải thưởng và liên hệ"
            description="Giúp đội tham gia biết quyền lợi và cách liên hệ với ban tổ chức."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="prizePool" className={labelClass}>
                  Cơ cấu giải thưởng
                </label>
                <textarea
                  id="prizePool"
                  name="prizePool"
                  rows={3}
                  maxLength={1000}
                  value={form.prizePool}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Ví dụ: Vô địch 10.000.000đ, Á quân 5.000.000đ..."
                />
              </div>
              <div>
                <label htmlFor="contactEmail" className={labelClass}>
                  Email liên hệ
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
                  Số điện thoại
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
                  Fanpage hoặc Discord
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

          <FormSection
            Icon={BracketsCurlyIcon}
            title="Các vòng đấu"
            description="Mỗi vòng có thể dùng một thể thức và số ván thắng riêng."
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addRound}
                className={`${secondaryButtonClass} px-3 py-2 text-xs`}
              >
                <PlusIcon size={14} weight="bold" />
                Thêm vòng
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {rounds.map((round, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-line bg-surface/55 p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(12rem,0.65fr)_7rem_auto] sm:items-end">
                    <span className="grid size-8 place-items-center self-center rounded-lg bg-brand/15 font-mono text-xs font-bold text-brand-hover">
                      {index + 1}
                    </span>
                    <label className={labelClass}>
                      Tên vòng
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={round.name}
                        onChange={(event) =>
                          updateRound(index, "name", event.target.value)
                        }
                        className={`${inputClass} mt-1 bg-surface`}
                        placeholder="Tên vòng"
                      />
                    </label>
                    <label className={labelClass}>
                      Hình thức thi đấu
                      <select
                        value={round.format}
                        onChange={(event) =>
                          updateRound(index, "format", event.target.value)
                        }
                        className={`${inputClass} mt-1 bg-surface`}
                      >
                        {ROUND_FORMATS.map((format) => (
                          <option key={format.value} value={format.value}>
                            {format.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={labelClass}>
                      Best of
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
                    {rounds.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRound(index)}
                        aria-label={`Xóa vòng ${index + 1}`}
                        className="mb-1 rounded-lg p-2 text-ink-faint transition hover:bg-rejected/10 hover:text-rejected"
                      >
                        <TrashIcon size={17} />
                      </button>
                    )}
                  </div>

                  {round.format === "ROUND_ROBIN" && (
                    <div className="mt-4 border-t border-line/70 pt-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
                        Cài đặt Round Robin
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <label className={labelClass}>
                          Số lượt gặp nhau
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
                            Số lượt mỗi cặp đội gặp nhau trong vòng này (1–4).
                          </span>
                        </label>
                        <label className={labelClass}>
                          Điểm thắng
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
                          Điểm thua
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
                            Cho phép hòa
                          </span>
                        </label>
                        <label
                          className={`${labelClass} ${
                            round.roundRobin.allowDraws ? "" : "opacity-50"
                          }`}
                        >
                          Điểm hòa
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
                        Cài đặt Swiss
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className={labelClass}>
                          Số vòng Swiss
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
                            placeholder="Tự động"
                          />
                          <span className={`${hintClass} mt-1 block`}>
                            Số lượt ghép cặp Swiss. Để trống để hệ thống tính từ
                            số đội thực tế khi sinh vòng.
                          </span>
                        </label>
                        <label className={labelClass}>
                          Số đội đi tiếp
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
                            Các đội đứng đầu bảng xếp hạng cuối cùng sẽ vào vòng
                            tiếp theo.
                          </span>
                        </label>
                      </div>
                      <div className="mt-3 rounded-lg border border-line bg-surface/70 px-3 py-2.5 text-xs leading-5 text-ink-muted">
                        <p>
                          Đội có thành tích gần nhau được ưu tiên ghép cặp. Hệ
                          thống tránh tái đấu khi còn phương án hợp lệ; các trận
                          Swiss phải có đội thắng.
                        </p>
                        {!round.swiss.numberOfRounds &&
                          optionalNumber(form.maxTeams) !== undefined && (
                            <p className="mt-1">
                              Dự kiến theo sức chứa tối đa:{" "}
                              {Math.ceil(
                                Math.log2(optionalNumber(form.maxTeams)!),
                              )}{" "}
                              vòng. Số vòng thực tế được tính lại khi sinh vòng.
                            </p>
                          )}
                      </div>
                    </div>
                  )}
                  {round.format === "PLAYOFF" && (
                    <div className="mt-4 border-t border-line/70 pt-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
                        Cài đặt loại trực tiếp
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
                            Thi đấu tranh hạng ba
                          </span>
                          <span className={`${hintClass} mt-1 block`}>
                            Hai đội thua ở bán kết thi đấu thêm một trận để xác
                            định hạng ba.
                          </span>
                        </span>
                      </label>
                    </div>
                  )}
                  {round.format === "DOUBLE_ELIM" && (
                    <div className="mt-4 border-t border-line/70 pt-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
                        Cài đặt nhánh thắng - nhánh thua
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
                            Grand Final Reset
                          </span>
                          <span className={`${hintClass} mt-1 block`}>
                            Nếu đội từ nhánh thua thắng Grand Final đầu tiên,
                            hai đội sẽ đấu thêm một trận quyết định.
                          </span>
                        </span>
                      </label>
                    </div>
                  )}
                  {round.format === "GROUP_STAGE" && (
                    <div className="mt-4 border-t border-line/70 pt-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
                        Cài đặt vòng bảng
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <label className={labelClass}>
                          Số bảng
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
                          Số đội đi tiếp mỗi bảng
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
                          Số lượt gặp nhau
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
                          Điểm thắng
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
                          Điểm thua
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
                          Điểm hòa
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
                            Cho phép hòa
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
                            hasValidPreview && maxTeams % numberOfGroups === 0;
                          return (
                            <>
                              {capacityDivides ? (
                                <p>
                                  Dự kiến theo sức chứa tối đa:{" "}
                                  {maxTeams / numberOfGroups} đội / bảng.
                                </p>
                              ) : hasValidPreview ? (
                                <p className="text-rejected" role="alert">
                                  Sức chứa tối đa {maxTeams} đội không thể chia
                                  đều vào {numberOfGroups} bảng.
                                </p>
                              ) : (
                                <p>
                                  Số đội mỗi bảng sẽ được tính từ các đội thực
                                  tế khi sinh vòng.
                                </p>
                              )}
                              {Number.isInteger(numberOfGroups) &&
                                Number.isInteger(advancingTeamsPerGroup) && (
                                  <p>
                                    Tổng{" "}
                                    {numberOfGroups * advancingTeamsPerGroup}{" "}
                                    đội vào vòng tiếp theo.
                                  </p>
                                )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </FormSection>

          {error && (
            <p role="alert" className={alertErrorClass}>
              {error}
            </p>
          )}

          <div className="sticky bottom-4 z-30 flex flex-col-reverse gap-3 rounded-2xl border border-line bg-surface-card/95 p-4 shadow-[var(--shadow-elevated)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-ink-faint">
              Slug, người tổ chức và trạng thái xác minh được hệ thống tự quản
              lý.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className={secondaryButtonClass}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading || !ready || !user}
                className="inline-flex items-center justify-center rounded-lg bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-on-brand shadow-lg shadow-brand/15 transition hover:brightness-110 hover:shadow-glow-brand active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Đang tạo..." : "Tạo giải đấu"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
