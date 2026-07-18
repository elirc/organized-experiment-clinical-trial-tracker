/**
 * What this file does:
 * Completes a scheduled visit for a participant.
 * What calls it:
 * Visit completion mutations in `src/hooks/useParticipantDetail.ts`.
 * What it calls:
 * `src/lib/http/routeContext.ts`, `src/lib/validation/visitSchemas.ts`, and `src/services/visitService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Accepting a generic status patch endpoint instead of a constrained "complete visit" command.
 */
import { readJson, withRouteGuard } from "@/lib/http/routeContext";
import { completeVisitSchema } from "@/lib/validation/visitSchemas";
import { visitService } from "@/services/visitService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ participantId: string; visitId: string }> }
) {
  const { participantId, visitId } = await params;

  return withRouteGuard(
    async (session) => {
      const body = completeVisitSchema.parse(await readJson(request));
      return visitService.completeVisit(session, participantId, visitId, body);
    },
    request,
    "VISIT_COMPLETE"
  );
}
