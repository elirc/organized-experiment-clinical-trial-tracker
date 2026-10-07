# Guided Reading Path

> **Expansion capped at ~3x.** This doc set grew from ~5,700 to roughly 17,000 words, not the 5-7x a thin guide might get. The codebase is 62 non-doc tracked files (3,069 lines across `src/`, `tests/`, the Prisma schema and `package.json`), and the logic lives in about 34 server-side files. Past this point the docs would be re-quoting the same code, so they stop. Everything added is grounded: file:line references were checked, quoted code is copied exactly, and claims marked *(ran)* were executed with `node --test` on Node 22.16 against a scratch copy (see [testing-rationale.md](testing-rationale.md)).

## Before you start: two facts that change how you read everything

1. **There is no database.** Every repository reads `getMockDb()` (`src/lib/mock-db/store.ts:54-56`). `prisma/schema.prisma` is a design document. When a step below says "persisted", it means "pushed onto an array in memory".
2. **The tests do not run as declared.** `package.json:10` fails on Node 22.16 for three reasons (alias, parameter properties, value-imports of types). See [testing-rationale.md](testing-rationale.md). Plan to read the tests, not run them, unless you reproduce the scratch-copy method.

## Exact lines for each step (for a ~2-hour first pass)

| Step | File | Read these lines | Approx. minutes |
|---|---|---|---|
| 1 | `src/types/domain.ts` | `11-49` (unions + `VisitTemplate`), `64-99`, `146-174` | 10 |
| 2 | `prisma/schema.prisma` | `72-139` | 10 |
| 3 | `src/lib/auth/permissions.ts` | `14-59` (whole file body) | 5 |
| 4 | `src/lib/auth/session.ts` | `15-49` | 5 |
| 5 | `src/lib/http/routeContext.ts` + `src/lib/http/errors.ts` | `16-50` + `1-21` | 10 |
| 6 | `src/lib/validation/participantSchemas.ts` | `13-31` | 5 |
| 7 | `src/lib/domain/protocolRules.ts` | `13-73` | 10 |
| 8 | `src/lib/domain/stateTransitions.ts` | `13-46` | 5 |
| 9 | `src/repositories/participantRepository.ts` | `15-81` | 10 |
| 10 | `src/services/participantService.ts` | `27-34`, then `153-224`, then the rest | 25 |
| 11 | `src/services/visitService.ts` | `19-69` | 5 |
| 12 | `src/services/protocolService.ts` + `src/repositories/protocolRepository.ts` | `22-92` + `46-79` | 10 |
| 13 | `src/app/api/participants/[participantId]/enroll/route.ts` | `15-29` | 2 |
| 14 | `src/hooks/useParticipantDetail.ts` + `src/hooks/apiClient.ts` | `7-33` + `1-19` | 5 |
| 15 | `src/components/participants/ParticipantDetailView.tsx` | `6-75` | 5 |

## Step 1 — src/types/domain.ts
**Why read this:** This is the shared vocabulary of the codebase.
**What to look for:** The difference between durable entities like `Participant` and UI-facing shapes like `ParticipantSummary` and `ParticipantDetail`.
**What to trace:** This file is referenced by `src/services/participantService.ts`, `src/repositories/participantRepository.ts`, `src/hooks/useParticipants.ts`, and `src/components/participants/ParticipantDetailView.tsx`.
**What a junior would likely miss:** Blurring domain entities and UI DTOs makes it harder to preserve backend boundaries later.

## Step 2 — prisma/schema.prisma
**Why read this:** It shows the intended production persistence model, even though the learning build uses mock repositories.
**What to look for:** `Participant.pinnedProtocolVersionId`, `ProtocolVersion.visitTemplates`, and the audit relationships.
**What to trace:** Compare the models here with `src/lib/mock-db/seed.ts` and the repository functions under `src/repositories`.
**What a junior would likely miss:** Protocol rules belong on versioned records, not duplicated onto each participant row.

