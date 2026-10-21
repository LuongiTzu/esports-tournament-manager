import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import RouteTitle from "@/components/RouteTitle";
import { LocaleProvider } from "@/features/locale/store";
import { ThemeProvider } from "@/features/theme/store";
import { RealtimeProvider } from "@/features/realtime/provider";
import { getSiteUrl } from "@/lib/site-url";

const play = localFont({
  src: [
    { path: "../assets/fonts/play/Play-Regular.ttf", weight: "400" },
    { path: "../assets/fonts/play/Play-Bold.ttf", weight: "700" },
  ],
  variable: "--font-play",
  display: "swap",
});

const themeBootstrapScript = `
(() => {
  const root = document.documentElement;
  try {
    const key = "etm-theme";
    const valid = ["light", "dark", "system"];
    const saved = localStorage.getItem(key);
    const preference = valid.includes(saved) ? saved : "dark";
    const resolved = preference === "system"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : preference;
    root.dataset.theme = resolved;
    root.dataset.themePreference = preference;
    root.style.colorScheme = resolved;
  } catch {
    root.dataset.theme = "dark";
    root.dataset.themePreference = "dark";
  }
  try {
    const cookieLocale = document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith("etm-locale="))
      ?.slice("etm-locale=".length);
    const savedLocale = localStorage.getItem("etm-locale") || cookieLocale;
    if (savedLocale === "vi" || savedLocale === "en") {
      root.lang = savedLocale;
    }
  } catch {
    // Keep the server default when storage is unavailable.
  }
})();`;

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: "ArenaVerse — Quản lý giải đấu thể thao điện tử",
  description:
    "Nền tảng tổ chức và quản lý giải đấu thể thao điện tử: Tạo giải, đăng ký đội, theo dõi kết quả.",
  icons: {
    icon: [{ url: "/images/global/newlogoweb.png", type: "image/png" }],
    shortcut: "/images/global/newlogoweb.png",
    apple: "/images/global/newlogoweb.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      data-theme="dark"
      data-theme-preference="dark"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`h-full antialiased ${play.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-surface text-ink">
        <ThemeProvider>
          <LocaleProvider>
            <RouteTitle />
            <RealtimeProvider>
              <Navbar />
              <main className="flex flex-1 flex-col">{children}</main>
              <Footer />
            </RealtimeProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
