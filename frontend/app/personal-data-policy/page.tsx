import type { Metadata } from "next";
import LegalDocumentPage from "@/features/legal/components/LegalDocumentPage";

export const metadata: Metadata = {
  title: "Chính sách bảo mật thông tin cá nhân | ArenaVerse",
};

export default function PersonalDataPolicyPage() {
  return <LegalDocumentPage kind="personal-data" />;
}
