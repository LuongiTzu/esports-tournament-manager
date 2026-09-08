"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsOutIcon,
  MinusIcon,
  PlusIcon,
  TrophyIcon,
} from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { useLocale } from "@/features/locale/store";
import { getTournamentBannerUrl } from "@/features/tournaments/banner";
import { roundFormatLabel } from "@/features/tournaments/round-formats";
import type {
  BracketMatch,
  RoundBracket,
  RoundStandings,
} from "@/features/tournaments/types";
import {
  getMatchSources,
  layoutBracket,
  type BracketColumn,
  type BracketLayout,
} from "./bracket-presentation";
import DiagramMatchCard from "./DiagramMatchCard";
import SwissDiagramContent from "./SwissDiagramContent";
import {
  layoutSwissBracket,
  type SwissBracketLayout,
} from "./swiss-presentation";
import styles from "./bracket.module.css";

export default function BracketDiagram({
  bracket,
  bannerUrl,
  tournamentName,
  standings,
  onSelectMatch,
}: {
  bracket: RoundBracket;
  bannerUrl?: string | null;
  tournamentName?: string;
  standings?: RoundStandings;
  onSelectMatch?: (match: BracketMatch) => void;
}) {
  const { t } = useLocale();
  const viewport = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, maxHeight: 0 });
  const [zoom, setZoom] = useState<number | "fit" | "auto">("auto");
  const [hovered, setHovered] = useState<string | null>(null);
  const swissRounds =
    standings?.swissProgress?.resolvedNumberOfRounds ??
    (bracket.round.format === "SWISS"
      ? (bracket.round.settings.numberOfRounds ?? undefined)
      : undefined);
  const layout = useMemo<BracketLayout | SwissBracketLayout>(
    () =>
      bracket.round.format === "SWISS" && bracket.swiss
        ? layoutSwissBracket(bracket, standings, swissRounds)
        : layoutBracket(bracket, swissRounds),
    [bracket, standings, swissRounds],
  );
  const swissLayout = "groups" in layout ? layout : null;
  const sources = useMemo(
    () => getMatchSources(bracket.matches),
    [bracket.matches],
  );
  const metrics = layout.metrics;
  const numbers = useMemo(
    () =>
      new Map(layout.nodes.map((node, index) => [node.match.id, index + 1])),
    [layout.nodes],
  );
  const elimination = ["PLAYOFF", "DOUBLE_ELIM"].includes(bracket.round.format);
  const scale = !viewportSize.width
    ? 1
    : zoom === "fit"
      ? Math.min(
          1,
          Math.max(
            0.1,
            Math.min(
              viewportSize.width / layout.width,
              viewportSize.maxHeight / layout.height,
            ),
          ),
        )
      : zoom === "auto"
        ? viewportSize.width >= 640
          ? Math.min(
              1,
              viewportSize.width / layout.width,
              viewportSize.maxHeight / layout.height,
            )
          : Math.min(
              1,
              viewportSize.width / (metrics.cardWidth + metrics.padding * 2),
            )
        : zoom;
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const maxHeight = Number.parseFloat(getComputedStyle(element).maxHeight);
      setViewportSize((current) =>
        current.width === width && current.maxHeight === maxHeight
          ? current
          : { width, maxHeight },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const columnLabel = (column: BracketColumn) => {
    if (column.kind === "bronze") return t("competition.thirdPlace");
    if (column.kind === "reset") return t("bracket.resetFinal");
    if (column.kind === "final") return t("competition.grandFinal");
    if (
      bracket.round.format === "PLAYOFF" &&
      column.round ===
        Math.max(
          ...bracket.matches
            .filter((match) => match.matchNumber === 1)
            .map((match) => match.bracketRound ?? 0),
        )
    )
      return t("competition.final");
    return `${t(bracket.round.format === "SWISS" ? "competition.swissIteration" : elimination ? "competition.round" : "competition.iteration")} ${column.round}`;
  };
  const laneLabel = (key: string, groupName?: string) =>
    groupName ??
    (key === "WINNER"
      ? t("competition.winnersBracket")
      : key === "LOSER"
        ? t("competition.losersBracket")
        : key === "final"
          ? t("bracket.finals")
          : key === "bronze"
            ? t("competition.thirdPlace")
            : roundFormatLabel(bracket.round.format, t));

  return (
    <section
      className={styles.board}
      data-format={bracket.round.format}
      aria-label={t("bracket.diagram")}
    >
      <div className={styles.backdrop} aria-hidden="true">
        <ResolvedImage
          src={bannerUrl}
          fallbackSrc={getTournamentBannerUrl()}
          alt=""
          className={styles.poster}
        />
      </div>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>
            {tournamentName ?? t("competition.eyebrow")}
          </p>
          <div className={styles.headingRow}>
            <div className={styles.emblem} aria-hidden="true">
              <TrophyIcon size={24} weight="regular" />
            </div>
            <h4 className={styles.title}>
              {roundFormatLabel(bracket.round.format, t)}
            </h4>
          </div>
          <p className={styles.subtitle}>
            {t("competition.stage")}: {bracket.round.name}
          </p>
        </div>
      </header>
      <div
        ref={viewport}
        className={styles.viewport}
        tabIndex={0}
        role="region"
        aria-label={t("bracket.panHint")}
      >
        {!bracket.matches.length ? (
          <div className={styles.empty}>
            <TrophyIcon size={36} weight="thin" />
            <strong>{t("bracket.notGenerated")}</strong>
            <p>{t("bracket.awaitingStructure")}</p>
          </div>
        ) : (
          <div
            style={{
              width: layout.width * scale,
              height: layout.height * scale,
              overflow: "hidden",
            }}
          >
            <div
              className={styles.canvas}
              style={{
                width: layout.width,
                height: layout.height,
                transform: `scale(${scale})`,
              }}
            >
              {swissLayout ? (
                <SwissDiagramContent
                  layout={swissLayout}
                  bracket={bracket}
                  numbers={numbers}
                  onSelectMatch={onSelectMatch}
                />
              ) : (
                <>
                  {layout.lanes
                    .filter(
                      (lane) => !["main", "final", "bronze"].includes(lane.key),
                    )
                    .map((lane) => (
                      <div
                        key={lane.key}
                        className={styles.laneLabel}
                        style={{
                          top: lane.y - 6,
                          left:
                            lane.key === "final" || lane.key === "bronze"
                              ? layout.columns.find(
                                  (column) => column.lane === lane.key,
                                )?.x
                              : metrics.padding,
                        }}
                      >
                        {laneLabel(lane.key, lane.groupName)}
                      </div>
                    ))}
                  {layout.columns.map((column) => (
                    <div
                      key={column.key}
                      className={styles.columnHeading}
                      style={{
                        left: column.x,
                        top: column.y,
                        width: metrics.cardWidth,
                      }}
                    >
                      <span>{columnLabel(column)}</span>
                      <span>{String(column.round).padStart(2, "0")}</span>
                      {column.pending && (
                        <div className={styles.pendingRound}>
                          <span>— / —</span>
                          <p>{t("bracket.awaitingPairing")}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  <svg
                    className={styles.connections}
                    width={layout.width}
                    height={layout.height}
                    aria-hidden="true"
                  >
                    {layout.edges.map((edge) => (
                      <path
                        key={`${edge.from}-${edge.to}-${edge.slot}`}
                        d={edge.path}
                        className={styles.edge}
                        data-result={edge.result}
                        data-emphasized={
                          hovered === edge.from || hovered === edge.to
                        }
                        data-muted={Boolean(
                          hovered &&
                          hovered !== edge.from &&
                          hovered !== edge.to,
                        )}
                      />
                    ))}
                  </svg>
                  {layout.nodes.map((node) => (
                    <div
                      key={node.match.id}
                      className={styles.node}
                      style={{
                        left: node.x,
                        top: node.y,
                        width: metrics.cardWidth,
                        height: metrics.cardHeight,
                      }}
                      onMouseEnter={() => setHovered(node.match.id)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(node.match.id)}
                      onBlur={() => setHovered(null)}
                    >
                      <DiagramMatchCard
                        match={node.match}
                        bracket={bracket}
                        sources={sources.get(node.match.id)}
                        numbers={numbers}
                        onSelect={onSelectMatch}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {!swissLayout &&
        standings?.format === "SWISS" &&
        standings.standings.length > 0 && (
          <aside
            className={styles.standings}
            aria-label={t("bracket.currentStandings")}
          >
            <p>{t("bracket.currentStandings")}</p>
            <div>
              {[...standings.standings]
                .sort((a, b) => a.rank - b.rank)
                .map((row) => (
                  <span key={row.teamId}>
                    <small>#{row.rank}</small>
                    <strong>
                      {row.team?.shortName ||
                        row.team?.name ||
                        t("match.noTeam")}
                    </strong>
                    <b>
                      {row.wins}–{row.losses}
                    </b>
                  </span>
                ))}
            </div>
          </aside>
        )}
      <div className={styles.toolbar}>
        <div className={styles.legend}>
          <span>
            <i />
            {t(
              swissLayout
                ? "bracket.swissWinPath"
                : elimination
                  ? "bracket.winnerPath"
                  : "bracket.scheduledMatches",
            )}
          </span>
          {(elimination || swissLayout) && (
            <span>
              <i className={styles.dashed} />
              {t(swissLayout ? "bracket.swissLossPath" : "bracket.loserPath")}
            </span>
          )}
        </div>
        <div
          className={styles.zoom}
          role="group"
          aria-label={t("bracket.zoom")}
        >
          <button
            type="button"
            disabled={!bracket.matches.length || scale <= 0.25}
            onClick={() => setZoom(Math.max(0.25, scale - 0.15))}
            title={t("bracket.zoomOut")}
            aria-label={t("bracket.zoomOut")}
          >
            <MinusIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            title={t("bracket.actualSize")}
            aria-label={t("bracket.actualSize")}
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            disabled={!bracket.matches.length || scale >= 1.5}
            onClick={() => setZoom(Math.min(1.5, scale + 0.15))}
            title={t("bracket.zoomIn")}
            aria-label={t("bracket.zoomIn")}
          >
            <PlusIcon size={16} />
          </button>
          <button
            type="button"
            disabled={!bracket.matches.length}
            onClick={() => {
              setZoom("fit");
              viewport.current?.scrollTo({ left: 0, top: 0 });
            }}
            title={t("bracket.fit")}
            aria-label={t("bracket.fit")}
          >
            <ArrowsOutIcon size={17} />
            <span>{t("bracket.fit")}</span>
          </button>
        </div>
      </div>
      <footer className={styles.boardFooter}>
        <span>{t("bracket.panHint")}</span>
        <span>
          {t("bracket.stageLabel")} /{" "}
          {bracket.round.orderIndex != null
            ? String(bracket.round.orderIndex).padStart(2, "0")
            : bracket.round.name}
        </span>
      </footer>
    </section>
  );
}
