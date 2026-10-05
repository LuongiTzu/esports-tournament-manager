import { GameControllerIcon } from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { gameIcon } from "../game-icons";
import type { GameRef } from "../types";
import styles from "./GameIcon.module.css";

export default function GameIcon({
  game,
  size = 20,
  className = "",
  label,
}: {
  game?: Pick<GameRef, "code" | "name" | "iconUrl"> | null;
  size?: number;
  className?: string;
  /** Omit beside a visible game name; provide only for a standalone icon. */
  label?: string;
}) {
  const icon = gameIcon(game);
  const source = icon?.src;

  return (
    <span
      className={`${styles.icon} ${className}`}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-game-icon={icon?.code ?? game?.code ?? "unknown"}
    >
      {source ? (
        <span
          className={styles.mark}
          style={{
            maskImage: `url("${source}")`,
            WebkitMaskImage: `url("${source}")`,
          }}
        />
      ) : (
        <ResolvedImage
          src={game?.iconUrl}
          alt=""
          className={styles.image}
          fallback={<GameControllerIcon size={size} weight="duotone" />}
        />
      )}
    </span>
  );
}
