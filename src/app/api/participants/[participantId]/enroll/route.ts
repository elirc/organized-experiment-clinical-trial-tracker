/**
 * What this file does:
 * Handles participant enrollment against a specific protocol version.
 * What calls it:
 * Enrollment mutations from the participant UI.
 * What it calls:
 * `src/lib/http/routeContext.ts`, `src/lib/validation/participantSchemas.ts`, and `src/services/participantService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Resolving the active protocol version in the browser instead of sending an explicit version choice to the backend.
 */
import { enrollParticipantSchema } from "@/lib/validation/participantSchemas";
import { readJson, withRouteGuard } from "@/lib/http/routeContext";
import { participantService } from "@/services/participantService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ participantId: string }> }
) {
  const { participantId } = await params;

  return withRouteGuard(
    async (session) => {
      const body = enrollParticipantSchema.parse(await readJson(request));
      return participantService.enrollParticipant(session, participantId, body);
    },
    request,
    "PARTICIPANT_ENROLL"
  );
}
