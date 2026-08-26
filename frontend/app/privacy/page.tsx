import type { Metadata } from "next";
import LegalDocumentPage from "@/features/legal/components/LegalDocumentPage";

export const metadata: Metadata = {
  title: "Chính sách bảo mật | ArenaVerse",
};

export default function PrivacyPage() {
  return <LegalDocumentPage kind="privacy" />;
}
