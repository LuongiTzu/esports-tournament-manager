import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thông tin cá nhân | ArenaVerse",
};

export default function ProfileLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
