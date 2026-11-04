"use client";

import { createPortal } from "react-dom";
import { useLocale } from "@/features/locale/store";
import styles from "./NavigationIndicator.module.css";

export default function NavigationIndicator({ pending }: { pending: boolean }) {
  const { t } = useLocale();
  if (!pending) return null;

  // Escape transformed/overflow-hidden cards and menus containing the link.
  return createPortal(
    <div className={styles.indicator} role="status" aria-live="polite">
      <div className={styles.track} aria-hidden="true">
        <div className={styles.bar} />
      </div>
      <div className={styles.label}>
        <span className={styles.spinner} aria-hidden="true" />
        {t("common.loading")}
      </div>
    </div>,
    document.body,
  );
}
