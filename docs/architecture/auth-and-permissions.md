# Auth And Permissions

Auth is mocked but the boundary is real. Session resolution starts in `getSessionFromRequest()` inside [src/lib/auth/session.ts](../../src/lib/auth/session.ts), which reads `x-demo-user-id`, loads the caller through `userRepository.findById()` in [src/repositories/userRepository.ts](../../src/repositories/userRepository.ts), and attaches an access scope with `siteIds` plus `canReadAllSites`.

Permissions are centralized in `rolePermissions` and enforced by `assertPermission()` in [src/lib/auth/permissions.ts](../../src/lib/auth/permissions.ts). Route handlers do not inspect roles directly; they call `withRouteGuard()` in [src/lib/http/routeContext.ts](../../src/lib/http/routeContext.ts), which resolves the session and invokes `assertPermission()` before the request reaches any service method.

Role capabilities are intentionally explicit:

- `STUDY_COORDINATOR`
  Can: read participants, create screening participants, enroll, complete visits, record deviations.
  Cannot: manage protocol versions, complete study, unblind treatment arms, read audit logs.
  Source: `rolePermissions.STUDY_COORDINATOR` in [src/lib/auth/permissions.ts](../../src/lib/auth/permissions.ts).

- `PRINCIPAL_INVESTIGATOR`
  Can: read participants, enroll, complete visits, complete study, record adverse events and deviations.
  Cannot: manage protocol versions, unblind treatment arms.
  Source: `rolePermissions.PRINCIPAL_INVESTIGATOR` in [src/lib/auth/permissions.ts](../../src/lib/auth/permissions.ts).

- `DATA_MANAGER`
  Can: participant operations, protocol version management, audit-log read.
  Cannot: unblind treatment arms.
  Source: `rolePermissions.DATA_MANAGER` in [src/lib/auth/permissions.ts](../../src/lib/auth/permissions.ts).

- `MEDICAL_MONITOR`
  Can: read participants, record adverse events, unblind treatment arms.
  Cannot: enroll or manage protocol versions.
  Source: `rolePermissions.MEDICAL_MONITOR` in [src/lib/auth/permissions.ts](../../src/lib/auth/permissions.ts).

- `UNBLINDED_PHARMACIST`
  Can: read participants and unblind treatment arms.
  Cannot: enroll, complete visits, or manage protocol versions.
  Source: `rolePermissions.UNBLINDED_PHARMACIST` in [src/lib/auth/permissions.ts](../../src/lib/auth/permissions.ts).

Blinding enforcement happens in `maskTreatmentArm()` in [src/services/participantService.ts](../../src/services/participantService.ts). That function checks `hasPermission(session.user.role, "TREATMENT_ARM_UNBLIND")` before including `actualTreatmentArm` in participant summaries or details. The important design choice is that blinding is enforced in the service output shaping, not just hidden in the UI.

Data isolation is site-based rather than tenant-based. Session scope is computed in [src/lib/auth/session.ts](../../src/lib/auth/session.ts), then repository reads are filtered in `participantRepository.list()` and `participantRepository.findById()` inside [src/repositories/participantRepository.ts](../../src/repositories/participantRepository.ts). The repository returns `null` for out-of-scope participants, and `participantService.getParticipantDetail()` in [src/services/participantService.ts](../../src/services/participantService.ts) turns that into `404`, which avoids confirming the existence of cross-site records.

Audit visibility is also permission-based. `participantService.getParticipantDetail()` in [src/services/participantService.ts](../../src/services/participantService.ts) only returns `auditTrail` when `hasPermission(role, "AUDIT_LOG_READ")` is true.

If you wanted to add full multi-tenancy later, the smallest clean change would be:

- Add `tenantId` to tenant-owned models in [prisma/schema.prisma](../../prisma/schema.prisma).
- Extend `Session.accessScope` in [src/types/domain.ts](../../src/types/domain.ts) and [src/lib/auth/session.ts](../../src/lib/auth/session.ts) to include allowed tenant IDs.
- Thread `tenantId` through repositories like [src/repositories/participantRepository.ts](../../src/repositories/participantRepository.ts) the same way `siteId` is used now.
- Split platform permissions from tenant-scoped permissions in [src/lib/auth/permissions.ts](../../src/lib/auth/permissions.ts) so “manage protocol versions globally” and “operate inside tenant X” stay distinct.

