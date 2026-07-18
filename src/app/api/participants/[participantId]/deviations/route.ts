/**
 * What this file does:
 * Records protocol deviations against a participant.
 * What calls it:
 * Deviation logging mutations from the participant detail UI.
 * What it calls:
 * `src/lib/http/routeContext.ts`, `src/lib/validation/eventSchemas.ts`, and `src/services/safetyEventService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Logging deviations without a category, which makes operational review impossible later.
 */
import { createDeviationSchema } from "@/lib/validation/eventSchemas";
import { readJson, withRouteGuard } from "@/lib/http/routeContext";
import { safetyEventService } from "@/services/safetyEventService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ participantId: string }> }
) {
  const { participantId } = await params;

  return withRouteGuard(
    async (session) => {
      const body = createDeviationSchema.parse(await readJson(request));
      return safetyEventService.recordDeviation(session, participantId, body);
    },
    request,
    "DEVIATION_CREATE"
  );
}
