/**
 * What this file does:
 * Lists protocol versions and allows draft version creation.
 * What calls it:
 * `src/hooks/useProtocolVersions.ts` and protocol admin mutations.
 * What it calls:
 * `src/lib/http/routeContext.ts`, `src/lib/validation/protocolSchemas.ts`, and `src/services/protocolService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Making protocol versions editable via a generic update endpoint after activation.
 */
import { createProtocolVersionSchema } from "@/lib/validation/protocolSchemas";
import { readJson, withRouteGuard } from "@/lib/http/routeContext";
import { protocolService } from "@/services/protocolService";

export async function GET(request: Request) {
  return withRouteGuard(() => protocolService.listProtocolVersions(), request, "PARTICIPANT_READ");
}

export async function POST(request: Request) {
  return withRouteGuard(
    async (session) => {
      const body = createProtocolVersionSchema.parse(await readJson(request));
      return protocolService.createProtocolVersion(session, body);
    },
    request,
    "PROTOCOL_VERSION_MANAGE"
  );
}
