/**
 * What this file does:
 * Exposes participant list and participant screening creation endpoints.
 * What calls it:
 * `src/hooks/useParticipants.ts` and future form mutations.
 * What it calls:
 * `src/lib/http/routeContext.ts`, `src/lib/validation/participantSchemas.ts`, and `src/services/participantService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Parsing request JSON after calling the service, which skips the validation boundary entirely.
 */
import { createParticipantSchema } from "@/lib/validation/participantSchemas";
import { readJson, withRouteGuard } from "@/lib/http/routeContext";
import { participantService } from "@/services/participantService";

export async function GET(request: Request) {
  return withRouteGuard((session) => participantService.listParticipants(session), request, "PARTICIPANT_READ");
}

export async function POST(request: Request) {
  return withRouteGuard(
    async (session) => {
      const body = createParticipantSchema.parse(await readJson(request));
      return participantService.createScreeningParticipant(session, body);
    },
    request,
    "PARTICIPANT_CREATE"
  );
}
