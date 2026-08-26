import type { Metadata } from "next";
import LegalDocumentPage from "@/features/legal/components/LegalDocumentPage";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng | ArenaVerse",
};

export default function TermsPage() {
  return <LegalDocumentPage kind="terms" />;
}
