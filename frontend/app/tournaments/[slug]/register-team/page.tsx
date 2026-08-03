"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { tournamentsApi, teamsApi, TournamentDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { accentVars } from "@/lib/gameAccents";
import {
  alertErrorClass,
  hintClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "@/components/ui";

/** Trần cứng của RegisterTeamDto — `members` chỉ nhận tối đa 5 phần tử */
const MAX_EXTRA_MEMBERS = 5;

interface MemberForm {
  ign: string;
  contactInfo: string;
}

export default function RegisterTeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { user, ready } = useAuth();

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [members, setMembers] = useState<MemberForm[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.push("/login");
      return;
    }
    tournamentsApi
      .findBySlug(slug)
      .then((t) => {
        setTournament(t);
        // Đội trưởng được backend tự thêm làm thành viên đầu tiên,
        // nên form chỉ nhập các thành viên còn lại
        const teamSize = t.game?.teamSize ?? 1;
        const seed = Math.min(Math.max(teamSize - 1, 0), MAX_EXTRA_MEMBERS);
        setMembers(Array.from({ length: seed }, () => ({ ign: "", contactInfo: "" })));
      })
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Không tải được giải đấu"),
      )
      .finally(() => setLoading(false));
  }, [slug, ready, user, router]);

  const updateMember = (i: number, field: keyof MemberForm, value: string) =>
    setMembers(members.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;
    setError("");

    const filled = members
      .map((m) => ({ ign: m.ign.trim(), contactInfo: m.contactInfo.trim() }))
      .filter((m) => m.ign);

    setSubmitting(true);
    try {
      await teamsApi.register(tournament.id, {
        name: name.trim(),
        logoUrl: logoUrl.trim() || undefined,
        members: filled.length
          ? filled.map((m) => ({
              ign: m.ign,
              ...(m.contactInfo ? { contactInfo: m.contactInfo } : {}),
            }))
          : undefined,
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

  if (loadError || !tournament) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
        <p className={alertErrorClass}>{loadError || "Không tìm thấy giải đấu"}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-brand hover:underline">
          Về danh sách giải
        </Link>
      </div>
    );
  }

  const teamSize = tournament.game?.teamSize ?? 1;
  const closed = !tournament.registrationOpen;
  const full =
    Boolean(tournament.maxTeams) &&
    (tournament._count?.teams ?? 0) >= (tournament.maxTeams as number);

  return (
    <div
      style={accentVars(tournament.game?.name)}
      className="mx-auto w-full max-w-2xl flex-1 px-4 py-10"
    >
      <Link
        href={`/tournaments/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
      >
        <ArrowLeftIcon size={16} />
        {tournament.name}
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        Đăng ký đội tham gia
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Đội của bạn sẽ ở trạng thái chờ duyệt cho tới khi ban tổ chức xác nhận.
      </p>

      {closed || full ? (
        <div className="mt-8 rounded-xl border border-line bg-surface-card px-6 py-12 text-center">
          <p className="font-medium text-ink">
            {closed ? "Giải đấu đã đóng đăng ký" : "Giải đấu đã đủ số đội"}
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Bạn vẫn có thể theo dõi diễn biến ở trang giải đấu.
          </p>
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
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="Tên đội của bạn"
                />
                <p className={hintClass}>Tối đa 50 ký tự.</p>
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
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className={inputClass}
                  placeholder="https://..."
                />
                <p className={hintClass}>Không bắt buộc.</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-surface-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-ink">Thành viên còn lại</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Bạn đã được tính là đội trưởng.{" "}
                  {tournament.game?.name ? `${tournament.game.name} thi đấu ` : ""}
                  {teamSize} người mỗi đội, nên cần thêm {Math.max(teamSize - 1, 0)}{" "}
                  thành viên.
                </p>
              </div>
              {members.length < MAX_EXTRA_MEMBERS && (
                <button
                  type="button"
                  onClick={() =>
                    setMembers([...members, { ign: "", contactInfo: "" }])
                  }
                  className={`${secondaryButtonClass} shrink-0 px-3 py-2 text-xs`}
                >
                  <PlusIcon size={14} weight="bold" />
                  Thêm
                </button>
              )}
            </div>

            {teamSize - 1 > MAX_EXTRA_MEMBERS && (
              <p className="mt-4 rounded-lg border border-pending/40 bg-pending/10 px-3.5 py-2.5 text-xs text-pending">
                Hệ thống hiện chỉ nhận tối đa {MAX_EXTRA_MEMBERS} thành viên kèm
                đăng ký. Những người còn lại sẽ được ban tổ chức bổ sung sau khi
                duyệt đội.
              </p>
            )}

            {members.length === 0 ? (
              <p className="mt-5 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">
                Chưa có thành viên nào. Bạn có thể đăng ký trước rồi bổ sung sau.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {members.map((m, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-3 rounded-lg border border-line bg-surface-sub p-3 sm:flex-row sm:items-center"
                  >
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-surface font-mono text-xs text-ink-muted">
                      {i + 2}
                    </span>
                    <input
                      type="text"
                      maxLength={30}
                      value={m.ign}
                      onChange={(e) => updateMember(i, "ign", e.target.value)}
                      aria-label={`Tên trong game của thành viên ${i + 2}`}
                      className={`${inputClass} flex-1 bg-surface`}
                      placeholder="Tên trong game (IGN)"
                    />
                    <input
                      type="text"
                      maxLength={100}
                      value={m.contactInfo}
                      onChange={(e) =>
                        updateMember(i, "contactInfo", e.target.value)
                      }
                      aria-label={`Liên hệ của thành viên ${i + 2}`}
                      className={`${inputClass} flex-1 bg-surface`}
                      placeholder="Liên hệ (tùy chọn)"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setMembers(members.filter((_, idx) => idx !== i))
                      }
                      aria-label={`Xóa thành viên ${i + 2}`}
                      className="shrink-0 rounded-lg p-2 text-ink-faint transition hover:bg-rejected/10 hover:text-rejected"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className={`${hintClass} mt-4`}>
              Dòng để trống IGN sẽ được bỏ qua khi gửi.
            </p>
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
