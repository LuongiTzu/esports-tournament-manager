"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import { clearSession, useAuth } from "@/features/auth/store";
import { gamesApi } from "@/features/games/api";
import { accentVars } from "@/features/games/game-accent";
import type { Game } from "@/features/games/types";
import { tournamentsApi } from "@/features/tournaments/api";
import { ROUND_FORMATS } from "@/features/tournaments/round-formats";
import TournamentCreateHero from "@/features/tournaments/components/TournamentCreateHero";
import { ApiError } from "@/lib/api/client";

interface RoundForm {
  name: string;
  format: string;
  bestOf: string;
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
    <section className="overflow-hidden rounded-2xl border border-line bg-surface-card/90 shadow-xl shadow-black/10">
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
    { name: "Vòng bảng", format: "GROUP_STAGE", bestOf: "1" },
  ]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      type === "checkbox"
        ? (event.target as HTMLInputElement).checked
        : value;

    setForm((current) => ({ ...current, [name]: nextValue }));
  };

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const status = event.target.value as TournamentFormState["status"];
    setForm((current) => ({
      ...current,
      status,
      registrationOpen:
        status === "DRAFT" ? false : current.registrationOpen,
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

  const toggleGender = (gender: TournamentFormState["allowedGenders"][number]) => {
    setForm((current) => ({
      ...current,
      allowedGenders: current.allowedGenders.includes(gender)
        ? current.allowedGenders.filter((item) => item !== gender)
        : [...current.allowedGenders, gender],
    }));
  };

  const updateRound = (
    index: number,
    field: keyof RoundForm,
    value: string,
  ) => {
    setRounds((current) =>
      current.map((round, roundIndex) =>
        roundIndex === index ? { ...round, [field]: value } : round,
      ),
    );
  };

  const addRound = () => {
    setRounds((current) => [
      ...current,
      {
        name: `Vòng ${current.length + 1}`,
        format: "PLAYOFF",
        bestOf: "1",
      },
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
        location:
          form.mode === "ONLINE" ? undefined : form.location.trim(),
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
        rounds: rounds.map((round) => ({
          name: round.name.trim(),
          format: round.format,
          bestOf: Number(round.bestOf),
        })),
      });
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

              <div>
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
                  Bỏ trống để sử dụng ảnh giải đấu mặc định.
                </p>
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
                  min={form.registrationDeadline || form.registrationStartDate || undefined}
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
                  className="grid gap-3 rounded-xl border border-line bg-surface/55 p-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(12rem,0.65fr)_7rem_auto] sm:items-center"
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-brand/15 font-mono text-xs font-bold text-brand-hover">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={round.name}
                    onChange={(event) =>
                      updateRound(index, "name", event.target.value)
                    }
                    aria-label={`Tên vòng ${index + 1}`}
                    className={`${inputClass} bg-surface`}
                    placeholder="Tên vòng"
                  />
                  <select
                    value={round.format}
                    onChange={(event) =>
                      updateRound(index, "format", event.target.value)
                    }
                    aria-label={`Thể thức vòng ${index + 1}`}
                    className={`${inputClass} bg-surface`}
                  >
                    {ROUND_FORMATS.map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={round.bestOf}
                    onChange={(event) =>
                      updateRound(index, "bestOf", event.target.value)
                    }
                    aria-label={`Số ván vòng ${index + 1}`}
                    className={`${inputClass} bg-surface`}
                  >
                    {[1, 3, 5, 7, 9].map((bestOf) => (
                      <option key={bestOf} value={bestOf}>
                        BO{bestOf}
                      </option>
                    ))}
                  </select>
                  {rounds.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRound(index)}
                      aria-label={`Xóa vòng ${index + 1}`}
                      className="rounded-lg p-2 text-ink-faint transition hover:bg-rejected/10 hover:text-rejected"
                    >
                      <TrashIcon size={17} />
                    </button>
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

          <div className="sticky bottom-4 z-30 flex flex-col-reverse gap-3 rounded-2xl border border-line bg-surface-card/95 p-4 shadow-2xl shadow-black/35 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-ink-faint">
              Slug, người tổ chức và trạng thái xác minh được hệ thống tự quản lý.
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
