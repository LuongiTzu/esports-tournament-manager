"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useAuth } from "@/features/auth/store";
import { accentVars } from "@/features/games/game-accent";
import { teamsApi } from "@/features/teams/api";
import type { Gender, TeamRegistrationForm } from "@/features/teams/types";
import {
  alertErrorClass,
  hintClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "@/components/ui";

interface MemberForm {
  realName: string;
  ign: string;
  email: string;
  phoneNumber: string;
  birthDate: string;
  gender: "" | Gender;
  position: string;
}

const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: "MALE", label: "Nam" },
  { value: "FEMALE", label: "Nữ" },
  { value: "OTHER", label: "Khác" },
];

function emptyMember(): MemberForm {
  return {
    realName: "",
    ign: "",
    email: "",
    phoneNumber: "",
    birthDate: "",
    gender: "",
    position: "",
  };
}

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function initialMembers(config: TeamRegistrationForm): MemberForm[] {
  const captain = config.prefill.captainMember;
  const firstMember: MemberForm = {
    ...emptyMember(),
    realName: captain.realName,
    email: captain.email,
    phoneNumber: captain.phoneNumber ?? "",
    birthDate: toDateInput(captain.birthDate),
    gender: captain.gender ?? "",
  };

  return Array.from({ length: config.tournament.minTeamSize }, (_, index) =>
    index === 0 ? firstMember : emptyMember(),
  );
}

