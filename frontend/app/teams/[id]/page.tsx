"use client";

import { use } from "react";
import TeamDetailPage from "@/features/teams/components/TeamDetailPage";

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <TeamDetailPage teamId={id} />;
}