---

## The permission matrix, counted

`rolePermissions` sits at `src/lib/auth/permissions.ts:14-43`. The table was produced by calling `hasPermission(role, permission)` for all 5 roles × 10 permissions in a scratch test (**verified (ran)**: per-role counts `[5, 6, 9, 3, 2]`).

| Permission | COORD | PI | DATA_MGR | MED_MON | PHARM |
|---|---|---|---|---|---|
| `PARTICIPANT_READ` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `PARTICIPANT_CREATE` | ✓ | | ✓ | | |
| `PARTICIPANT_ENROLL` | ✓ | ✓ | ✓ | | |
| `VISIT_COMPLETE` | ✓ | ✓ | ✓ | | |
| `STUDY_COMPLETE` | | ✓ | ✓ | | |
| `ADVERSE_EVENT_CREATE` | | ✓ | ✓ | ✓ | |
| `DEVIATION_CREATE` | ✓ | ✓ | ✓ | | |
| `PROTOCOL_VERSION_MANAGE` | | | ✓ | | |
| `AUDIT_LOG_READ` | | | ✓ | | |
| `TREATMENT_ARM_UNBLIND` | | | | ✓ | ✓ |
| **Total** | 5 | 6 | 9 | 3 | 2 |

Two things worth noticing in the matrix:

- `DATA_MANAGER` holds 9 of the 10 permissions but **not** `TREATMENT_ARM_UNBLIND`. The UI always calls as the data manager (`src/hooks/apiClient.ts:1,8`), so the shipped UI never shows a treatment arm. To see unblinding in the UI you have to edit `DEMO_USER_ID` to `user-monitor` or `user-pharmacist`.
- `PI` lacks `PARTICIPANT_CREATE`. A principal investigator can enroll a participant but cannot screen one. Decide whether that is intended before you build a "screen" button for PIs.

The check itself is a lookup plus a throw:

```ts
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
```

(`src/lib/auth/permissions.ts:45-55`.) The 403 body includes the caller's role and the missing permission in `details`. That makes debugging easy, but it also tells a probing client exactly which permission to look for.

## How identity is resolved (and the fail-open default)

```ts
const DEFAULT_DEMO_USER_ID = "user-data-manager";
const GLOBAL_ACCESS_ROLES = new Set<User["role"]>(["DATA_MANAGER", "MEDICAL_MONITOR", "UNBLINDED_PHARMACIST"]);

export async function getSessionFromRequest(request: Request): Promise<Session> {
  const userId = request.headers.get("x-demo-user-id") ?? DEFAULT_DEMO_USER_ID;
```

(`src/lib/auth/session.ts:15-19`.)

- **Finding F1 (verified, ran).** If the header is absent, the caller *becomes* `DATA_MANAGER`, the role with the most permissions. A check built a bare `new Request("http://x/api")`, passed it through `withRouteGuard(..., "PROTOCOL_VERSION_MANAGE")`, and got HTTP 200. An unknown id (`x-demo-user-id: ghost`) correctly gets 401 (`session.ts:22-24`). For a demo this default is convenient. In any real deployment, missing credentials must mean 401, never "admin". Any client can also set the header to whatever it wants, so this is identity by assertion, not authentication.
- `canReadAllSites` is derived from the **role**, not from `siteIds` (`session.ts:30`). The seed gives the monitor and the pharmacist `siteIds: ["site-101", "site-202"]` (`src/lib/mock-db/seed.ts:40,47`), but that array is ignored for them because their role is in `GLOBAL_ACCESS_ROLES`. If a third site is added, those roles see it automatically, and coordinators only see it if their `siteIds` list it.
- `getServerDemoSession()` (`session.ts:35-49`) duplicates the scope computation instead of sharing a helper. The two copies are identical today. If someone changes one, server components (`src/app/page.tsx:6`) and API routes would compute scope differently.

