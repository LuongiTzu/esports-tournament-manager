"use client";

import { useState } from "react";
import {
  CalendarBlankIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  LockKeyIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import { tournamentsApi } from "@/features/tournaments/api";
import type { TournamentDetail } from "@/features/tournaments/types";

const STATUS_LABELS: Record<TournamentDetail["status"], string> = {
  DRAFT: "Bản nháp",
  REGISTRATION: "Đang đăng ký",
  ONGOING: "Đang thi đấu",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};

function formatDateTime(value?: string | null) {
  if (!value) return "Không giới hạn";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function TournamentLifecycleControls({
  tournament,
  onRefresh,
}: {
  tournament: TournamentDetail;
  onRefresh: () => Promise<void>;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const registrationCanBeToggled = tournament.status === "REGISTRATION";

  const toggleRegistration = async () => {
    if (working || !registrationCanBeToggled) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const nextOpen = !tournament.registrationOpen;
      await tournamentsApi.updateLifecycle(tournament.id, {
        registrationOpen: nextOpen,
      });
      await onRefresh();
      setNotice(nextOpen ? "Đã mở nhận đăng ký." : "Đã đóng nhận đăng ký.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể cập nhật trạng thái đăng ký.",
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <section
      aria-labelledby="lifecycle-heading"
      className="rounded-2xl border border-line bg-surface-card p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Lifecycle
          </p>
          <h2
            id="lifecycle-heading"
            className="mt-1 text-xl font-bold text-ink"
          >
            Vòng đời giải đấu
          </h2>
        </div>
        <span className="rounded-full border border-line bg-surface-sub px-3 py-1.5 text-xs font-semibold text-ink-muted">
          {STATUS_LABELS[tournament.status]}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface-sub/45 p-4">
          <div className="flex items-center gap-2">
            <LockKeyIcon className="text-brand" />
            <h3 className="font-semibold text-ink">Chuyển trạng thái giải</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Hệ thống hiện chưa cung cấp contract chuyển trạng thái có kiểm tra
            điều kiện và chiều chuyển hợp lệ. Vì vậy trang quản lý không hiển
            thị thao tác bắt đầu, hoàn tất, hủy hoặc khôi phục giải.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface-sub/45 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CalendarBlankIcon className="text-brand" />
                <h3 className="font-semibold text-ink">Nhận đăng ký</h3>
              </div>
              <p className="mt-2 text-sm font-medium text-ink">
                {tournament.registrationOpen ? "Đang bật" : "Đang tắt"}
              </p>
            </div>
            {registrationCanBeToggled && (
              <button
                type="button"
                onClick={toggleRegistration}
                disabled={working}
                className={secondaryButtonClass}
              >
                {working && <CircleNotchIcon className="animate-spin" />}
                {tournament.registrationOpen ? "Đóng đăng ký" : "Mở đăng ký"}
              </button>
            )}
          </div>
          <dl className="mt-4 grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
            <div>
              <dt className="text-ink-faint">Bắt đầu nhận</dt>
              <dd className="mt-0.5">
                {formatDateTime(tournament.registrationStartDate)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">Hạn đăng ký</dt>
              <dd className="mt-0.5">
                {formatDateTime(tournament.registrationDeadline)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            Đăng ký chỉ có hiệu lực khi giải ở trạng thái “Đang đăng ký”, công
            tắc được bật và thời gian hiện tại nằm trong cửa sổ đăng ký của
            backend.
          </p>
          {!registrationCanBeToggled && (
            <p className="mt-3 flex items-start gap-2 text-xs text-pending">
              <WarningCircleIcon className="mt-0.5 shrink-0" /> Trạng thái hiện
              tại không nhận đăng ký đội.
            </p>
          )}
        </div>
      </div>

      {notice && (
        <p
          className="mt-4 flex items-center gap-2 text-sm text-approved"
          role="status"
        >
          <CheckCircleIcon weight="fill" /> {notice}
        </p>
      )}
      {error && <p className={`${alertErrorClass} mt-4`}>{error}</p>}
    </section>
  );
}
