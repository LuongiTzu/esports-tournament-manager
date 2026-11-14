"use client";
import { useRef, useState } from "react";
import Link from "@/components/navigation/Link";
import { ApiError } from "@/lib/api/client";
import { applyProposal, type AssistantProposal } from "./api";
import styles from "./assistant.module.css";

const labels: Record<string, string> = {
  name: "Tên",
  gameId: "Game",
  customGameName: "Tên game",
  description: "Mô tả",
  rules: "Thể lệ",
  mode: "Hình thức",
  location: "Địa điểm",
  visibility: "Hiển thị",
  status: "Trạng thái",
  maxTeams: "Số đội tối đa",
  teamSize: "Người thi đấu mỗi đội",
  maxTeamSize: "Thành viên tối đa mỗi đội",
  minAge: "Tuổi tối thiểu",
  maxAge: "Tuổi tối đa",
  registrationOpen: "Mở đăng ký",
  registrationStartDate: "Mở đăng ký lúc",
  registrationDeadline: "Hạn đăng ký",
  startDate: "Bắt đầu",
  endDate: "Kết thúc",
  autoApproveTeams: "Tự duyệt đội",
  requireMemberFullInfo: "Đủ thông tin thành viên",
  prizePool: "Giải thưởng",
  rounds: "Các giai đoạn",
  format: "Thể thức",
  bestOf: "Best of",
  settings: "Cấu hình",
  scoringMode: "Cách tính điểm",
  numberOfRounds: "Số lượt Swiss",
  advancingTeamCount: "Số đội đi tiếp",
  winsToAdvance: "Số trận thắng để đi tiếp",
  lossesToEliminate: "Số trận thua bị loại",
  numberOfGroups: "Số bảng",
  advancingTeamsPerGroup: "Đội đi tiếp mỗi bảng",
  winPoints: "Điểm thắng",
  drawPoints: "Điểm hòa",
  lossPoints: "Điểm thua",
  allowDraws: "Cho phép hòa",
  meetingsPerPair: "Lượt gặp mỗi cặp",
  thirdPlaceMatch: "Tranh hạng ba",
  grandFinalReset: "Chung kết reset",
};
const values: Record<string, string> = {
  DRAFT: "Bản nháp",
  PRIVATE: "Riêng tư",
  PUBLIC: "Công khai",
  ONLINE: "Trực tuyến",
  OFFLINE: "Trực tiếp",
  HYBRID: "Kết hợp",
  SWISS: "Thụy Sĩ",
  PLAYOFF: "Loại trực tiếp",
  DOUBLE_ELIM: "Nhánh thắng / thua",
  GROUP_STAGE: "Vòng bảng",
  ROUND_ROBIN: "Vòng tròn",
  FIXED_ROUNDS: "Số lượt cố định",
  THRESHOLD: "Ngưỡng thắng / thua",
  SERIES_SCORE: "Tỉ số loạt trận",
  POINT_SCORE: "Điểm số",
};
function PreviewValue({
  value,
  locale,
}: {
  value: unknown;
  locale: "vi" | "en";
}) {
  if (Array.isArray(value))
    return (
      <ol className={styles.rounds}>
        {value.map((v, i) => (
          <li key={i}>
            <PreviewValue value={v} locale={locale} />
          </li>
        ))}
      </ol>
    );
  if (typeof value === "object" && value !== null)
    return (
      <dl className={styles.fields}>
        {Object.entries(value).map(([key, v]) => (
          <div key={key}>
            <dt>
              {locale === "vi"
                ? (labels[key] ?? key)
                : key.replace(/([A-Z])/g, " $1")}
            </dt>
            <dd>
              <PreviewValue value={v} locale={locale} />
            </dd>
          </div>
        ))}
      </dl>
    );
  if (typeof value === "boolean")
    return (
      <>{locale === "vi" ? (value ? "Có" : "Không") : value ? "Yes" : "No"}</>
    );
  if (value === null || value === undefined)
    return <>{locale === "vi" ? "Chưa đặt / tự động" : "Unset / automatic"}</>;
  const text = String(value);
  if (/^\d{4}-\d\d-\d\dT/.test(text) && Number.isFinite(Date.parse(text)))
    return (
      <>
        {new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(new Date(text))}{" "}
        (UTC+7)
      </>
    );
  return <>{locale === "vi" ? (values[text] ?? text) : text}</>;
}
export default function ProposalCard({
  proposal,
  enabled,
  locale,
  onApplied,
}: {
  proposal: AssistantProposal;
  enabled: boolean;
  locale: "vi" | "en";
  onApplied: (text: string) => void;
}) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "uncertain">(
    "idle",
  );
  const [error, setError] = useState("");
  const [slug, setSlug] = useState(proposal.slug);
  const active = useRef(false);
  const vi = locale === "vi";
  async function apply() {
    if (active.current || !enabled || state !== "idle") return;
    active.current = true;
    setState("saving");
    setError("");
    try {
      const result = await applyProposal(proposal);
      setSlug(result.slug ?? proposal.slug);
      setState("done");
      onApplied(
        vi
          ? "Đã áp dụng bản xem trước thành công."
          : "The preview was applied successfully.",
      );
    } catch (e) {
      const known = e instanceof ApiError && e.status < 500;
      setState(known ? "idle" : "uncertain");
      setError(
        known
          ? e.message
          : vi
            ? "Chưa xác nhận được kết quả lưu. Hãy kiểm tra trang giải của bạn trước khi tạo lại."
            : "Save outcome is unknown. Check your tournaments before trying again.",
      );
    } finally {
      active.current = false;
    }
  }
  return (
    <div className={styles.proposal}>
      <div className={styles.eyebrow}>{vi ? "BẢN XEM TRƯỚC" : "PREVIEW"}</div>
      <strong>{proposal.targetName}</strong>
      <p>
        {proposal.kind === "create"
          ? vi
            ? "Tạo bản nháp riêng tư. Chưa mở đăng ký."
            : "Create a private draft with registration closed."
          : vi
            ? "Chỉ áp dụng sau khi bạn xác nhận."
            : "Changes are applied after your confirmation."}
      </p>
      {proposal.before && (
        <details>
          <summary>{vi ? "Thông tin hiện tại" : "Current values"}</summary>
          <PreviewValue value={proposal.before} locale={locale} />
        </details>
      )}
      <details open>
        <summary>{vi ? "Nội dung sẽ lưu" : "Values to save"}</summary>
        <PreviewValue
          value={{
            ...proposal.payload,
            ...(proposal.gameName ? { gameId: proposal.gameName } : {}),
          }}
          locale={locale}
        />
      </details>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!enabled || state !== "idle"}
        onClick={() => void apply()}
        className={styles.apply}
      >
        {state === "saving"
          ? vi
            ? "Đang lưu…"
            : "Saving…"
          : state === "done"
            ? vi
              ? "Đã áp dụng"
              : "Applied"
            : state === "uncertain"
              ? vi
                ? "Cần kiểm tra kết quả"
                : "Check save outcome"
              : proposal.kind === "create"
                ? vi
                  ? "Xác nhận tạo bản nháp"
                  : "Confirm draft creation"
                : vi
                  ? "Xác nhận thay đổi"
                  : "Confirm changes"}
      </button>
      {state === "done" && slug && (
        <Link
          href={`/tournaments/${encodeURIComponent(slug)}/manage`}
          className={styles.resultLink}
        >
          {vi ? "Mở trang quản lý giải →" : "Manage tournament →"}
        </Link>
      )}
      {state === "idle" && (
        <small>
          {vi
            ? "Muốn chỉnh thêm? Nhắn tiếp bên dưới; bản xem trước mới sẽ thay thế bản này."
            : "Want changes? Send another message to replace this preview."}
        </small>
      )}
    </div>
  );
}
