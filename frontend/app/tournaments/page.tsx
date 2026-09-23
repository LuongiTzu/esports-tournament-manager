import { Suspense } from "react";
import TournamentDiscovery from "@/features/tournaments/components/TournamentDiscovery";

export default function TournamentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <TournamentDiscovery />
    </Suspense>
  );
}
