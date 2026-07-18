/**
 * What this file does:
 * Closes a participant out of the study after visit requirements pass.
 * What calls it:
 * Completion mutations from the participant detail UI.
 * What it calls:
 * `src/lib/http/routeContext.ts`, `src/lib/validation/participantSchemas.ts`, and `src/services/participantService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Marking participants complete directly in the repository and skipping visit validation.
 */
import { completeStudySchema } from "@/lib/validation/participantSchemas";
import { readJson, withRouteGuard } from "@/lib/http/routeContext";
import { participantService } from "@/services/participantService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ participantId: string }> }
) {
  const { participantId } = await params;

  return withRouteGuard(
    async (session) => {
      const body = completeStudySchema.parse(await readJson(request));
      return participantService.completeStudy(session, participantId, body);
    },
    request,
    "STUDY_COMPLETE"
  );
}
