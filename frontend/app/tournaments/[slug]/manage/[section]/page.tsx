import { notFound } from "next/navigation";
import TournamentManageClient, {
  type ManageSection,
} from "@/features/tournaments/components/manage/TournamentManageClient";

const sections: ManageSection[] = [
  "competition",
  "registrations",
  "announcements",
  "staff",
  "tools",
];

export default async function ManageSectionPage({
  params,
}: {
  params: Promise<{ slug: string; section: string }>;
}) {
  const { slug, section } = await params;
  if (!sections.some((item) => item === section)) notFound();
  return <TournamentManageClient slug={slug} section={section as ManageSection} />;
}
