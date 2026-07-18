/**
 * What this file does:
 * Returns a single participant detail payload shaped for the dashboard.
 * What calls it:
 * `src/hooks/useParticipantDetail.ts`.
 * What it calls:
 * `src/lib/http/routeContext.ts` and `src/services/participantService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Returning the raw participant row and forcing the client to stitch visits, events, and audit data together.
 */
import { withRouteGuard } from "@/lib/http/routeContext";
import { participantService } from "@/services/participantService";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ participantId: string }> }
) {
  const { participantId } = await params;

  return withRouteGuard(
    (session) => participantService.getParticipantDetail(session, participantId),
    request,
    "PARTICIPANT_READ"
  );
}
