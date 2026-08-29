"use client";

import { useEffect, useRef, useState } from "react";

interface SensitiveTokenState {
  ready: boolean;
  token: string;
  registered: boolean;
}

export function useSensitiveToken(): SensitiveTokenState {
  const initialized = useRef(false);
  const [state, setState] = useState<SensitiveTokenState>({
    ready: false,
    token: "",
    registered: false,
  });

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const search = window.location.search;
    const params = new URLSearchParams(search);
    setState({
      ready: true,
      token: params.get("token") ?? "",
      registered: params.get("registered") === "1",
    });

    if (search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return state;
}
