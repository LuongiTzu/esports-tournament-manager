import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import RouteTitle from "@/components/RouteTitle";
import { LocaleProvider } from "@/features/locale/store";
import { ThemeProvider } from "@/features/theme/store";
import { RealtimeProvider } from "@/features/realtime/provider";

const themeBootstrapScript = `
(() => {
  const key = "etm-theme";
  const valid = ["light", "dark", "system"];
  try {
    const saved = localStorage.getItem(key);
    const preference = valid.includes(saved) ? saved : "dark";
    const resolved = preference === "system"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : preference;
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.themePreference = preference;
    root.style.colorScheme = resolved;
  } catch {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.dataset.themePreference = "dark";
  }
})();`;

export const metadata: Metadata = {
  title: "ArenaVerse — Quản lý giải đấu thể thao điện tử",
  description:
    "Nền tảng tổ chức và quản lý giải đấu thể thao điện tử: Tạo giải, đăng ký đội, theo dõi kết quả.",
  icons: {
    icon: [{ url: "/images/global/logo-web-cut-background.png", type: "image/png" }],
    shortcut: "/images/global/logo-web-cut-background.png",
    apple: "/images/global/logo-web-cut-background.png",
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
      suppressHydrationWarning
      className="h-full antialiased"
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
