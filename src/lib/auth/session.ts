/**
 * What this file does:
 * Resolves a demo session from the request and computes the caller's site-level access scope.
 * What calls it:
 * `src/lib/http/routeContext.ts`, server components, and tests.
 * What it calls:
 * `src/repositories/userRepository.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Returning a user object without attaching a scoped access model, which leads to unscoped repository reads later.
 */
import { userRepository } from "@/repositories/userRepository";
import { AppError } from "@/lib/http/errors";
import { Session, User } from "@/types/domain";

const DEFAULT_DEMO_USER_ID = "user-data-manager";
const GLOBAL_ACCESS_ROLES = new Set<User["role"]>(["DATA_MANAGER", "MEDICAL_MONITOR", "UNBLINDED_PHARMACIST"]);

export async function getSessionFromRequest(request: Request): Promise<Session> {
  const userId = request.headers.get("x-demo-user-id") ?? DEFAULT_DEMO_USER_ID;
  const user = await userRepository.findById(userId);

  if (!user) {
    throw new AppError("Session user was not found.", 401, { userId });
  }

  return {
    user,
    accessScope: {
      siteIds: user.siteIds,
      canReadAllSites: GLOBAL_ACCESS_ROLES.has(user.role)
    }
  };
}

export async function getServerDemoSession(userId = DEFAULT_DEMO_USER_ID) {
  const user = await userRepository.findById(userId);

  if (!user) {
    throw new AppError("Demo user missing.", 500, { userId });
  }

  return {
    user,
    accessScope: {
      siteIds: user.siteIds,
      canReadAllSites: GLOBAL_ACCESS_ROLES.has(user.role)
    }
  } satisfies Session;
}

// ⚠️ SENIOR NOTE: Session resolution is the right place to attach scope metadata.
// If scope is computed ad hoc in services, one forgotten call site can leak cross-site data.