## Step 3 — src/lib/auth/permissions.ts
**Why read this:** This is the centralized RBAC policy.
**What to look for:** The `rolePermissions` map and `assertPermission()`.
**What to trace:** `src/lib/http/routeContext.ts` calls this file before `src/services/protocolService.ts` or `src/services/participantService.ts`.
**What a junior would likely miss:** Direct role checks in route handlers seem harmless until they diverge from the central policy.

## Step 4 — src/lib/auth/session.ts
**Why read this:** It shows how the request becomes a scoped caller.
**What to look for:** `getSessionFromRequest()` and how `accessScope` is computed.
**What to trace:** Called by `src/lib/http/routeContext.ts`; its output is consumed by `src/repositories/participantRepository.ts`.
**What a junior would likely miss:** Authentication and data scope are related but not identical, and both need to be part of the session contract.

## Step 5 — src/lib/http/routeContext.ts
**Why read this:** This is the thin HTTP boundary that keeps route files consistent.
**What to look for:** `withRouteGuard()` and the order of session resolution, permission checking, and error serialization.
**What to trace:** Called by every route in `src/app/api/**`; it calls `src/lib/auth/session.ts` and `src/lib/auth/permissions.ts`.
**What a junior would likely miss:** Consistency in failure handling is part of the API design, not just a convenience helper.

## Step 6 — src/lib/validation/participantSchemas.ts
**Why read this:** It is the most important write-side validation boundary.
**What to look for:** The schemas for creation, enrollment, and study completion.
**What to trace:** Used by `src/app/api/participants/route.ts`, `src/app/api/participants/[participantId]/enroll/route.ts`, and `src/app/api/participants/[participantId]/complete-study/route.ts`.
**What a junior would likely miss:** Validation should reject bad commands before service logic starts doing cross-entity work.

## Step 7 — src/lib/domain/protocolRules.ts
**Why read this:** This file owns the core protocol scheduling rule.
**What to look for:** `buildScheduledVisits()` and how it derives windows from `enrollmentDate`.
**What to trace:** Called by `src/services/participantService.ts`; compare its outputs with seeded visits in `src/lib/mock-db/seed.ts`.
**What a junior would likely miss:** Schedule generation should happen from enrollment data, not from “current active version” reads on every request.

## Step 8 — src/lib/domain/stateTransitions.ts
**Why read this:** It isolates lifecycle rules from HTTP and UI code.
**What to look for:** `assertParticipantCanEnroll()`, `assertVisitCanBeCompleted()`, and `assertParticipantCanCompleteStudy()`.
**What to trace:** Called by `src/services/participantService.ts` and `src/services/visitService.ts`.
**What a junior would likely miss:** Transition checks are easier to reason about when they are pure functions with narrow inputs.

## Step 9 — src/repositories/participantRepository.ts
**Why read this:** It demonstrates explicit data scoping in the persistence layer.
**What to look for:** `list()`, `findById()`, and the `canAccessSite()` helper.
**What to trace:** Called by `src/services/participantService.ts`, `src/services/visitService.ts`, and `src/services/safetyEventService.ts`; it calls `src/lib/mock-db/store.ts`.
**What a junior would likely miss:** Site filtering belongs here too, not just in frontend list views.

## Step 10 — src/services/participantService.ts
**Why read this:** This is the load-bearing service layer.
**What to look for:** `listParticipants()`, `getParticipantDetail()`, `createScreeningParticipant()`, `enrollParticipant()`, and `completeStudy()`.
**What to trace:** Called by participant route handlers and `src/app/page.tsx`; it calls repositories, `src/lib/domain/protocolRules.ts`, `src/lib/domain/stateTransitions.ts`, and `src/services/auditService.ts`.
**What a junior would likely miss:** Query shaping, state transitions, and audit emission are related but should still be separable inside one service.

