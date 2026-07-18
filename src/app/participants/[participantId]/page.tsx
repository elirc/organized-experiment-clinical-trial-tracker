import Link from "next/link";
import { ParticipantDetailView } from "@/components/participants/ParticipantDetailView";

export default async function ParticipantDetailPage({
  params
}: {
  params: Promise<{ participantId: string }>;
}) {
  const { participantId } = await params;

  return (
    <main className="grid gap-6">
      <Link className="text-sm font-medium text-signal hover:text-ink" href="/participants">
        Back to participant list
      </Link>
      <ParticipantDetailView participantId={participantId} />
    </main>
  );
}