## Where site scope is (and is not) enforced

Site scope is a single predicate:

```ts
function canAccessSite(session: Session, siteId: string) {
  return session.accessScope.canReadAllSites || session.accessScope.siteIds.includes(siteId);
}
```

(`src/repositories/participantRepository.ts:15-17`.) It is applied in `list()` (`:28-30`) and `findById()` (`:32-44`). Every child-record path goes through a scoped participant lookup first:

| Path | Scoped lookup | Line |
|---|---|---|
| detail read | `participantRepository.findById(session, …)` | `src/services/participantService.ts:74` |
| enroll | same | `participantService.ts:164` |
| complete study | same | `participantService.ts:227` |
| complete visit | same, then `visitRepository.findById(participantId, visitId)` | `src/services/visitService.ts:28,34` |
| adverse event | same | `src/services/safetyEventService.ts:30` |
| deviation | same | `safetyEventService.ts:69` |
| create participant | inline check on `input.siteId` | `participantService.ts:125-127` |

Not scoped, by design or by omission:

- `findByScreeningNumber()` and `findByStudySubjectId()` (`participantRepository.ts:20-26`) search all sites. They have to, because uniqueness is global. The problem is **ordering** in the caller, which is Finding F2.
- Protocol versions are global, and anyone with `PARTICIPANT_READ` can list them (`src/app/api/protocol-versions/route.ts:16`).
- `assertSiteAccess()` (`src/lib/http/routeContext.ts:43-50`) is exported and never called (Finding F9). Creating a participant re-implements the same condition inline at `participantService.ts:125`.

### Finding F2: existence probe through the 409/403 ordering (verified, ran)

```ts
    const existingScreeningNumber = await participantRepository.findByScreeningNumber(input.screeningNumber);

    if (existingScreeningNumber) {
      throw new AppError("This screening number already exists.", 409, {
        screeningNumber: input.screeningNumber
      });
    }

    if (!session.accessScope.canReadAllSites && !session.accessScope.siteIds.includes(input.siteId)) {
```

(`src/services/participantService.ts:117-125`.) A site-101 coordinator posting `{ screeningNumber: "SCR-202-001", siteId: "site-202", … }` gets **409**. Posting `SCR-202-999` gets **403**. The difference reveals that a site-202 record exists. That contradicts the stated intent of `findById()` returning `null` "to prevent existence leaks" (`participantRepository.ts:84-85`). The fix is to move the scope check above the uniqueness check. The 409 is still needed for in-scope callers.

## Blinding: read-masked, write-exposed

```ts
function maskTreatmentArm(session: Session, participant: Participant) {
  const canUnblind = hasPermission(session.user.role, "TREATMENT_ARM_UNBLIND");

  return {
    treatmentArm: canUnblind ? participant.actualTreatmentArm : null,
    treatmentArmVisible: canUnblind
  };
}
```

(`src/services/participantService.ts:27-34`.) It is applied in `listParticipants()` (`:53`) and `getParticipantDetail()` (`:89`, `:94`). What it does not cover:

- **Finding F10 (verified, ran).** `enrollParticipantSchema` requires `actualTreatmentArm` (`src/lib/validation/participantSchemas.ts:26`), and `PARTICIPANT_ENROLL` is granted to coordinators and PIs, neither of which can unblind. So the blinded person enrolling the participant is the one who types the arm. The check enrolled `participant-002` as the coordinator: the stored row has `"Comparator"` and the response has `null`. In a real trial the arm comes from randomization (IWRS), not from the site user.
- The values returned by `enrollParticipant`/`completeStudy` go through `getParticipantDetail` (`participantService.ts:223,257`), so they are masked. `createScreeningParticipant` returns the raw row (`:150`), but a newly screened row's arm is always `null` (`src/repositories/participantRepository.ts:56`).
- Audit metadata for enrollment records `protocolVersionId`, `versionNumber` and `studySubjectId` (`participantService.ts:216-220`), **not** the arm. That is good, because audit rows are visible to the data manager, who is blinded.

