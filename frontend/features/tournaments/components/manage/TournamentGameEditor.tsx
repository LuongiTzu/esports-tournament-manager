"use client";

import { useEffect, useState } from "react";
import { FloppyDiskIcon, GameControllerIcon } from "@phosphor-icons/react";
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

  useEffect(() => {
    if (!open || games.length > 0) return;
    gamesApi.findAll().then(setGames).catch((loadError: unknown) => {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("game.structure.catalogLoadError"),
      );
    });
  }, [open, games.length, t]);

  const save = async () => {
    const game = games.find((item) => item.id === value.gameId);
    const teamSize = Number(value.teamSize);
    const maxTeamSize = Number(value.maxTeamSize);
    if (!game || !Number.isInteger(teamSize) || !Number.isInteger(maxTeamSize)) {
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
      const updated = await tournamentsApi.update(tournament.id, {
        gameId: value.gameId,
        teamSize,
        maxTeamSize,
        customGameName:
          game.code === "CUSTOM" ? value.customGameName.trim() : undefined,
      });
      onUpdated({
        ...tournament,
        ...updated,
        game: updated.game ?? tournament.game,
        teams: tournament.teams,
      });
      setOpen(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t("game.structure.updateError"),
      );
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
            {tournament.minTeamSize}v{tournament.minTeamSize} · {tournament.maxTeamSize}{" "}
            {t("game.structure.players")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setValue(structureFromTournament(tournament));
            setError("");
            setOpen((current) => !current);
          }}
          className={secondaryButtonClass}
        >
          {open ? t("common.close") : t("common.edit")}
        </button>
      </div>

      {open && (
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
