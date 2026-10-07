# Load-Bearing Files

Ranked by blast radius. Line counts come from `wc -l`. The sections added below the original list record the load-bearing *lines* inside each file, plus two files the original list omitted (`errors.ts`, `store.ts`).

| File | Lines | Exported surface | Direct importers (counted by grep) |
|---|---|---|---|
| `src/services/participantService.ts` | 259 | `participantService` (5 methods) | 4 participant route files + `src/app/page.tsx` + 2 tests |
| `src/lib/http/routeContext.ts` | 50 | `readJson`, `requireRouteContext`, `withRouteGuard`, `assertSiteAccess` | all 9 route files (`assertSiteAccess`: 0 callers) |
| `src/lib/auth/permissions.ts` | 59 | `hasPermission`, `assertPermission` | `routeContext.ts`, `participantService.ts`, 1 test |
| `src/repositories/participantRepository.ts` | 85 | 6 methods | `participantService.ts`, `visitService.ts`, `safetyEventService.ts` |
| `src/lib/domain/protocolRules.ts` | 73 | `buildVisitDates`, `buildScheduledVisits`, `assertProtocolVersionCanBeActivated` | `participantService.ts`, `protocolService.ts` |
| `src/lib/domain/stateTransitions.ts` | 46 | 3 guards | `participantService.ts`, `visitService.ts` (**not** `safetyEventService.ts`, despite its header comment at line 5) |
| `src/lib/http/errors.ts` | 21 | `AppError`, `toAppError` | 7 files under `src/` (permissions, session, routeContext, 4 services), plus 1 test |
| `src/lib/mock-db/store.ts` | 69 | `getMockDb`, `resetMockDb` | 6 repositories, plus 2 tests |

## src/services/participantService.ts
- What it does: Owns participant queries, enrollment, screening creation, blinding output shaping, and study completion.
- What calls it: `src/app/api/participants/route.ts`, `src/app/api/participants/[participantId]/route.ts`, `src/app/api/participants/[participantId]/enroll/route.ts`, `src/app/api/participants/[participantId]/complete-study/route.ts`, and `src/app/page.tsx`.
- What it calls: `src/repositories/participantRepository.ts`, `src/repositories/protocolRepository.ts`, `src/repositories/visitRepository.ts`, `src/repositories/eventRepository.ts`, `src/repositories/auditRepository.ts`, `src/lib/domain/protocolRules.ts`, `src/lib/domain/stateTransitions.ts`, and `src/services/auditService.ts`.
- What would break or become insecure if this file were wrong: Protocol version pinning could fail, blinded treatment arms could leak, incomplete studies could be closed, or cross-site `404` behavior could degrade.
- What a junior engineer would likely miswrite here: Putting repository updates directly in route handlers and duplicating transition rules.

## src/lib/http/routeContext.ts
- What it does: Standardizes session lookup, permission checks, JSON parsing, and error serialization.
- What calls it: Every route under `src/app/api`.
- What it calls: `src/lib/auth/session.ts`, `src/lib/auth/permissions.ts`, and `src/lib/http/errors.ts`.
- What would break or become insecure if this file were wrong: Endpoints would drift in how they authenticate callers and surface errors.
- What a junior engineer would likely miswrite here: Catching errors per-route and producing inconsistent HTTP behavior.

## src/lib/auth/permissions.ts
- What it does: Centralizes RBAC policy and enforces permission checks.
- What calls it: `src/lib/http/routeContext.ts` and `src/services/participantService.ts`.
- What it calls: `src/lib/http/errors.ts`.
- What would break or become insecure if this file were wrong: Roles could overreach into protocol administration, study completion, or treatment unblinding.
- What a junior engineer would likely miswrite here: Encoding role names inline instead of mapping them to permissions once.

## src/repositories/participantRepository.ts
- What it does: Provides site-scoped participant reads and writes.
- What calls it: `src/services/participantService.ts`, `src/services/visitService.ts`, and `src/services/safetyEventService.ts`.
- What it calls: `src/lib/mock-db/store.ts`.
- What would break or become insecure if this file were wrong: Cross-site participant leakage would occur even if the UI looked correct.
- What a junior engineer would likely miswrite here: Returning out-of-scope records and hoping a service or component filters them later.

## src/lib/domain/protocolRules.ts
- What it does: Generates immutable visit schedules from pinned protocol versions.
- What calls it: `src/services/participantService.ts` and `src/services/protocolService.ts`.
- What it calls: Internal date helpers only.
- What would break or become insecure if this file were wrong: Participant visit targets would drift from the version they actually consented under.
- What a junior engineer would likely miswrite here: Recalculating schedules from “current active protocol” during reads.

## src/lib/domain/stateTransitions.ts
- What it does: Defines lifecycle guard clauses for enrollment, visit completion, and study completion.
- What calls it: `src/services/participantService.ts` and `src/services/visitService.ts`.
- What it calls: Nothing external.
- What would break or become insecure if this file were wrong: Invalid participant and visit states could be accepted silently.
- What a junior engineer would likely miswrite here: Treating status as a plain string field with no transition rules.

## src/services/protocolService.ts
- What it does: Manages immutable protocol version creation and activation.
- What calls it: `src/app/api/protocol-versions/route.ts` and `src/app/api/protocol-versions/[versionId]/activate/route.ts`.
- What it calls: `src/repositories/protocolRepository.ts`, `src/lib/domain/protocolRules.ts`, and `src/services/auditService.ts`.
- What would break or become insecure if this file were wrong: Version activation could mutate or retire the wrong records and invalidate audit assumptions.
- What a junior engineer would likely miswrite here: Treating activation as a generic update rather than a domain command.

