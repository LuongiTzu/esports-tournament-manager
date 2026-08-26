"use client";

import Image from "next/image";
import { CheckCircleIcon } from "@phosphor-icons/react";
import { inputClass, labelClass } from "@/components/ui";
import { gamePoster } from "@/features/games/game-posters";
import { gamePositionLabel } from "@/features/games/position-labels";
import type { Game } from "@/features/games/types";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import RosterSummary from "./RosterSummary";

export interface GameStructureValue {
  gameId: string;
  teamSize: string;
  maxTeamSize: string;
  customGameName: string;
}

export function initialStructureForGame(game: Game): GameStructureValue {
  return {
    gameId: game.id,
    teamSize: String(game.defaultTeamSize),
    maxTeamSize: String(
      game.teamSizeMode === "FIXED"
        ? game.maxTeamSize
        : game.defaultTeamSize,
    ),
    customGameName: "",
  };
}

export default function GameStructureFields({
  games,
  value,
  onChange,
  disabled = false,
  preserveValidMax = false,
}: {
  games: Game[];
  value: GameStructureValue;
  onChange: (value: GameStructureValue) => void;
  disabled?: boolean;
  preserveValidMax?: boolean;
}) {
  const { locale, t } = useLocale();
  const game = games.find((item) => item.id === value.gameId);
  const positions = game?.positions ?? [];
  const teamSize = Number(value.teamSize);
  const maxTeamSize = Number(value.maxTeamSize);
  const isCustom = game?.code === "CUSTOM";
  const customTeamMode = isCustom && teamSize > 1;

  const selectGame = (nextGame: Game) => {
    if (disabled) return;
    if (nextGame.id === value.gameId) return;
    onChange(initialStructureForGame(nextGame));
  };

  const selectTeamSize = (size: number) => {
    const currentMax = Number(value.maxTeamSize);
    const safeMax =
      preserveValidMax &&
      Number.isInteger(currentMax) &&
      currentMax >= size &&
      game
        ? Math.min(currentMax, game.maxTeamSize)
        : size;
    onChange({
      ...value,
      teamSize: String(size),
      maxTeamSize: String(safeMax),
    });
  };

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className={labelClass}>
          {t("tournament.create.game")} <span className="text-rejected">*</span>
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {games.map((item) => {
            const selected = item.id === value.gameId;
            const poster = gamePoster(item.code);
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => selectGame(item)}
                aria-pressed={selected}
                className={`group relative min-h-36 overflow-hidden rounded-xl border text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? "border-brand shadow-lg shadow-brand/15"
                    : "border-line hover:border-brand/45"
                }`}
              >
                {poster && (
                  <Image
                    src={poster}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    className="object-cover transition duration-300 group-hover:scale-105 motion-reduce:transition-none"
                  />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-black/5" />
                {selected && (
                  <CheckCircleIcon
                    className="absolute right-2 top-2 text-white"
                    size={20}
                    weight="fill"
                  />
                )}
                <span className="absolute inset-x-0 bottom-0 p-3">
                  <span className="block text-sm font-bold leading-tight text-white">
                    {item.code === "CUSTOM"
                      ? t("game.structure.customGame")
                      : item.name}
                  </span>
                  <span className="mt-1 block text-[11px] text-white/75">
                    {item.teamSizeMode === "FIXED"
                      ? `${item.defaultTeamSize}v${item.defaultTeamSize}`
                      : t(
                          `game.structure.mode.${item.teamSizeMode}` as TranslationKey,
                        )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {game && (
        <div className="space-y-5 rounded-xl border border-line bg-surface-sub/45 p-4 sm:p-5">
          {isCustom && (
            <label className={labelClass}>
              {t("game.structure.customName")} <span className="text-rejected">*</span>
              <input
                type="text"
                maxLength={100}
                required
                disabled={disabled}
                value={value.customGameName}
                onChange={(event) =>
                  onChange({ ...value, customGameName: event.target.value })
                }
                className={`${inputClass} mt-1`}
                placeholder={t("game.structure.customNamePlaceholder")}
              />
            </label>
          )}

          <div>
            <p className={labelClass}>{t("game.structure.competitionMode")}</p>
            {game.teamSizeMode === "FIXED" && (
              <div className="mt-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">
                {t("game.structure.fixedLineup")}: {game.defaultTeamSize}v{game.defaultTeamSize}
              </div>
            )}
            {game.teamSizeMode === "PRESET" && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {game.allowedTeamSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectTeamSize(size)}
                    className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                      teamSize === size
                        ? "border-brand bg-brand/12 text-ink"
                        : "border-line bg-surface text-ink-muted hover:border-brand/40"
                    }`}
                  >
                    <span className="block font-semibold">
                      {size === 1
                        ? t("game.structure.individual")
                        : t("game.structure.teamVsTeam")}
                    </span>
                    <span className="mt-1 block text-xs opacity-75">
                      {size === 1 ? "1v1" : `${size}v${size}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {game.teamSizeMode === "FLEXIBLE" && (
              <div className="mt-2 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {[1, Math.max(2, game.minSelectableTeamSize ?? 2)].map(
                    (size, index) => (
                      <button
                        key={index === 0 ? "individual" : "team"}
                        type="button"
                        disabled={disabled}
                        onClick={() => selectTeamSize(size)}
                        className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                          (index === 0 ? teamSize === 1 : customTeamMode)
                            ? "border-brand bg-brand/12 text-ink"
                            : "border-line bg-surface text-ink-muted hover:border-brand/40"
                        }`}
                      >
                        <span className="font-semibold">
                          {index === 0
                            ? t("game.structure.individual")
                            : t("game.structure.teamVsTeam")}
                        </span>
                      </button>
                    ),
                  )}
                </div>
                {customTeamMode && (
                  <label className={labelClass}>
                    {t("game.structure.teamSize")}
                    <input
                      type="number"
                      min={Math.max(2, game.minSelectableTeamSize ?? 2)}
                      max={game.maxSelectableTeamSize ?? undefined}
                      value={value.teamSize}
                      disabled={disabled}
                      onChange={(event) =>
                        selectTeamSize(Number(event.target.value))
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          <label className={labelClass}>
            {t("game.structure.maximumRoster")}
            <input
              type="number"
              min={teamSize || undefined}
              max={game.maxTeamSize}
              required
              disabled={disabled}
              value={value.maxTeamSize}
              onChange={(event) =>
                onChange({ ...value, maxTeamSize: event.target.value })
              }
              className={`${inputClass} mt-1`}
            />
            <span className="mt-1 block text-xs font-normal text-ink-faint">
              {teamSize}–{game.maxTeamSize} {t("game.structure.players")}
            </span>
          </label>

          <RosterSummary activeSize={teamSize} maxRosterSize={maxTeamSize} />

          {game.positionMode !== "NONE" && positions.length > 0 && (
            <div>
              <p className={labelClass}>
                {game.positionMode === "FIXED"
                  ? t("game.structure.requiredPositions")
                  : t("game.structure.optionalPositions")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {positions.map((position) => (
                  <span
                    key={position}
                    className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-muted"
                  >
                    {gamePositionLabel(position, locale)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
