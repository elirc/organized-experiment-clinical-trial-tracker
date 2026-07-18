/**
 * What this file does:
 * Defines the system-wide permission matrix and provides the reusable RBAC check used by services and routes.
 * What calls it:
 * `src/lib/http/routeContext.ts`, `src/services/*`, and tests under `tests/services`.
 * What it calls:
 * No external dependencies; this stays pure so authorization is easy to unit test.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Checking roles directly inside every route instead of mapping roles to permissions in one place.
 */
import { Permission, Role, Session } from "@/types/domain";
import { AppError } from "@/lib/http/errors";

const rolePermissions: Record<Role, Permission[]> = {
  STUDY_COORDINATOR: [
    "PARTICIPANT_READ",
    "PARTICIPANT_CREATE",
    "PARTICIPANT_ENROLL",
    "VISIT_COMPLETE",
    "DEVIATION_CREATE"
  ],
  PRINCIPAL_INVESTIGATOR: [
    "PARTICIPANT_READ",
    "PARTICIPANT_ENROLL",
    "VISIT_COMPLETE",
    "STUDY_COMPLETE",
    "ADVERSE_EVENT_CREATE",
    "DEVIATION_CREATE"
  ],
  DATA_MANAGER: [
    "PARTICIPANT_READ",
    "PARTICIPANT_CREATE",
    "PARTICIPANT_ENROLL",
    "VISIT_COMPLETE",
    "STUDY_COMPLETE",
    "ADVERSE_EVENT_CREATE",
    "DEVIATION_CREATE",
    "PROTOCOL_VERSION_MANAGE",
    "AUDIT_LOG_READ"
  ],
  MEDICAL_MONITOR: ["PARTICIPANT_READ", "ADVERSE_EVENT_CREATE", "TREATMENT_ARM_UNBLIND"],
  UNBLINDED_PHARMACIST: ["PARTICIPANT_READ", "TREATMENT_ARM_UNBLIND"]
};

export function hasPermission(role: Role, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

export function assertPermission(session: Session, permission: Permission) {
  if (!hasPermission(session.user.role, permission)) {
    throw new AppError(`Role ${session.user.role} cannot perform ${permission}.`, 403, {
      role: session.user.role,
      permission
    });
  }

  // ⚠️ SENIOR NOTE: Authorization bugs often happen because engineers stop at "authenticated".
  // The explicit permission check here prevents role creep from leaking into handlers.
}
