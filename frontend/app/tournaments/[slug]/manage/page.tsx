import TournamentManageClient from "@/features/tournaments/components/manage/TournamentManageClient";

export default async function ManagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <TournamentManageClient slug={slug} section="overview" />;
}