## Step 11 — src/services/visitService.ts
**Why read this:** It is a clean example of a focused command service.
**What to look for:** `completeVisit()` and the way it validates both the parent participant and child visit.
**What to trace:** Called by `src/app/api/participants/[participantId]/visits/[visitId]/complete/route.ts`; it calls `src/repositories/participantRepository.ts`, `src/repositories/visitRepository.ts`, and `src/services/auditService.ts`.
**What a junior would likely miss:** Child record transitions often need parent-state awareness.

## Step 12 — src/services/protocolService.ts
**Why read this:** It shows immutable version management and activation behavior.
**What to look for:** `createProtocolVersion()` versus `activateProtocolVersion()`.
**What to trace:** Called by `src/app/api/protocol-versions/route.ts` and `src/app/api/protocol-versions/[versionId]/activate/route.ts`; it calls `src/repositories/protocolRepository.ts` and `src/services/auditService.ts`.
**What a junior would likely miss:** Version creation and activation are different commands and should stay different.

## Step 13 — src/app/api/participants/[participantId]/enroll/route.ts
**Why read this:** It shows the intended shape of a thin route handler.
**What to look for:** Validation at the boundary and delegation to a service.
**What to trace:** Calls `src/lib/http/routeContext.ts`, `src/lib/validation/participantSchemas.ts`, and `src/services/participantService.ts`.
**What a junior would likely miss:** A good route handler is boring on purpose.

## Step 14 — src/hooks/useParticipantDetail.ts
**Why read this:** It shows how the frontend stays thin while still handling mutations and cache invalidation.
**What to look for:** The `completeVisit` mutation and query invalidation.
**What to trace:** Called by `src/components/participants/ParticipantDetailView.tsx`; it calls `/api/participants/[participantId]` and `/api/participants/[participantId]/visits/[visitId]/complete`.
**What a junior would likely miss:** Cache invalidation is part of correctness, not only a UX detail.

## Step 15 — src/components/participants/ParticipantDetailView.tsx
**Why read this:** It demonstrates the desired frontend boundary for a CRUD screen in this project.
**What to look for:** It renders data and triggers mutations, but it does not own lifecycle rules.
**What to trace:** Called by `src/app/participants/[participantId]/page.tsx`; it calls `src/hooks/useParticipantDetail.ts`.
**What a junior would likely miss:** React components should not become hidden service layers.
**What a senior would notice (verified by reading):** the component chooses which visit to complete with `data.visits.find(...)` in array order (`ParticipantDetailView.tsx:17`), while the server picks "next visit" by sorting on `targetDate` (`src/services/participantService.ts:50-52`). That is a small piece of domain logic that leaked into the UI. The component also never renders `completeVisit.error`, so a 400 from the guard is invisible.

## Step 16 (optional) — src/lib/mock-db/store.ts and seed.ts
**Why read this:** It is the whole "database". Its behaviour explains test isolation and restart semantics.
**What to look for:** `clone()` (`store.ts:30-32`), `resetMockDb()` (`store.ts:58-66`), and the deliberate v1/v2 split in `seed.ts:51-142`.
**What to trace:** `resetMockDb()` is called in `beforeEach` by two of the three service tests (`tests/services/participant-transitions.test.ts:7-9`, `tests/services/site-scoping.test.ts:7-9`).
**What a junior would likely miss:** `activate()` replaces the `protocolVersions` array (`src/repositories/protocolRepository.ts:54`), while other writes `push`. Both work only because every repository calls `getMockDb()` fresh on each access.

---

## Goal + Check ladder (junior → senior)

Work top to bottom. Each rung has a goal and a check you can verify yourself. Rungs marked *(ran)* were executed for this guide against the scratch copy, so you know the expected answer is real.

### Rung 1 — Junior: vocabulary and map
- **Goal:** list the 5 roles, 10 permissions, 5 participant statuses, 4 visit statuses and 3 protocol statuses from `src/types/domain.ts:11-38`.
  **Check:** 5 / 10 / 5 / 4 / 3. Then mark which statuses are reachable in code: 3 participant (`SCREENING`, `ENROLLED`, `COMPLETED`), 2 visit, 3 protocol.
