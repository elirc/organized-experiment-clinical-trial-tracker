/**
 * What this file does:
 * Provides the consistent entry point for API handlers: session resolution, permission guard, and JSON responses.
 * What calls it:
 * Every route file under `src/app/api`.
 * What it calls:
 * `src/lib/auth/session.ts`, `src/lib/auth/permissions.ts`, and `src/lib/http/errors.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Repeating auth and error handling in every route until the endpoints behave differently under failure.
 */
import { assertPermission } from "@/lib/auth/permissions";
import { getSessionFromRequest } from "@/lib/auth/session";
import { AppError, toAppError } from "@/lib/http/errors";
import { Permission, Session } from "@/types/domain";

export async function readJson<T>(request: Request) {
  return (await request.json()) as T;
}

export async function requireRouteContext(request: Request, permission: Permission) {
  const session = await getSessionFromRequest(request);
  assertPermission(session, permission);
  return { session };
}

export async function withRouteGuard<T>(handler: (session: Session) => Promise<T>, request: Request, permission: Permission) {
  try {
    const { session } = await requireRouteContext(request, permission);
    const result = await handler(session);

    return Response.json(result);
  } catch (error) {
    const appError = toAppError(error);
    const body = {
      error: appError.message,
      details: appError.details ?? null
    };

    return Response.json(body, { status: appError.status });
  }
}

export function assertSiteAccess(session: Session, siteId: string) {
  if (!session.accessScope.canReadAllSites && !session.accessScope.siteIds.includes(siteId)) {
    throw new AppError("Caller does not have access to this site.", 403, { siteId });
  }

  // ⚠️ SENIOR NOTE: Site scoping belongs close to the request and repository boundary.
  // If we only filter in the UI, cross-site data leaks become one missing condition away.
}
