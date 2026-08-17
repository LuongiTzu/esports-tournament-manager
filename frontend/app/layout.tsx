import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { LocaleProvider } from "@/features/locale/store";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Esports Hub — Quản lý giải đấu thể thao điện tử",
  description:
    "Nền tảng tổ chức và quản lý giải đấu thể thao điện tử: Tạo giải, đăng ký đội, theo dõi kết quả.",
  icons: {
    icon: [{ url: "/images/global/arenaverse-logo.png", type: "image/png" }],
    shortcut: "/images/global/arenaverse-logo.png",
    apple: "/images/global/arenaverse-logo.png",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-surface text-ink">
        <LocaleProvider>
          <Navbar />
          <main className="flex flex-1 flex-col">{children}</main>
          <Footer />
        </LocaleProvider>
      </body>
    </html>
  );
}
