"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLocale, type TranslationKey } from "@/features/locale/store";

const exactRouteTitles: Record<string, TranslationKey> = {
  "/": "pageTitle.home",
  "/login": "pageTitle.login",
  "/register": "pageTitle.register",
  "/profile": "pageTitle.profile",
  "/users/me": "pageTitle.myTournaments",
  "/tournaments": "pageTitle.tournaments",
  "/tournaments/new": "pageTitle.createTournament",
  "/admin": "pageTitle.admin",
  "/admin/tournaments": "pageTitle.adminTournaments",
  "/admin/users": "pageTitle.adminUsers",
  "/admin/reports": "pageTitle.adminReports",
  "/admin/moderation": "pageTitle.adminModeration",
  "/terms": "pageTitle.terms",
  "/privacy": "pageTitle.privacy",
  "/personal-data-policy": "pageTitle.personalData",
};

function getRouteTitle(pathname: string): TranslationKey {
  const exactTitle = exactRouteTitles[pathname];
  if (exactTitle) return exactTitle;

  if (/^\/tournaments\/[^/]+\/manage$/.test(pathname)) {
    return "pageTitle.manageTournament";
  }
  if (/^\/tournaments\/[^/]+\/register-team$/.test(pathname)) {
    return "pageTitle.registerTeam";
  }
  if (/^\/tournaments\/[^/]+$/.test(pathname)) {
    return "pageTitle.tournamentDetail";
  }

  return "pageTitle.default";
}

export default function RouteTitle() {
  const pathname = usePathname();
  const { locale, t } = useLocale();

  useEffect(() => {
    document.title = `${t(getRouteTitle(pathname))} | ArenaVerse`;
  }, [locale, pathname, t]);

  return null;
}
