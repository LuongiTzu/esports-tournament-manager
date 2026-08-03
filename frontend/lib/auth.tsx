"use client";

import { useSyncExternalStore } from "react";
import { authApi, tokenStore, User } from "@/lib/api";

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
  if (!state.ready) setState({ user: tokenStore.user, ready: true });
  return () => {
    listeners.delete(onChange);
  };
}

export async function login(email: string, password: string) {
  const res = await authApi.login({ email, password });
  tokenStore.accessToken = res.accessToken;
  tokenStore.refreshToken = res.refreshToken;
  tokenStore.user = res.user;
  setState({ user: res.user, ready: true });
}

export async function logout() {
  try {
    await authApi.logout();
  } catch {
    // token có thể đã hết hạn — vẫn xoá phía client
  }
  tokenStore.clear();
  setState({ user: null, ready: true });
}

export function useAuth() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
}
