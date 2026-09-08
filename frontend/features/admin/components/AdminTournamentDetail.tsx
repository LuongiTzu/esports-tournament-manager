import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRightIcon,
  CircleNotchIcon,
  ClockIcon,
  CrownIcon,
  EyeIcon,
  EyeSlashIcon,
  InfoIcon,
  SealCheckIcon,
  ShieldWarningIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import type { AdminTournament } from "@/features/admin/types";
import { formatAdminDate } from "@/features/admin/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";

export type AdminTournamentWorkingAction =
  "VERIFY" | "OFFICIAL" | "MODERATE" | "OVERRIDE" | "";

const actionButtonClass =
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:shrink-0";

const neutralActionClass = `${actionButtonClass} border-line-strong/70 bg-surface-card/55 text-ink-muted enabled:hover:border-brand/50 enabled:hover:bg-brand/10 enabled:hover:text-ink`;

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
  const officialHint =
    !tournament.isOfficial && !canBecomeOfficial
      ? t("admin.tournaments.officialOwnerHint")
      : hidden && !tournament.isOfficial
        ? t("admin.tournaments.hiddenOfficialHint")
        : undefined;
  const verificationHint = tournament.isOfficial
    ? t("admin.tournaments.officialVerifyHint")
    : hidden && !tournament.isVerified
      ? t("admin.tournaments.hiddenVerifyHint")
      : undefined;
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
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-brand/15 bg-brand/10 text-brand-hover">
              <ShieldWarningIcon size={17} aria-hidden="true" />
            </span>
            <h3 className="text-sm font-semibold text-ink">
              {t("admin.tournaments.platformModeration")}
            </h3>
          </div>
          <div className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface-sub/35">
            <ModerationSettingRow
              icon={CrownIcon}
              label={t("admin.tournaments.officialLabel")}
              value={
                tournament.isOfficial
                  ? t("admin.tournaments.official")
                  : t("admin.tournaments.community")
              }
              tone={
                tournament.isOfficial ? "text-brand-hover" : "text-ink-muted"
              }
              hint={officialHint}
            >
              <button
                type="button"
                disabled={
                  working ||
                  (!tournament.isOfficial && (hidden || !canBecomeOfficial))
                }
                onClick={() => onOfficialChange(!tournament.isOfficial)}
                className={neutralActionClass}
                title={officialHint}
                aria-busy={workingAction === "OFFICIAL"}
                aria-label={
                  tournament.isOfficial
                    ? t("admin.tournaments.removeOfficial")
                    : t("admin.tournaments.makeOfficial")
                }
              >
                {workingAction === "OFFICIAL" && (
                  <CircleNotchIcon
                    size={14}
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                {tournament.isOfficial
                  ? t("admin.tournaments.removeOfficialShort")
                  : t("admin.tournaments.makeOfficialShort")}
              </button>
            </ModerationSettingRow>
            <ModerationSettingRow
              icon={SealCheckIcon}
              label={t("admin.tournaments.verificationLabel")}
              value={
                tournament.isVerified
                  ? t("admin.tournaments.verified")
                  : t("admin.tournaments.unverified")
              }
              tone={
                tournament.isVerified ? "text-brand-hover" : "text-ink-muted"
              }
              hint={verificationHint}
            >
              <button
                type="button"
                disabled={
                  working ||
                  tournament.isOfficial ||
                  (hidden && !tournament.isVerified)
                }
                onClick={() => onVerificationChange(!tournament.isVerified)}
                className={neutralActionClass}
                title={verificationHint}
                aria-busy={workingAction === "VERIFY"}
              >
                {workingAction === "VERIFY" && (
                  <CircleNotchIcon
                    size={14}
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                {tournament.isVerified
                  ? t("admin.tournaments.unverify")
                  : t("admin.tournaments.verify")}
              </button>
            </ModerationSettingRow>
            <ModerationSettingRow
              icon={hidden ? EyeSlashIcon : EyeIcon}
              label={t("admin.tournaments.platformVisibility")}
              value={
                hidden
                  ? t("admin.tournaments.hidden")
                  : t("admin.tournaments.platformVisible")
              }
              tone={hidden ? "text-rejected" : "text-approved"}
            >
              <button
                type="button"
                disabled={working}
                onClick={hidden ? onUnhide : onHide}
                aria-busy={workingAction === "MODERATE"}
                aria-label={
                  hidden
                    ? t("admin.tournaments.unhide")
                    : t("admin.tournaments.hide")
                }
                className={`${actionButtonClass} ${
                  hidden
                    ? "border-brand/30 bg-brand/12 text-brand-hover enabled:hover:bg-brand/20"
                    : "border-rejected/25 bg-rejected/10 text-rejected enabled:hover:bg-rejected/15"
                }`}
              >
                {workingAction === "MODERATE" && (
                  <CircleNotchIcon
                    size={14}
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                {hidden
                  ? t("admin.tournaments.unhideShort")
                  : t("admin.tournaments.hideShort")}
              </button>
            </ModerationSettingRow>
          </div>
          <p className="mt-3 flex items-start gap-2 px-1 text-xs leading-5 text-ink-faint">
            <InfoIcon
              size={14}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            {t("admin.tournaments.separationHint")}
          </p>
        </section>

        {!isOwnTournament && (
          <section className="mt-5 rounded-xl border border-line bg-surface-sub/35 p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-pending/15 bg-pending/10 text-pending">
                <WrenchIcon size={17} aria-hidden="true" />
              </span>
              <h3 className="min-w-0 flex-1 text-sm font-semibold text-ink">
                {t("admin.tournaments.overrideHeading")}
              </h3>
              {!activeOverride && (
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[11px] font-medium text-ink-muted"
                  title={t("admin.tournaments.overrideExpires")}
                >
                  <ClockIcon size={13} aria-hidden="true" />
                  {t("admin.tournaments.overrideDuration")}
                </span>
              )}
            </div>
            {activeOverride ? (
              <div className="mt-4 text-xs leading-5 text-ink-muted">
                <p className="flex items-center gap-2 font-medium text-pending">
                  <span className="size-1.5 shrink-0 rounded-full bg-pending" />
                  {t("admin.tournaments.overrideActive")}
                </p>
                <dl className="mt-3 space-y-3 border-t border-line pt-3">
                  <div>
                    <dt className="text-ink-faint">
                      {t("admin.tournaments.overrideBy")}
                    </dt>
                    <dd className="mt-0.5 font-medium text-ink">
                      {activeOverride.admin.displayName}
                      <span className="block break-all font-normal text-ink-muted">
                        {activeOverride.admin.email}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">
                      {t("admin.tournaments.overrideReason")}
                    </dt>
                    <dd className="mt-0.5 break-words">
                      {activeOverride.reason}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-ink-faint">
                      <ClockIcon size={13} aria-hidden="true" />
                      {t("admin.tournaments.overrideExpires")}
                    </dt>
                    <dd className="mt-0.5 font-medium text-ink">
                      {formatAdminDate(activeOverride.expiresAt, locale, true)}
                    </dd>
                  </div>
                </dl>
                {ownsActiveOverride && (
                  <div className="mt-4 grid gap-2">
                    <Link
                      href={`/tournaments/${tournament.slug}/manage`}
                      className={`${actionButtonClass} border-brand/30 bg-brand/12 text-brand-hover hover:bg-brand/20`}
                    >
                      {t("admin.tournaments.openManagement")}
                      <ArrowUpRightIcon size={15} aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      disabled={working}
                      onClick={onEndOverride}
                      aria-busy={workingAction === "OVERRIDE"}
                      className={neutralActionClass}
                    >
                      {workingAction === "OVERRIDE" && (
                        <CircleNotchIcon
                          size={14}
                          className="animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      )}
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
                  aria-busy={workingAction === "OVERRIDE"}
                  className={`${actionButtonClass} mt-4 w-full justify-between border-pending/25 bg-pending/8 text-pending enabled:hover:border-pending/45 enabled:hover:bg-pending/15`}
                >
                  {workingAction === "OVERRIDE"
                    ? t("admin.tournaments.startingOverride")
                    : t("admin.tournaments.startOverride")}
                  {workingAction === "OVERRIDE" ? (
                    <CircleNotchIcon
                      size={15}
                      className="animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowUpRightIcon size={15} aria-hidden="true" />
                  )}
                </button>
              </>
            )}
          </section>
        )}

        <Link
          href={`/tournaments/${tournament.slug}`}
          className="mt-4 flex min-h-10 items-center justify-between gap-2 rounded-lg px-2 text-xs font-medium text-ink-muted transition-colors hover:bg-brand/10 hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <span className="inline-flex items-center gap-2">
            <EyeIcon size={15} aria-hidden="true" />
            {t("admin.tournaments.viewPublic")}
          </span>
          <ArrowUpRightIcon size={15} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function ModerationSettingRow({
  icon: Icon,
  label,
  value,
  tone,
  hint,
  children,
}: {
  icon: typeof CrownIcon;
  label: string;
  value: string;
  tone: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
        <div className="flex min-w-32 flex-1 items-center gap-2.5">
          <Icon
            size={17}
            className="shrink-0 text-ink-faint"
            aria-hidden="true"
          />
          <dl className="min-w-0">
            <dt className="text-[11px] leading-5 text-ink-faint">{label}</dt>
            <dd className={`mt-0.5 text-xs font-semibold leading-5 ${tone}`}>
              {value}
            </dd>
          </dl>
        </div>
        {children}
      </div>
      {hint && (
        <p className="mt-2 text-[11px] leading-5 text-ink-faint">{hint}</p>
      )}
    </div>
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
