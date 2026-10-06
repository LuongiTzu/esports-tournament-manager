"use client";

import { useEffect, useState } from "react";
import {
  CircleNotchIcon,
  TrashIcon,
  UserPlusIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import {
  alertErrorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import { tournamentsApi } from "@/features/tournaments/api";
import type {
  TournamentStaff,
  TournamentStaffRole,
} from "@/features/tournaments/types";

const roles: TournamentStaffRole[] = ["CO_ORGANIZER", "REFEREE", "SCOREKEEPER"];

export default function TournamentStaffManagement({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const { t } = useLocale();
  const [staff, setStaff] = useState<TournamentStaff[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TournamentStaffRole>("CO_ORGANIZER");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    tournamentsApi
      .listStaff(tournamentId)
      .then((value) => {
        if (!cancelled) setStaff(value);
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : t("staff.loadError"),
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, t]);

  const add = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || workingId) return;
    setWorkingId("new");
    setError("");
    try {
      const created = await tournamentsApi.addStaff(tournamentId, {
        email: normalizedEmail,
        role,
      });
      setStaff((current) => [...current, created]);
      setEmail("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("staff.addError"));
    } finally {
      setWorkingId(null);
    }
  };

  const updateRole = async (
    member: TournamentStaff,
    nextRole: TournamentStaffRole,
  ) => {
    if (workingId || nextRole === member.role) return;
    setWorkingId(member.id);
    setError("");
    try {
      const updated = await tournamentsApi.updateStaff(
        tournamentId,
        member.id,
        nextRole,
      );
      setStaff((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("staff.updateError"),
      );
    } finally {
      setWorkingId(null);
    }
  };

  const remove = async (member: TournamentStaff) => {
    if (workingId || !window.confirm(t("staff.removeConfirm"))) return;
    setWorkingId(member.id);
    setError("");
    try {
      await tournamentsApi.removeStaff(tournamentId, member.id);
      setStaff((current) => current.filter((item) => item.id !== member.id));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("staff.removeError"),
      );
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-surface-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <UsersThreeIcon weight="duotone" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">{t("staff.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {t("staff.description")}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
        <label>
          <span className={labelClass}>{t("staff.email")}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
            placeholder="staff@example.com"
          />
        </label>
        <label>
          <span className={labelClass}>{t("staff.role")}</span>
          <select
            value={role}
            onChange={(event) =>
              setRole(event.target.value as TournamentStaffRole)
            }
            className={inputClass}
          >
            {roles.map((value) => (
              <option key={value} value={value}>
                {t(`staff.role.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!email.trim() || Boolean(workingId)}
          onClick={() => void add()}
          className={primaryButtonClass}
        >
          {workingId === "new" ? (
            <CircleNotchIcon className="animate-spin" />
          ) : (
            <UserPlusIcon />
          )}
          {t("staff.add")}
        </button>
      </div>

      {error && <p className={`${alertErrorClass} mt-4`}>{error}</p>}

      <div className="manage-staff-list mt-5 space-y-2">
        {loading ? (
          <p className="text-sm text-ink-muted">{t("common.loading")}</p>
        ) : staff.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">
            {t("staff.empty")}
          </p>
        ) : (
          staff.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-3 rounded-xl border border-line bg-surface-sub/50 p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">
                  {member.user.displayName}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {member.user.email}
                </p>
              </div>
              <select
                aria-label={t("staff.role")}
                value={member.role}
                disabled={Boolean(workingId)}
                onChange={(event) =>
                  void updateRole(
                    member,
                    event.target.value as TournamentStaffRole,
                  )
                }
                className={`${inputClass} sm:w-52`}
              >
                {roles.map((value) => (
                  <option key={value} value={value}>
                    {t(`staff.role.${value}`)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label={t("staff.remove")}
                disabled={Boolean(workingId)}
                onClick={() => void remove(member)}
                className="grid size-10 place-items-center rounded-lg border border-rejected/30 text-rejected hover:bg-rejected/10 disabled:opacity-50"
              >
                {workingId === member.id ? (
                  <CircleNotchIcon className="animate-spin" />
                ) : (
                  <TrashIcon />
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
