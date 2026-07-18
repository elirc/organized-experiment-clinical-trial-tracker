/**
 * What this file does:
 * Activates a protocol version and retires the previously active version for the same study.
 * What calls it:
 * Protocol management mutations.
 * What it calls:
 * `src/lib/http/routeContext.ts`, `src/lib/validation/protocolSchemas.ts`, and `src/services/protocolService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Performing activation as a client-side toggle and forgetting the server-side audit trail.
 */
import { activateProtocolVersionSchema } from "@/lib/validation/protocolSchemas";
import { readJson, withRouteGuard } from "@/lib/http/routeContext";
import { protocolService } from "@/services/protocolService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { versionId } = await params;

  return withRouteGuard(
    async (session) => {
      activateProtocolVersionSchema.parse(await readJson(request));
      return protocolService.activateProtocolVersion(session, versionId);
    },
    request,
    "PROTOCOL_VERSION_MANAGE"
  );
}
