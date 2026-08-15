"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useAuth } from "@/features/auth/store";
import { gamesApi } from "@/features/games/api";
import { accentVars } from "@/features/games/game-accent";
import type { Game } from "@/features/games/types";
import { tournamentsApi } from "@/features/tournaments/api";
import { ROUND_FORMATS } from "@/features/tournaments/round-formats";
import {
  alertErrorClass,
  hintClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "@/components/ui";

interface RoundForm {
  name: string;
  format: string;
}

export default function NewTournamentPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [form, setForm] = useState({
    name: "",
    gameId: "",
    description: "",
    rules: "",
    visibility: "PUBLIC",
    registrationOpen: true,
    maxTeams: "",
    startDate: "",
    endDate: "",
  });
  const [rounds, setRounds] = useState<RoundForm[]>([
    { name: "Vòng bảng", format: "GROUP_STAGE" },
  ]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.push("/login");
      return;
    }
    gamesApi
      .findAll()
      .then(setGames)
      .catch(() => setGames([]));
  }, [router, ready, user]);

  const selectedGame = games.find((g) => g.id === form.gameId);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;
    setForm({
      ...form,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    });
  };

  const updateRound = (i: number, field: keyof RoundForm, value: string) => {
    setRounds(rounds.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const addRound = () =>
    setRounds([
      ...rounds,
      { name: `Vòng ${rounds.length + 1}`, format: "PLAYOFF" },
    ]);

  const removeRound = (i: number) =>
    setRounds(rounds.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError("Ngày kết thúc không được trước ngày bắt đầu");
      return;
    }
    if (rounds.some((r) => !r.name.trim())) {
      setError("Tên vòng đấu không được để trống");
      return;
    }

    setLoading(true);
    try {
      const t = await tournamentsApi.create({
        name: form.name,
        gameId: form.gameId,
        description: form.description || undefined,
        rules: form.rules || undefined,
        visibility: form.visibility,
        registrationOpen: form.registrationOpen,
        maxTeams: form.maxTeams ? Number(form.maxTeams) : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        rounds: rounds.map((r) => ({ name: r.name.trim(), format: r.format })),
      });
      router.push(`/tournaments/${t.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo giải thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={accentVars(selectedGame?.name)}
      className="mx-auto w-full max-w-3xl flex-1 px-4 py-10"
    >
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        Tạo giải đấu mới
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Giải đấu được công khai ngay sau khi tạo. Bạn có thể sửa lại thông tin
        sau.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <section className="rounded-xl border border-line bg-surface-card p-6">
          <h2 className="font-semibold text-ink">Thông tin giải đấu</h2>

          <div className="mt-5 space-y-5">
            <div>
              <label htmlFor="name" className={labelClass}>
                Tên giải đấu
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
                placeholder="Ví dụ: Giải Sinh viên Mùa Xuân 2026"
              />
              <p className={hintClass}>Tối đa 150 ký tự.</p>
            </div>

            <div>
              <label htmlFor="gameId" className={labelClass}>
                Game
              </label>
              <select
                id="gameId"
                name="gameId"
                required
                value={form.gameId}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">Chọn game</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.defaultTeamSize} người/đội)
                  </option>
                ))}
              </select>
              {selectedGame && (
                <p className={hintClass}>
                  Giải sẽ hiển thị theo tông màu của{" "}
                  <span className="font-medium text-accent">
                    {selectedGame.name}
                  </span>
                  .
                </p>
              )}
            </div>

            <div>
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
                placeholder="Giới thiệu ngắn về giải đấu"
              />
            </div>

            <div>
              <label htmlFor="rules" className={labelClass}>
                Thể lệ
              </label>
              <textarea
                id="rules"
                name="rules"
                rows={4}
                maxLength={5000}
                value={form.rules}
                onChange={handleChange}
                className={inputClass}
                placeholder="Luật thi đấu, quy định về đội hình, xử lý vi phạm"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="maxTeams" className={labelClass}>
                  Số đội tối đa
                </label>
                <input
                  id="maxTeams"
                  type="number"
                  name="maxTeams"
                  min={2}
                  value={form.maxTeams}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Không giới hạn"
                />
                <p className={hintClass}>Ít nhất 2 đội. Bỏ trống nếu không giới hạn.</p>
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
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="startDate" className={labelClass}>
                  Ngày bắt đầu
                </label>
                <input
                  id="startDate"
                  type="date"
                  name="startDate"
                  value={form.startDate}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="endDate" className={labelClass}>
                  Ngày kết thúc
                </label>
                <input
                  id="endDate"
                  type="date"
                  name="endDate"
                  min={form.startDate || undefined}
                  value={form.endDate}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-line bg-surface-sub p-3.5">
              <input
                type="checkbox"
                name="registrationOpen"
                checked={form.registrationOpen}
                onChange={handleChange}
                className="mt-0.5 size-4 accent-[var(--color-brand)]"
              />
              <span>
                <span className="block text-sm font-medium text-ink">
                  Mở đăng ký đội ngay
                </span>
                <span className="block text-xs text-ink-faint">
                  Các đội có thể nộp đăng ký ngay khi giải được tạo.
                </span>
              </span>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-ink">Các vòng đấu</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Mỗi vòng chọn thể thức riêng. Sơ đồ thi đấu sẽ được sinh ở bước
                sau.
              </p>
            </div>
            <button
              type="button"
              onClick={addRound}
              className={`${secondaryButtonClass} shrink-0 px-3 py-2 text-xs`}
            >
              <PlusIcon size={14} weight="bold" />
              Thêm vòng
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {rounds.map((r, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-lg border border-line bg-surface-sub p-3 sm:flex-row sm:items-center"
              >
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-surface font-mono text-xs text-ink-muted">
                  {i + 1}
                </span>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={r.name}
                  onChange={(e) => updateRound(i, "name", e.target.value)}
                  aria-label={`Tên vòng ${i + 1}`}
                  className={`${inputClass} flex-1 bg-surface`}
                  placeholder="Tên vòng"
                />
                <select
                  value={r.format}
                  onChange={(e) => updateRound(i, "format", e.target.value)}
                  aria-label={`Thể thức vòng ${i + 1}`}
                  className={`${inputClass} bg-surface sm:w-56`}
                >
                  {ROUND_FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {rounds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRound(i)}
                    aria-label={`Xóa vòng ${i + 1}`}
                    className="shrink-0 rounded-lg p-2 text-ink-faint transition hover:bg-rejected/10 hover:text-rejected"
                  >
                    <TrashIcon size={16} />
                  </button>
                )}
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
          <button
            type="button"
            onClick={() => router.back()}
            className={secondaryButtonClass}
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Đang tạo..." : "Tạo giải đấu"}
          </button>
        </div>
      </form>
    </div>
  );
}