- **Goal:** for each of the 9 route files, name the permission it guards with.
  **Check:** compare with the HTTP table in [docs/architecture/README.md](../architecture/README.md). `GET /api/protocol-versions` uses `PARTICIPANT_READ`, which is the one that surprises people.

### Rung 2 — Junior+: run pure logic yourself
- **Goal:** copy `addDays`/`buildVisitDates` (`src/lib/domain/protocolRules.ts:13-27`) into a scratch `.ts` file, replacing the `VisitTemplate` import with an inline type, and test it with `node --experimental-strip-types --test`.
  **Check (ran):** for `participant-003` (enrolled `2026-03-05T08:30:00.000Z`), WEEK2 (`dayOffset 14`, `-2/+3`) gives target `2026-03-19T08:30:00.000Z`, window `2026-03-17T08:30` to `2026-03-22T08:30`, which equals `seed.ts:294-296`.
- **Goal:** test `assertParticipantCanEnroll` (`src/lib/domain/stateTransitions.ts:13-21`) with seeded objects.
  **Check (ran):** `participant-001` + v2 throws "Only screening…", `participant-002` + v1 throws "…active protocol version.", and `participant-002` + v2 passes.

### Rung 3 — Mid: trace and predict HTTP behaviour
- **Goal:** predict the status code for: (a) no header, `POST /api/protocol-versions/protocol-acme-1-v2/activate` with `{ "activatedAt": "2026-04-11T00:00:00.000Z" }`; (b) the same with `/activate` on `"nope"`.
  **Check:** (a) 200, because a missing header means data manager (Finding F1). (b) 400 `"Protocol version not found."`, not 404 (Finding F3). *What ran:* `withRouteGuard` with a header-less `Request` and `PROTOCOL_VERSION_MANAGE` returned 200 (check C6), and `withRouteGuard` around `protocolService.activateProtocolVersion(…, "missing-id")` returned that exact 400 body (check C7). The route's Zod parse of `activatedAt` was not run (needs deps).
- **Goal:** explain why `tests/services/site-scoping.test.ts` expects the message "Participant not found." rather than a 403.
  **Check:** you cite the double `return null` in `participantRepository.findById` (`:35-41`) and the 404 at `participantService.ts:76-78`.

### Rung 4 — Mid+: find a real bug by reading
- **Goal:** find a way for a site-101 coordinator to learn whether a site-202 screening number exists.
  **Check (ran):** you point to `participantService.ts:117-127` (409 before 403). Scratch check C8 reproduces it.
- **Goal:** find why a protocol version could make study completion impossible.
  **Check (ran):** duplicate `visitCode`s give duplicate visit ids (`protocolRules.ts:39`), and `visitRepository.update` hits only the first (`visitRepository.ts:32`). Scratch check C12 reproduces it.

### Rung 5 — Senior: concurrency, contracts and migration
- **Goal:** show that enrollment is not atomic.
  **Check (ran):** two concurrent `enrollParticipant` calls for `participant-002` both fulfil, leaving 8 visit rows (scratch check C10, Finding F4).
- **Goal:** propose the error taxonomy fix for `toAppError` (`src/lib/http/errors.ts:11-21`) without breaking the existing tests.
  **Check:** `tests/services/permission-enforcement.test.ts` still asserts `status === 403`. The two service tests match on message regexes, so they keep passing as long as messages are unchanged.
- **Goal:** write a one-page plan to make blinding hold on the write path too (Finding F10).
  **Check:** the plan says who supplies `actualTreatmentArm`, and which permission allows writing it.

### Capstone
Pick two findings from the table in [docs/architecture/README.md](../architecture/README.md). For each, write the failing test first (pure `node --test` where possible), then the fix, then explain why your test would have caught a regression. If your test needs `zod`, `next` or React, say so explicitly. Do not claim it passed.
