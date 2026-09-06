import type { ReactNode } from "react";
import Link from "next/link";
import {
  CrownIcon,
  EyeIcon,
  EyeSlashIcon,
  SealCheckIcon,
  ShieldWarningIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import type { AdminTournament } from "@/features/admin/types";
import { formatAdminDate } from "@/features/admin/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";

export type AdminTournamentWorkingAction =
  "VERIFY" | "OFFICIAL" | "MODERATE" | "OVERRIDE" | "";

export default function AdminTournamentDetail({
  tournament,
  workingAction,
  onVerificationChange,
  onOfficialChange,
  onHide,
  onUnhide,
  currentAdminId,
  onStartOverride,
  onEndOverride,
}: {
  tournament: AdminTournament;
  workingAction: AdminTournamentWorkingAction;
  onVerificationChange: (isVerified: boolean) => void;
  onOfficialChange: (isOfficial: boolean) => void;
  onHide: () => void;
  onUnhide: () => void;
  currentAdminId: string;
  onStartOverride: () => void;
  onEndOverride: () => void;
}) {
  const { locale, t } = useLocale();
  const hidden = tournament.moderationStatus === "HIDDEN_BY_ADMIN";
  const activeOverride = tournament.activeAdminOverride;
  const isOwnTournament = tournament.organizerId === currentAdminId;
  const ownsActiveOverride = activeOverride?.adminId === currentAdminId;
  const canBecomeOfficial = tournament.organizer.role === "ADMIN";
  const working = Boolean(workingAction);
  const formatDate = (value: string | null) =>
    value ? formatAdminDate(value, locale, true) : t("common.notSet");

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface-card shadow-sm lg:sticky lg:top-24">
      <div className="aspect-[16/6] bg-surface-sub">
        <ResolvedImage
          src={tournament.bannerUrl}
          alt={`Banner ${tournament.name}`}
          className="size-full object-cover object-center"
          fallback={
            <span className="grid size-full place-items-center bg-brand/10 text-3xl font-black text-brand">
              {tournament.name.charAt(0).toUpperCase()}
            </span>
          }
        />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              {tournament.displayGameName ?? tournament.game.name}
            </p>
            <h2 className="mt-1 break-words text-xl font-black text-ink">
              {tournament.name}
            </h2>
            <p className="mt-1 break-all text-xs text-ink-faint">
              /{tournament.slug}
            </p>
          </div>
          {tournament.isOfficial ? (
            <CrownIcon
              size={25}
              className="shrink-0 text-accent"
              weight="fill"
            />
          ) : tournament.isVerified ? (
            <SealCheckIcon
              size={24}
              className="shrink-0 text-brand"
              weight="fill"
            />
          ) : null}
        </div>

        {tournament.description && (
          <p className="mt-4 line-clamp-4 text-sm leading-6 text-ink-muted">
            {tournament.description}
          </p>
        )}

        <section className="mt-5">
          <h3 className="text-sm font-bold text-ink">
            {t("admin.tournaments.organizer")}
          </h3>
          <div className="mt-2 rounded-xl border border-line bg-surface-sub px-4 py-3">
            <p className="font-semibold text-ink">
              {tournament.organizer.displayName}
            </p>
            <p className="mt-0.5 break-all text-xs text-ink-faint">
              {tournament.organizer.email}
            </p>
          </div>
        </section>

        <dl className="mt-5 divide-y divide-line rounded-xl border border-line px-4 text-sm">
          <DetailRow
            label={t("admin.tournaments.lifecycle")}
            value={t(
              `tournament.status.${tournament.status}` as TranslationKey,
            )}
          />
          <DetailRow
            label={t("admin.tournaments.organizerVisibility")}
            value={t(
              `tournament.visibility.${tournament.visibility}` as TranslationKey,
            )}
          />
          <DetailRow
            label={t("tournament.detail.mode")}
            value={t(`tournament.mode.${tournament.mode}` as TranslationKey)}
          />
          <DetailRow
            label={t("admin.tournaments.registrationOpen")}
            value={
              tournament.registrationOpen ? t("common.yes") : t("common.no")
            }
          />
          <DetailRow
            label={t("admin.tournaments.registrationWindow")}
            value={`${formatDate(tournament.registrationStartDate)} — ${formatDate(tournament.registrationDeadline)}`}
          />
          <DetailRow
            label={t("admin.tournaments.tournamentWindow")}
            value={`${formatDate(tournament.startDate)} — ${formatDate(tournament.endDate)}`}
          />
          <DetailRow
            label={t("admin.tournaments.capacity")}
            value={
              tournament.maxTeams
                ? `${tournament.maxTeams} ${t("registration.teamsUnit")}`
                : t("common.unlimited")
            }
          />
          <DetailRow
            label="Roster"
            value={`${tournament.minTeamSize}–${tournament.maxTeamSize} ${t("admin.tournaments.playersUnit")}`}
          />
          <DetailRow
            label={t("admin.tournaments.reports")}
            value={`${tournament._count.reports} ${t("admin.tournaments.reportsUnit")}`}
          />
          <DetailRow
            label={t("admin.users.createdAt")}
            value={formatDate(tournament.createdAt)}
          />
          <DetailRow
            label={t("admin.tournaments.updated")}
            value={formatDate(tournament.updatedAt)}
          />
        </dl>

        <section className="mt-5 border-t border-line pt-5">
          <div className="flex items-center gap-2">
            <ShieldWarningIcon className="text-brand" />
            <h3 className="text-sm font-bold text-ink">
              {t("admin.tournaments.platformModeration")}
            </h3>
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <StatusBadge
              active={tournament.isOfficial}
              activeClass="bg-accent/12 text-accent"
            >
              {t("admin.tournaments.officialLabel")}:{" "}
              {tournament.isOfficial
                ? t("admin.tournaments.official")
                : t("admin.tournaments.community")}
            </StatusBadge>
            <StatusBadge active={tournament.isVerified}>
              {t("admin.tournaments.verificationLabel")}:{" "}
              {tournament.isVerified
                ? t("admin.tournaments.verified")
                : t("admin.tournaments.unverified")}
            </StatusBadge>
            <span
              className={`rounded-lg px-3 py-2 font-semibold ${
                hidden
                  ? "bg-rejected/12 text-rejected"
                  : "bg-approved/12 text-approved"
              }`}
            >
              {t("admin.tournaments.platformVisibility")}:{" "}
              {hidden
                ? t("admin.tournaments.hidden")
                : t("admin.tournaments.activeState")}
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-ink-faint">
            {t("admin.tournaments.separationHint")}
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={
                working ||
                (!tournament.isOfficial && (hidden || !canBecomeOfficial))
              }
              onClick={() => onOfficialChange(!tournament.isOfficial)}
              className={secondaryButtonClass}
              title={
                !tournament.isOfficial && !canBecomeOfficial
                  ? t("admin.tournaments.officialOwnerHint")
                  : hidden && !tournament.isOfficial
                    ? t("admin.tournaments.hiddenOfficialHint")
                    : undefined
              }
            >
              <CrownIcon />
              {workingAction === "OFFICIAL"
                ? t("admin.tournaments.updating")
                : tournament.isOfficial
                  ? t("admin.tournaments.removeOfficial")
                  : t("admin.tournaments.makeOfficial")}
            </button>
            <button
              type="button"
              disabled={
                working ||
                tournament.isOfficial ||
                (hidden && !tournament.isVerified)
              }
              onClick={() => onVerificationChange(!tournament.isVerified)}
              className={secondaryButtonClass}
              title={
                tournament.isOfficial
                  ? t("admin.tournaments.officialVerifyHint")
                  : hidden && !tournament.isVerified
                    ? t("admin.tournaments.hiddenVerifyHint")
                    : undefined
              }
            >
              <SealCheckIcon />
              {workingAction === "VERIFY"
                ? t("admin.tournaments.updating")
                : tournament.isVerified
                  ? t("admin.tournaments.unverify")
                  : t("admin.tournaments.verify")}
            </button>
            <button
              type="button"
              disabled={working}
              onClick={hidden ? onUnhide : onHide}
              className={
                hidden
                  ? primaryButtonClass
                  : `${secondaryButtonClass} border-rejected/40 text-rejected`
              }
            >
              {hidden ? <EyeIcon /> : <EyeSlashIcon />}
              {workingAction === "MODERATE"
                ? t("admin.tournaments.updating")
                : hidden
                  ? t("admin.tournaments.unhide")
                  : t("admin.tournaments.hide")}
            </button>
          </div>
        </section>

        {!isOwnTournament && (
          <section className="mt-5 border-t border-line pt-5">
            <div className="flex items-center gap-2">
              <WrenchIcon className="text-pending" />
              <h3 className="text-sm font-bold text-ink">
                {t("admin.tournaments.overrideHeading")}
              </h3>
            </div>
            {activeOverride ? (
              <div className="mt-3 rounded-xl border border-pending/30 bg-pending/10 p-3 text-xs leading-5 text-ink-muted">
                <p className="font-semibold text-pending">
                  {t("admin.tournaments.overrideActive")}
                </p>
                <p className="mt-1">
                  {t("admin.tournaments.overrideBy")}:{" "}
                  {activeOverride.admin.displayName} (
                  {activeOverride.admin.email})
                </p>
                <p className="mt-1 break-words">
                  {t("admin.tournaments.overrideReason")}:{" "}
                  {activeOverride.reason}
                </p>
                <p className="mt-1">
                  {t("admin.tournaments.overrideExpires")}:{" "}
                  {formatAdminDate(activeOverride.expiresAt, locale, true)}
                </p>
                {ownsActiveOverride && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Link
                      href={`/tournaments/${tournament.slug}/manage`}
                      className={primaryButtonClass}
                    >
                      <WrenchIcon /> {t("admin.tournaments.openManagement")}
                    </Link>
                    <button
                      type="button"
                      disabled={working}
                      onClick={onEndOverride}
                      className={secondaryButtonClass}
                    >
                      {workingAction === "OVERRIDE"
                        ? t("admin.tournaments.endingOverride")
                        : t("admin.tournaments.endOverride")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <p className="mt-3 text-xs leading-5 text-ink-faint">
                  {t("admin.tournaments.overrideAccessHint")}
                </p>
                <button
                  type="button"
                  disabled={working}
                  onClick={onStartOverride}
                  className={`${secondaryButtonClass} mt-3 w-full border-pending/40 text-pending`}
                >
                  <ShieldWarningIcon />
                  {t("admin.tournaments.startOverride")}
                </button>
              </>
            )}
          </section>
        )}

        <Link
          href={`/tournaments/${tournament.slug}`}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-hover"
        >
          <EyeIcon /> {t("admin.tournaments.viewPublic")}
        </Link>
      </div>
    </article>
  );
}

function StatusBadge({
  active,
  activeClass = "bg-brand/12 text-brand",
  children,
}: {
  active: boolean;
  activeClass?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`rounded-lg px-3 py-2 font-semibold ${
        active ? activeClass : "bg-surface-sub text-ink-muted"
      }`}
    >
      {children}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="shrink-0 text-ink-faint">{label}</dt>
      <dd className="text-right text-ink-muted">{value}</dd>
    </div>
  );
}
