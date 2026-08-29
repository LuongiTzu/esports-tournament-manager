"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/features/locale/store";
import { useTheme } from "@/features/theme/store";
import styles from "./AuthSurface.module.css";

const DEFAULT_GOOGLE_CLIENT_ID =
  "949601885792-m52054b0aansuoaoe8b208qgl9a4t8hr.apps.googleusercontent.com";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: "popup" | "redirect";
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type: "standard";
      theme: "outline" | "filled_black";
      size: "large";
      text: "signin_with" | "signup_with";
      shape: "pill";
      logo_alignment: "left";
      width: number;
      locale: string;
    },
  ): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsId;
      };
    };
  }
}

export default function GoogleSignInButton({
  mode,
  disabled = false,
  onCredential,
  onError,
}: {
  mode: "signin" | "signup";
  disabled?: boolean;
  onCredential: (credential: string) => void;
  onError: () => void;
}) {
  const { locale, t } = useLocale();
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const credentialHandlerRef = useRef(onCredential);
  const errorHandlerRef = useRef(onError);
  const disabledRef = useRef(disabled);
  const [scriptReady, setScriptReady] = useState(false);
  const [renderStatus, setRenderStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");

  useEffect(() => {
    credentialHandlerRef.current = onCredential;
    errorHandlerRef.current = onError;
    disabledRef.current = disabled;
  }, [disabled, onCredential, onError]);

  useEffect(() => {
    const container = containerRef.current;
    const accounts = window.google?.accounts.id;
    if (!scriptReady || !container || !accounts) return;

    setRenderStatus("loading");
    const clientId =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? DEFAULT_GOOGLE_CLIENT_ID;
    container.replaceChildren();
    const markReady = () => {
      if (container.querySelector("iframe")) setRenderStatus("ready");
    };
    const observer = new MutationObserver(markReady);
    observer.observe(container, { childList: true, subtree: true });
    accounts.initialize({
      client_id: clientId,
      ux_mode: "popup",
      callback: (response) => {
        if (disabledRef.current) return;
        if (!response.credential) {
          errorHandlerRef.current();
          return;
        }
        credentialHandlerRef.current(response.credential);
      },
    });
    accounts.renderButton(container, {
      type: "standard",
      theme: resolvedTheme === "dark" ? "filled_black" : "outline",
      size: "large",
      text: mode === "signup" ? "signup_with" : "signin_with",
      shape: "pill",
      logo_alignment: "left",
      width: 256,
      locale,
    });
    markReady();
    const renderTimeout = window.setTimeout(() => {
      if (!container.querySelector("iframe")) {
        setRenderStatus("error");
        errorHandlerRef.current();
      }
    }, 3000);

    return () => {
      window.clearTimeout(renderTimeout);
      observer.disconnect();
      container.replaceChildren();
    };
  }, [locale, mode, resolvedTheme, scriptReady]);

  return (
    <div className={styles.googleArea}>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => errorHandlerRef.current()}
      />
      <div
        className={styles.googleButtonFrame}
        aria-busy={renderStatus === "loading"}
        aria-disabled={disabled || renderStatus === "error"}
      >
        <div ref={containerRef} className={styles.googleButtonHost} />
        {renderStatus !== "ready" && (
          <span className={styles.googleButtonLoading}>
            {renderStatus === "error"
              ? t("auth.google.unavailable")
              : t("auth.google.loading")}
          </span>
        )}
      </div>
    </div>
  );
}
