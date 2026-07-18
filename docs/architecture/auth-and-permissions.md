# Auth And Permissions

Auth is mocked but the boundary is real. Session resolution starts in `getSessionFromRequest()` inside [src/lib/auth/session.ts](/c:/Users/Owner/Desktop/ww11/src/lib/auth/session.ts), which reads `x-demo-user-id`, loads the caller through `userRepository.findById()` in [src/repositories/userRepository.ts](/c:/Users/Owner/Desktop/ww11/src/repositories/userRepository.ts), and attaches an access scope with `siteIds` plus `canReadAllSites`.

Permissions are centralized in `rolePermissions` and enforced by `assertPermission()` in [src/lib/auth/permissions.ts](/c:/Users/Owner/Desktop/ww11/src/lib/auth/permissions.ts). Route handlers do not inspect roles directly; they call `withRouteGuard()` in [src/lib/http/routeContext.ts](/c:/Users/Owner/Desktop/ww11/src/lib/http/routeContext.ts), which resolves the session and invokes `assertPermission()` before the request reaches any service method.

Role capabilities are intentionally explicit:

- `STUDY_COORDINATOR`
  Can: read participants, create screening participants, enroll, complete visits, record deviations.
  Cannot: manage protocol versions, complete study, unblind treatment arms, read audit logs.
  Source: `rolePermissions.STUDY_COORDINATOR` in [src/lib/auth/permissions.ts](/c:/Users/Owner/Desktop/ww11/src/lib/auth/permissions.ts).

- `PRINCIPAL_INVESTIGATOR`
  Can: read participants, enroll, complete visits, complete study, record adverse events and deviations.
  Cannot: manage protocol versions, unblind treatment arms.
  Source: `rolePermissions.PRINCIPAL_INVESTIGATOR` in [src/lib/auth/permissions.ts](/c:/Users/Owner/Desktop/ww11/src/lib/auth/permissions.ts).

- `DATA_MANAGER`
  Can: participant operations, protocol version management, audit-log read.
  Cannot: unblind treatment arms.
  Source: `rolePermissions.DATA_MANAGER` in [src/lib/auth/permissions.ts](/c:/Users/Owner/Desktop/ww11/src/lib/auth/permissions.ts).

- `MEDICAL_MONITOR`
  Can: read participants, record adverse events, unblind treatment arms.
  Cannot: enroll or manage protocol versions.
  Source: `rolePermissions.MEDICAL_MONITOR` in [src/lib/auth/permissions.ts](/c:/Users/Owner/Desktop/ww11/src/lib/auth/permissions.ts).

- `UNBLINDED_PHARMACIST`
  Can: read participants and unblind treatment arms.
  Cannot: enroll, complete visits, or manage protocol versions.
  Source: `rolePermissions.UNBLINDED_PHARMACIST` in [src/lib/auth/permissions.ts](/c:/Users/Owner/Desktop/ww11/src/lib/auth/permissions.ts).

Blinding enforcement happens in `maskTreatmentArm()` in [src/services/participantService.ts](/c:/Users/Owner/Desktop/ww11/src/services/participantService.ts). That function checks `hasPermission(session.user.role, "TREATMENT_ARM_UNBLIND")` before including `actualTreatmentArm` in participant summaries or details. The important design choice is that blinding is enforced in the service output shaping, not just hidden in the UI.

Data isolation is site-based rather than tenant-based. Session scope is computed in [src/lib/auth/session.ts](/c:/Users/Owner/Desktop/ww11/src/lib/auth/session.ts), then repository reads are filtered in `participantRepository.list()` and `participantRepository.findById()` inside [src/repositories/participantRepository.ts](/c:/Users/Owner/Desktop/ww11/src/repositories/participantRepository.ts). The repository returns `null` for out-of-scope participants, and `participantService.getParticipantDetail()` in [src/services/participantService.ts](/c:/Users/Owner/Desktop/ww11/src/services/participantService.ts) turns that into `404`, which avoids confirming the existence of cross-site records.

Audit visibility is also permission-based. `participantService.getParticipantDetail()` in [src/services/participantService.ts](/c:/Users/Owner/Desktop/ww11/src/services/participantService.ts) only returns `auditTrail` when `hasPermission(role, "AUDIT_LOG_READ")` is true.

If you wanted to add full multi-tenancy later, the smallest clean change would be:

- Add `tenantId` to tenant-owned models in [prisma/schema.prisma](/c:/Users/Owner/Desktop/ww11/prisma/schema.prisma).
- Extend `Session.accessScope` in [src/types/domain.ts](/c:/Users/Owner/Desktop/ww11/src/types/domain.ts) and [src/lib/auth/session.ts](/c:/Users/Owner/Desktop/ww11/src/lib/auth/session.ts) to include allowed tenant IDs.
- Thread `tenantId` through repositories like [src/repositories/participantRepository.ts](/c:/Users/Owner/Desktop/ww11/src/repositories/participantRepository.ts) the same way `siteId` is used now.
- Split platform permissions from tenant-scoped permissions in [src/lib/auth/permissions.ts](/c:/Users/Owner/Desktop/ww11/src/lib/auth/permissions.ts) so “manage protocol versions globally” and “operate inside tenant X” stay distinct.
