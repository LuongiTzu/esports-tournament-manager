"use client";

import { useEffect, useSyncExternalStore } from "react";
import { authApi } from "@/features/auth/api";
import type { User } from "@/features/auth/types";
import { tokenStore } from "@/lib/api/token-store";

interface AuthState {
  user: User | null;
  /** false cho tới khi đã đọc xong localStorage — tránh redirect nhầm khi chưa hydrate */
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

function hydrateAuthState() {
  if (state.ready) return;
  setState({ user: tokenStore.getUser<User>(), ready: true });
}

export async function login(email: string, password: string) {
  const res = await authApi.login({ email, password });
  tokenStore.accessToken = res.accessToken;
  tokenStore.refreshToken = res.refreshToken;
  tokenStore.setUser(res.user);
  setState({ user: res.user, ready: true });
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

export function useAuth() {
  const authState = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );

  useEffect(() => {
    hydrateAuthState();
  }, []);

  return authState;
}
