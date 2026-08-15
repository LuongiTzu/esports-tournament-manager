import type { ElementType, ReactNode } from "react";
import { accentVars } from "@/features/games/game-accent";

export default function GameAccent({
  game,
  as: Tag = "div",
  className,
  children,
}: {
  game?: { name: string } | null;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={className} style={accentVars(game?.name)}>
      {children}
    </Tag>
  );
}
