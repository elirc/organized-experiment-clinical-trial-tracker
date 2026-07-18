/**
 * What this file does:
 * Records participant adverse events.
 * What calls it:
 * Safety event mutations from the participant detail UI.
 * What it calls:
 * `src/lib/http/routeContext.ts`, `src/lib/validation/eventSchemas.ts`, and `src/services/safetyEventService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Treating adverse events as free-form notes and losing structured safety signals.
 */
import { createAdverseEventSchema } from "@/lib/validation/eventSchemas";
import { readJson, withRouteGuard } from "@/lib/http/routeContext";
import { safetyEventService } from "@/services/safetyEventService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ participantId: string }> }
) {
  const { participantId } = await params;

  return withRouteGuard(
    async (session) => {
      const body = createAdverseEventSchema.parse(await readJson(request));
      return safetyEventService.recordAdverseEvent(session, participantId, body);
    },
    request,
    "ADVERSE_EVENT_CREATE"
  );
}