export default function RegisterTeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { user, ready } = useAuth();

  const [config, setConfig] = useState<TeamRegistrationForm | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [members, setMembers] = useState<MemberForm[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.push("/login");
      return;
    }

    teamsApi
      .getRegistrationForm(slug)
      .then((data) => {
        setConfig(data);
        setContactName(data.prefill.contactName);
        setContactEmail(data.prefill.contactEmail);
        setContactPhone(data.prefill.contactPhone ?? "");
        setMembers(initialMembers(data));
      })
      .catch((err) =>
        setLoadError(
          err instanceof Error ? err.message : "Không tải được thông tin đăng ký",
        ),
      )
      .finally(() => setLoading(false));
  }, [slug, ready, user, router]);

  const updateMember = (
    index: number,
    field: keyof MemberForm,
    value: string,
  ) => {
    setMembers((current) =>
      current.map((member, memberIndex) =>
        memberIndex === index ? { ...member, [field]: value } : member,
      ),
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!config?.canRegister) return;
    setError("");

    if (members.some((member) => !member.email.trim() && !member.phoneNumber.trim())) {
      setError("Mỗi thành viên phải có ít nhất email hoặc số điện thoại liên hệ");
      return;
    }

    setSubmitting(true);
    try {
      await teamsApi.register(slug, {
        name: name.trim(),
        logoUrl: logoUrl.trim() || undefined,
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim() || undefined,
        members: members.map((member, index) => ({
          realName: member.realName.trim(),
          ign: member.ign.trim(),
          email: member.email.trim() || undefined,
          phoneNumber: member.phoneNumber.trim() || undefined,
          birthDate: member.birthDate || undefined,
          gender: member.gender || undefined,
          position: member.position || undefined,
          memberRole: index === 0 ? "CAPTAIN" : "PLAYER",
          orderIndex: index,
        })),
      });
      router.push(`/tournaments/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng ký đội thất bại");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-16">
        <div aria-hidden className="space-y-4">
          <div className="h-8 w-1/2 rounded bg-surface-card" />
          <div className="h-48 rounded-xl bg-surface-card" />
        </div>
      </div>
    );
  }

  if (loadError || !config) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
        <p className={alertErrorClass}>
          {loadError || "Không tìm thấy thông tin đăng ký"}
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-brand hover:underline">
          Về danh sách giải
        </Link>
      </div>
    );
  }

  const rules = config.tournament;
  const requiresBirthDate =
    rules.requireMemberFullInfo || rules.minAge !== null || rules.maxAge !== null;
  const requiresGender =
    rules.requireMemberFullInfo || Boolean(rules.allowedGenders?.length);
  const requiresPosition =
    rules.requireMemberFullInfo && config.game.positions.length > 0;
  const genderOptions = rules.allowedGenders?.length
    ? GENDER_OPTIONS.filter((option) => rules.allowedGenders?.includes(option.value))
    : GENDER_OPTIONS;

  return (
    <div
      style={accentVars(config.game.name)}
      className="mx-auto w-full max-w-2xl flex-1 px-4 py-10"
    >
      <Link
        href={`/tournaments/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
      >
        <ArrowLeftIcon size={16} />
        {rules.name}
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        Đăng ký đội tham gia
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Đội của bạn sẽ ở trạng thái chờ duyệt cho tới khi ban tổ chức xác nhận.
      </p>

      {!config.canRegister ? (
        <div className="mt-8 rounded-xl border border-line bg-surface-card px-6 py-12 text-center">
          <p className="font-medium text-ink">Hiện không thể đăng ký đội</p>
          <p className="mt-2 text-sm text-ink-muted">{config.reason}</p>
          <Link
            href={`/tournaments/${slug}`}
            className={`${secondaryButtonClass} mt-5`}
          >
            Về trang giải đấu
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <section className="rounded-xl border border-line bg-surface-card p-6">
            <h2 className="font-semibold text-ink">Thông tin đội</h2>

            <div className="mt-5 space-y-5">
              <div>
                <label htmlFor="teamName" className={labelClass}>
                  Tên đội
                </label>
                <input
                  id="teamName"
                  type="text"
                  required
                  maxLength={50}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={inputClass}
                  placeholder="Tên đội của bạn"
                />
              </div>

              <div>
                <label htmlFor="logoUrl" className={labelClass}>
                  Link logo đội
                </label>
                <input
                  id="logoUrl"
                  type="url"
                  maxLength={500}
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  className={inputClass}
                  placeholder="https://..."
                />
                <p className={hintClass}>Không bắt buộc.</p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="contactName" className={labelClass}>
                    Người đại diện
                  </label>
                  <input
                    id="contactName"
                    type="text"
                    required
                    maxLength={100}
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="contactEmail" className={labelClass}>
                    Email đại diện
                  </label>
                  <input
                    id="contactEmail"
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contactPhone" className={labelClass}>
                  Số điện thoại đại diện
                </label>
                <input
                  id="contactPhone"
                  type="tel"
                  maxLength={20}
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  className={inputClass}
                />
                <p className={hintClass}>Không bắt buộc.</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-surface-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-ink">Danh sách thành viên</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {config.game.name} yêu cầu từ {rules.minTeamSize} đến{" "}
                  {rules.maxTeamSize} thành viên thi đấu. Thành viên đầu tiên là đội
                  trưởng.
                </p>
              </div>
              {members.length < rules.maxTeamSize && (
                <button
                  type="button"
                  onClick={() => setMembers((current) => [...current, emptyMember()])}
                  className={`${secondaryButtonClass} shrink-0 px-3 py-2 text-xs`}
                >
                  <PlusIcon size={14} weight="bold" />
                  Thêm
                </button>
              )}
            </div>

            <div className="mt-5 space-y-4">
              {members.map((member, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-line bg-surface-sub p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">
                      {index === 0 ? "Đội trưởng" : `Thành viên ${index + 1}`}
                    </p>
                    {index > 0 && members.length > rules.minTeamSize && (
                      <button
                        type="button"
                        onClick={() =>
                          setMembers((current) =>
                            current.filter((_, memberIndex) => memberIndex !== index),
                          )
                        }
                        aria-label={`Xóa thành viên ${index + 1}`}
                        className="rounded-lg p-2 text-ink-faint transition hover:bg-rejected/10 hover:text-rejected"
                      >
                        <TrashIcon size={16} />
                      </button>
                    )}
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={member.realName}
                      onChange={(event) =>
                        updateMember(index, "realName", event.target.value)
                      }
                      aria-label={`Tên thật của thành viên ${index + 1}`}
                      className={`${inputClass} bg-surface`}
                      placeholder="Tên thật"
                    />
                    <input
                      type="text"
                      required
                      maxLength={30}
                      value={member.ign}
                      onChange={(event) =>
                        updateMember(index, "ign", event.target.value)
                      }
                      aria-label={`IGN của thành viên ${index + 1}`}
                      className={`${inputClass} bg-surface`}
                      placeholder="Tên thi đấu (IGN)"
                    />
                    <input
                      type="email"
                      value={member.email}
                      onChange={(event) =>
                        updateMember(index, "email", event.target.value)
                      }
                      aria-label={`Email của thành viên ${index + 1}`}
                      className={`${inputClass} bg-surface`}
                      placeholder="Email liên hệ"
                    />
                    <input
                      type="tel"
                      maxLength={20}
                      value={member.phoneNumber}
                      onChange={(event) =>
                        updateMember(index, "phoneNumber", event.target.value)
                      }
                      aria-label={`Số điện thoại của thành viên ${index + 1}`}
                      className={`${inputClass} bg-surface`}
                      placeholder="Số điện thoại liên hệ"
                    />

                    {requiresBirthDate && (
                      <input
                        type="date"
                        required
                        value={member.birthDate}
                        onChange={(event) =>
                          updateMember(index, "birthDate", event.target.value)
                        }
                        aria-label={`Ngày sinh của thành viên ${index + 1}`}
                        className={`${inputClass} bg-surface`}
                      />
                    )}

                    {requiresGender && (
                      <select
                        required
                        value={member.gender}
                        onChange={(event) =>
                          updateMember(index, "gender", event.target.value)
                        }
                        aria-label={`Giới tính của thành viên ${index + 1}`}
                        className={`${inputClass} bg-surface`}
                      >
                        <option value="">Chọn giới tính</option>
                        {genderOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {config.game.positions.length > 0 && (
                      <select
                        required={requiresPosition}
                        value={member.position}
                        onChange={(event) =>
                          updateMember(index, "position", event.target.value)
                        }
                        aria-label={`Vị trí của thành viên ${index + 1}`}
                        className={`${inputClass} bg-surface`}
                      >
                        <option value="">Chọn vị trí thi đấu</option>
                        {config.game.positions.map((position) => (
                          <option key={position} value={position}>
                            {position}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <p className={`${hintClass} mt-3`}>
                    Cần ít nhất email hoặc số điện thoại cho thành viên này.
                  </p>
                </div>
              ))}
            </div>
          </section>

          {error && (
            <p role="alert" className={alertErrorClass}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Link href={`/tournaments/${slug}`} className={secondaryButtonClass}>
              Hủy
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Đang gửi..." : "Gửi đăng ký"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