## src/services/visitService.ts
- What it does: Completes visits with parent-state checks and audit logging.
- What calls it: `src/app/api/participants/[participantId]/visits/[visitId]/complete/route.ts`.
- What it calls: `src/repositories/participantRepository.ts`, `src/repositories/visitRepository.ts`, `src/lib/domain/stateTransitions.ts`, and `src/services/auditService.ts`.
- What would break or become insecure if this file were wrong: Visits could be completed for the wrong participant, from the wrong state, or without a traceable audit event.
- What a junior engineer would likely miswrite here: Updating a visit by `visitId` alone without anchoring it to the participant context.

## src/services/safetyEventService.ts
- What it does: Writes adverse events and protocol deviations after participant lookup and scope validation.
- What calls it: `src/app/api/participants/[participantId]/adverse-events/route.ts` and `src/app/api/participants/[participantId]/deviations/route.ts`.
- What it calls: `src/repositories/participantRepository.ts`, `src/repositories/eventRepository.ts`, and `src/services/auditService.ts`.
- What would break or become insecure if this file were wrong: Safety events could be attached to the wrong participant or recorded without the metadata needed for escalation.
- What a junior engineer would likely miswrite here: Treating safety events like generic notes instead of operationally significant records.
- Verified gap (read): unlike `visitService`, it never checks participant status, so events can be written for `SCREENING` or `COMPLETED` participants. The `src/lib/domain/stateTransitions.ts:5` header says this service calls the transition module, but there is no such import (`safetyEventService.ts:11-15`).

## src/lib/http/errors.ts (added)
- What it does: defines `AppError(message, status, details?)` and `toAppError()`, which decides every non-200 HTTP status.
- What calls it: the 7 `src/` files listed in the table above, and `tests/services/permission-enforcement.test.ts`.
- What would break if this file were wrong: every status code in the API. Today it maps all plain `Error`s, including `TypeError`s and domain-rule violations, to 400 (`errors.ts:16-17`). Finding F3 was verified by running.
- What a junior would likely miswrite here: using TypeScript parameter properties (`public readonly status` at `errors.ts:4`). That works under `tsc`/Next, but it is exactly what makes the repo's own `node --experimental-strip-types` test command fail (verified, ran).

## src/lib/mock-db/store.ts (added)
- What it does: holds all runtime state (`store.ts:44-52`) and resets it (`:58-66`).
- What calls it: all 6 repositories and the 2 service tests that write.
- What would break if this file were wrong: every read and every test's isolation. A missing field in `resetMockDb` would leak state between tests.
- What a junior would likely miswrite here: returning a fresh clone from `getMockDb()`. Writes would then be lost, because repositories mutate the returned object.

## Load-bearing lines (the ones to protect in review)

| Line(s) | Why it matters | If it regressed |
|---|---|---|
| `src/lib/http/routeContext.ts:28` | permission check happens before the handler runs | unauthorized mutations |
| `src/lib/auth/session.ts:19` | identity source plus a fail-open default | everyone becomes the data manager (already true for header-less calls, Finding F1) |
| `src/lib/auth/session.ts:30` | `canReadAllSites` from role | cross-site data exposure |
| `src/repositories/participantRepository.ts:39-41` | out-of-scope becomes `null` | cross-site reads; the 404-hiding disappears |
| `src/services/participantService.ts:28-33` | the arm is masked unless `TREATMENT_ARM_UNBLIND` | unblinding of site staff |
| `src/services/participantService.ts:94` | the override comes after the spread | the real arm leaks in detail responses |
| `src/services/participantService.ts:100` | audit gate | audit visible to all roles |
| `src/services/participantService.ts:191` | protocol pin | participants drift across versions |
| `src/lib/domain/protocolRules.ts:24-25` | windows computed from the target date | every visit window shifts |
| `src/lib/domain/stateTransitions.ts:38` | completion requires all visits | premature closeout (or permanent block, Finding F7) |
| `src/repositories/protocolRepository.ts:55-57` | sibling-only retirement | one study's activation retires another study's version |
| `src/repositories/visitRepository.ts:26` | visit lookup anchored to the participant | completing another participant's visit through your own URL |

## Debugging with this list

- **"Coordinator can see the arm."** Start at `participantService.ts:27-34`, then check whether the new code path skipped `maskTreatmentArm`. `createScreeningParticipant` returns the raw row (`:150`), which is harmless only because the arm is `null` at screening.
- **"Data manager can't see site-202 participants."** Check `GLOBAL_ACCESS_ROLES` (`session.ts:16`) before `siteIds`. The role, not the list, grants global reads.
- **"Activation retired the wrong version."** Check `protocolRepository.ts:55` (`protocolCode` comparison). Case matters: `protocolCode` is compared exactly, while ids are lower-cased only when generated (`:35`).

## Exercise (Goal + Check)

- **Goal (mid):** for each row of the load-bearing-lines table, name the test in `tests/` that would fail if the line regressed. **Check:** only 3 rows have coverage: `routeContext.ts:28` (partly: `permission-enforcement.test.ts` calls `assertPermission` directly, not through the guard), `participantRepository.ts:39-41` (`site-scoping.test.ts`) and `stateTransitions.ts:38` (`participant-transitions.test.ts`). Every other row is untested. Your write-up should list them as the test backlog.
