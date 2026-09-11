"use client";

import { useEffect, useState } from "react";
import {
  FloppyDiskIcon,
  GameControllerIcon,
  LockKeyIcon,
} from "@phosphor-icons/react";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import { gamesApi } from "@/features/games/api";
import GameStructureFields, {
  type GameStructureValue,
} from "@/features/games/components/GameStructureFields";
import type { Game } from "@/features/games/types";
import { useLocale } from "@/features/locale/store";
import { tournamentsApi } from "@/features/tournaments/api";
import type { TournamentDetail } from "@/features/tournaments/types";

function structureFromTournament(
  tournament: TournamentDetail,
): GameStructureValue {
  return {
    gameId: tournament.game.id,
    teamSize: String(tournament.minTeamSize),
    maxTeamSize: String(tournament.maxTeamSize),
    customGameName: tournament.customGameName ?? "",
  };
}

export default function TournamentGameEditor({
  tournament,
  onUpdated,
}: {
  tournament: TournamentDetail;
  onUpdated: (tournament: TournamentDetail) => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [value, setValue] = useState(() => structureFromTournament(tournament));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canEdit = tournament.management?.gameConfiguration.allowed === true;
  const lockedReason = tournament.management?.gameConfiguration.reason;

  useEffect(() => {
    if (!open || !canEdit || games.length > 0) return;
    gamesApi
      .findAll()
      .then(setGames)
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : t("game.structure.catalogLoadError"),
        );
      });
  }, [open, canEdit, games.length, t]);

  const save = async () => {
    if (!canEdit || saving) return;
    const game = games.find((item) => item.id === value.gameId);
    const teamSize = Number(value.teamSize);
    const maxTeamSize = Number(value.maxTeamSize);
    if (
      !game ||
      !Number.isInteger(teamSize) ||
      !Number.isInteger(maxTeamSize)
    ) {
      setError(t("game.structure.teamSizeInvalid"));
      return;
    }
    if (game.code === "CUSTOM" && !value.customGameName.trim()) {
      setError(t("game.structure.customNameRequired"));
      return;
    }

    setSaving(true);
    setError("");
    try {
      await tournamentsApi.update(tournament.id, {
        gameId: value.gameId,
        teamSize,
        maxTeamSize,
        customGameName:
          game.code === "CUSTOM" ? value.customGameName.trim() : undefined,
      });
      onUpdated(await tournamentsApi.findBySlug(tournament.slug));
      setOpen(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t("game.structure.updateError"),
      );
      await tournamentsApi
        .findBySlug(tournament.slug)
        .then(onUpdated)
        .catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-surface-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold text-ink">
            <GameControllerIcon size={20} weight="duotone" />
            {t("game.structure.editorTitle")}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {tournament.displayGameName ?? tournament.game.name} ·{" "}
            {tournament.minTeamSize}v{tournament.minTeamSize} ·{" "}
            {tournament.maxTeamSize} {t("game.structure.players")}
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => {
              setValue(structureFromTournament(tournament));
              setError("");
              setOpen((current) => !current);
            }}
            className={secondaryButtonClass}
            disabled={saving}
          >
            {open ? t("common.close") : t("common.edit")}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-sub px-3 py-2 text-xs font-medium text-ink-muted">
            <LockKeyIcon size={14} />
            {t("manage.locked")}
          </span>
        )}
      </div>

      {!canEdit && (
        <p className="mt-3 text-xs leading-relaxed text-ink-muted">
          {lockedReason
            ? t(`manage.reason.${lockedReason}`)
            : t("manage.permissionsUnavailable")}
        </p>
      )}
      {open && canEdit && (
        <div className="mt-5 border-t border-line pt-5">
          <GameStructureFields
            games={games}
            value={value}
            onChange={setValue}
            disabled={saving}
            preserveValidMax
          />
          {error && <p className={`${alertErrorClass} mt-4`}>{error}</p>}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={saving || games.length === 0}
              onClick={save}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-50"
            >
              <FloppyDiskIcon size={17} />
              {saving ? t("game.structure.saving") : t("common.save")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
