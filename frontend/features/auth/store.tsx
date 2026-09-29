"use client";

import { useEffect, useSyncExternalStore } from "react";
import { authApi } from "@/features/auth/api";
import type { User } from "@/features/auth/types";
import { restoreAccessToken } from "@/lib/api/client";
import { tokenStore } from "@/lib/api/token-store";

interface AuthState {
  user: User | null;
  /** false cho tới khi cookie phiên đã được kiểm tra — tránh redirect nhầm */
  ready: boolean;
}

const SERVER_STATE: AuthState = { user: null, ready: false };

let state: AuthState = SERVER_STATE;
const listeners = new Set<() => void>();

function setState(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

let hydrationRequest: Promise<void> | null = null;

function hydrateAuthState() {
  if (state.ready) return Promise.resolve();
  if (hydrationRequest) return hydrationRequest;

  tokenStore.clearLegacyTokens();
  hydrationRequest = (async () => {
    const accessToken = await restoreAccessToken();
    if (!accessToken) {
      clearSession();
      return;
    }

    try {
      const user = await authApi.getMe();
      tokenStore.setUser(user);
      setState({ user, ready: true });
    } catch {
      clearSession();
    }
  })().finally(() => {
    hydrationRequest = null;
  });
  return hydrationRequest;
}

function persistLogin(res: Awaited<ReturnType<typeof authApi.login>>) {
  tokenStore.accessToken = res.accessToken;
  tokenStore.setUser(res.user);
  setState({ user: res.user, ready: true });
}

export async function login(email: string, password: string) {
  await hydrateAuthState();
  persistLogin(await authApi.login({ email, password }));
}

export async function loginWithGoogle(credential: string) {
  await hydrateAuthState();
  persistLogin(await authApi.googleLogin({ credential }));
}

export async function logout() {
  try {
    await authApi.logout();
  } catch {
    // token có thể đã hết hạn — vẫn xoá phía client
  }
  clearSession();
}

export function clearSession() {
  tokenStore.clear();
  setState({ user: null, ready: true });
}

export function updateCurrentUser(user: User) {
  tokenStore.setUser(user);
  setState({ user, ready: true });
}

export function useAuth() {
  const authState = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );

  useEffect(() => {
    void hydrateAuthState();
  }, []);

  return authState;
}
