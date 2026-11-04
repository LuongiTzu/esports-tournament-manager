"use client";

import {
  createContext,
  useContext,
  useMemo,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from "react";
import { useRouter as useNextRouter } from "next/navigation";
import NavigationIndicator from "./NavigationIndicator";

const NavigationContext = createContext<TransitionStartFunction | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [pending, startNavigation] = useTransition();

  return (
    <NavigationContext.Provider value={startNavigation}>
      {children}
      <NavigationIndicator pending={pending} />
    </NavigationContext.Provider>
  );
}

// Keep pending state in the root layout even when the initiating menu closes.
export function useRouter() {
  const router = useNextRouter();
  const startNavigation = useContext(NavigationContext);
  if (!startNavigation) throw new Error("useRouter requires NavigationProvider");

  return useMemo<typeof router>(
    () => ({
      ...router,
      push: (...args) => startNavigation(() => router.push(...args)),
      replace: (...args) => startNavigation(() => router.replace(...args)),
      refresh: () => startNavigation(() => router.refresh()),
    }),
    [router, startNavigation],
  );
}