## Audit visibility

`auditTrail: hasPermission(session.user.role, "AUDIT_LOG_READ") ? auditTrail : []` (`src/services/participantService.ts:100`). The repository is still queried for every caller (`:84`), and the filtering happens afterwards. The UI shows "This session does not have audit log visibility." whenever the array is empty (`src/components/participants/ParticipantDetailView.tsx:122-123`). That message is misleading for a data manager looking at a participant with no audit rows yet, such as `participant-003`, which has none in the seed (`src/lib/mock-db/seed.ts:370-384` only has `participant-001`).

## Defense in depth: what services check themselves

Only one service method re-checks permissions: `createScreeningParticipant` calls `assertPermission(session, "PARTICIPANT_CREATE")` at `src/services/participantService.ts:115`. Every other mutation relies on the route guard alone. Today that is safe, because the only non-route caller is `src/app/page.tsx:6-7`, and it only calls `listParticipants`. Any future server action or background job that calls `protocolService.activateProtocolVersion()` directly would skip authorization entirely, because `protocolService` never checks permissions itself.

## Debugging scenarios

| Symptom | Where to look | Cause |
|---|---|---|
| Every API call succeeds even though you "logged in" as a coordinator | `src/hooks/apiClient.ts:8` | the client always sends `user-data-manager`, and a missing header also falls back to it (`session.ts:19`) |
| 401 `"Session user was not found."` | `src/lib/auth/session.ts:22-24` | typo in `x-demo-user-id`. Valid ids are at `src/lib/mock-db/seed.ts:15,22,29,36,43` |
| 404 "Participant not found." for a participant you can see in the seed | `src/repositories/participantRepository.ts:39-41` | the caller's `siteIds` exclude the participant's `siteId`. Out-of-scope reads return 404 by design |
| 403 body names a permission you expected to have | `src/lib/auth/permissions.ts:14-43` | check the matrix above. A PI cannot `PARTICIPANT_CREATE` |
| Treatment arm always "Hidden by blinding policy" | `src/components/participants/ParticipantDetailView.tsx:47` and `participantService.ts:27-34` | the default caller (data manager) lacks `TREATMENT_ARM_UNBLIND` |
| 409 on creating a participant at a site you cannot access | `participantService.ts:117-127` | Finding F2: the uniqueness check runs before the scope check |

## Exercise ladder (Goal + Check)

1. **Junior.** *Goal:* list every permission a `MEDICAL_MONITOR` has. *Check:* your list matches the matrix column (3 items), and you can point to `src/lib/auth/permissions.ts:41`.
2. **Junior.** *Goal:* predict the HTTP status when `user-pharmacist` posts to `/api/participants/participant-001/adverse-events`. *Check:* 403, raised by `assertPermission` via `withRouteGuard` (`src/lib/http/routeContext.ts:28` → `permissions.ts:50-54`) before the body is parsed (`adverse-events/route.ts:23` runs inside the handler, after the guard).
3. **Mid.** *Goal:* make a missing header return 401. *Check:* a test like scratch check C6 asserts `withRouteGuard(..., new Request(url), "PARTICIPANT_READ")` gives `status === 401`, and the three existing service tests still pass because they use `getServerDemoSession` with explicit ids.
4. **Mid.** *Goal:* fix Finding F2. *Check:* a site-101 coordinator gets 403 for both `SCR-202-001` and `SCR-202-999`, and a data manager still gets 409 for `SCR-202-001`.
5. **Senior.** *Goal:* move scope enforcement so a new repository method cannot forget it, for example by requiring a `Session` on every participant-reading repository call. *Check:* `findByScreeningNumber` and `findByStudySubjectId` are the only unscoped reads, they are named or commented as global uniqueness probes, and they are never used to build a response.
6. **Senior.** *Goal:* remove the blinded write path (Finding F10), for example by assigning the arm server-side from the randomization code. *Check:* `enrollParticipantSchema` no longer accepts `actualTreatmentArm` from coordinators, and an unblinded role can still read the arm.
