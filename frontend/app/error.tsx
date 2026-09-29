"use client";

import RouteErrorState from "@/components/errors/RouteErrorState";

export default function AppError({ reset }: { reset: () => void }) {
  return <RouteErrorState reset={reset} />;
}
