# Architecture Overview

> **Scope and expansion cap.** This guide set was refined and expanded from ~5,700 words to roughly 3x that size, and the cap is deliberate: the repo tracks 62 non-doc files (49 `.ts`/`.tsx` files under `src/`, 4 test files, plus config); `src/`, `tests/`, `prisma/schema.prisma` and `package.json` together are 3,069 lines (counted with `wc -l`), including a 384-line seed file and the 185-line Prisma schema. The server-side logic lives in 34 files: 25 under `src/lib`, `src/repositories`, `src/services` and `src/types`, plus 9 route handlers. Every file:line reference in `docs/` was checked against the current tree; every claim marked **verified (ran)** was executed with Node 22.16 against a scratch copy of the code (method in [testing-rationale.md](../learning/testing-rationale.md)). Further expansion would have meant restating the same ~1,000 lines of service/repository code, so it stops here.

This project is a Next.js + TypeScript clinical trial participant tracking system with a backend-centered design. The key domain rules are: participants move through screening, enrollment, visits, deviations, adverse events, and study completion; protocol versions are treated as append-only by convention (the schema only enforces `@@unique([protocolCode, versionNumber])` at [prisma/schema.prisma:88](../../prisma/schema.prisma), and there is no update endpoint, but activation does rewrite `status`/`updatedAt` in `protocolRepository.activate()` at `src/repositories/protocolRepository.ts:46-79`); and visit schedules are generated from `enrolledAt` in [src/lib/domain/protocolRules.ts](../../src/lib/domain/protocolRules.ts), not from the current calendar or active protocol version.

The top-level folders map to explicit layers:

- `src/app`: Next.js pages and REST route handlers. For example, [src/app/api/participants/route.ts](../../src/app/api/participants/route.ts) is the HTTP entry point for listing and creating participants, while [src/app/participants/[participantId]/page.tsx](../../src/app/participants/[participantId]/page.tsx) renders the participant detail screen.
- `src/services`: Business logic and lifecycle orchestration. [src/services/participantService.ts](../../src/services/participantService.ts) owns enrollment and study completion, [src/services/visitService.ts](../../src/services/visitService.ts) owns visit completion, and [src/services/protocolService.ts](../../src/services/protocolService.ts) owns version creation and activation.
- `src/repositories`: Persistence seams. [src/repositories/participantRepository.ts](../../src/repositories/participantRepository.ts) scopes reads by site access, [src/repositories/protocolRepository.ts](../../src/repositories/protocolRepository.ts) handles active-version activation/retirement, and [src/repositories/auditRepository.ts](../../src/repositories/auditRepository.ts) appends immutable audit events.
- `src/lib`: Cross-cutting infrastructure and domain rules. Auth lives in [src/lib/auth/session.ts](../../src/lib/auth/session.ts) and [src/lib/auth/permissions.ts](../../src/lib/auth/permissions.ts), request guards live in [src/lib/http/routeContext.ts](../../src/lib/http/routeContext.ts), lifecycle rules live in [src/lib/domain/stateTransitions.ts](../../src/lib/domain/stateTransitions.ts), and Zod schemas live under [src/lib/validation](../../src/lib/validation).
- `src/hooks` and `src/components`: Thin frontend integration. [src/hooks/useParticipants.ts](../../src/hooks/useParticipants.ts) and [src/hooks/useParticipantDetail.ts](../../src/hooks/useParticipantDetail.ts) call the REST API, while [src/components/dashboard/ParticipantDashboard.tsx](../../src/components/dashboard/ParticipantDashboard.tsx) and [src/components/participants/ParticipantDetailView.tsx](../../src/components/participants/ParticipantDetailView.tsx) render results without owning domain rules.
- `prisma`: Canonical schema design. Even though this learning build uses mock-backed repositories from [src/lib/mock-db/store.ts](../../src/lib/mock-db/store.ts), the intended relational model is fully described in [prisma/schema.prisma](../../prisma/schema.prisma).
- `tests`: Focused architecture tests. The most important behaviors are covered in [tests/services/permission-enforcement.test.ts](../../tests/services/permission-enforcement.test.ts), [tests/validation/participantSchemas.test.ts](../../tests/validation/participantSchemas.test.ts), [tests/services/participant-transitions.test.ts](../../tests/services/participant-transitions.test.ts), and [tests/services/site-scoping.test.ts](../../tests/services/site-scoping.test.ts).

The stack choice is intentional:

- `Next.js + React` for a realistic internal CRUD product shell.
- `TypeScript` for shared contracts in [src/types/domain.ts](../../src/types/domain.ts).
- `PostgreSQL + Prisma` as the production persistence target because the model is relational and transaction-heavy.
- `Zod` for explicit validation in [src/lib/validation/participantSchemas.ts](../../src/lib/validation/participantSchemas.ts), [src/lib/validation/protocolSchemas.ts](../../src/lib/validation/protocolSchemas.ts), [src/lib/validation/visitSchemas.ts](../../src/lib/validation/visitSchemas.ts), and [src/lib/validation/eventSchemas.ts](../../src/lib/validation/eventSchemas.ts).
- `React Query` for thin data hooks in [src/hooks/useParticipants.ts](../../src/hooks/useParticipants.ts) and [src/hooks/useParticipantDetail.ts](../../src/hooks/useParticipantDetail.ts).
- `REST` instead of tRPC because route handlers, validation boundaries, permission guards, and service seams are easier to trace explicitly for learning in [docs/architecture/request-lifecycle.md](../../docs/architecture/request-lifecycle.md).

Multi-tenancy is intentionally not included. The product reads as a single sponsor-operated system, so the code uses site-level scoping instead: session scope is computed in [src/lib/auth/session.ts](../../src/lib/auth/session.ts) and enforced in [src/repositories/participantRepository.ts](../../src/repositories/participantRepository.ts). The changes needed to add true tenant isolation are documented in [docs/architecture/auth-and-permissions.md](../../docs/architecture/auth-and-permissions.md).

## What actually persists data (read this before anything else)

Nothing in `src/` imports `@prisma/client`. A case-insensitive `grep -rni prisma src` only finds prose on the home page (`src/app/page.tsx:22`, `:24`, `:44`). All six repositories read and write one module-level object in `src/lib/mock-db/store.ts`:

```ts
const state: MockDbState = {
  users: clone(demoUsers),
  protocolVersions: clone(protocolVersionsSeed),
  participants: clone(participantsSeed),
  visits: clone(visitsSeed),
  adverseEvents: clone(adverseEventsSeed),
  deviations: clone(deviationsSeed),
  auditLogs: clone(auditLogsSeed)
};
```

(`src/lib/mock-db/store.ts:44-52`.) `clone()` is a JSON round-trip (`store.ts:30-32`), and `resetMockDb()` (`store.ts:58-66`) puts the seed back. Three things follow from this:

1. Every write disappears when the Node process restarts. The schema in `prisma/schema.prisma` is a design document, not something the code runs against.
2. Database constraints in the schema are **not** enforced at runtime. For example, `StudyVisit` has `@@unique([participantId, visitCode])` (`prisma/schema.prisma:137`), but the mock `visitRepository.createMany()` (`src/repositories/visitRepository.ts:19-22`) just pushes rows. Finding F6 below shows what that allows.
3. There are no transactions. Enrollment does three separate writes (participant update, visit inserts, audit insert). Finding F4 shows two concurrent enrollments both succeeding.

## Layer inventory (line counts from `wc -l`)

| Layer | Files | Lines | Notes |
|---|---|---|---|
| Route handlers | 9 files under `src/app/api/**/route.ts` | 25-29 each | 11 exported handlers: `GET`+`POST` on `/api/participants` and `/api/protocol-versions`, and one handler on each of the other 7 route files |
| Guard and errors | `src/lib/http/routeContext.ts`, `src/lib/http/errors.ts` | 50, 21 | `withRouteGuard()` at `routeContext.ts:26-41` is the only place HTTP status codes are produced |
| Auth | `src/lib/auth/session.ts`, `src/lib/auth/permissions.ts` | 52, 59 | header-based demo identity plus a static role-to-permission map |
| Validation | 4 Zod files under `src/lib/validation/` | 19-35 | only used in route handlers. Services trust their typed inputs |
| Domain rules | `src/lib/domain/protocolRules.ts`, `src/lib/domain/stateTransitions.ts` | 73, 46 | pure functions; the easiest code to test |
| Services | 5 files under `src/services/` | 30-259 | `participantService.ts` (259 lines) is the hub |
| Repositories | 6 files under `src/repositories/` | 20-85 | all backed by `getMockDb()` |
| Mock DB | `store.ts`, `seed.ts`, `ids.ts` | 69, 384, 3 | `nextId()` = prefix + 8 random base-36 characters |
| UI | 3 pages + `layout.tsx`, 7 components, 3 hooks + `src/hooks/apiClient.ts` | 5-140 | only one mutation exists in the UI: `completeVisit` in `src/hooks/useParticipantDetail.ts:14-27` |

## HTTP surface

| Method and path | Route file:line of guard | Permission | Service call |
|---|---|---|---|
| `GET /api/participants` | `src/app/api/participants/route.ts:16` | `PARTICIPANT_READ` | `participantService.listParticipants` |
| `POST /api/participants` | `src/app/api/participants/route.ts:26` | `PARTICIPANT_CREATE` | `participantService.createScreeningParticipant` |
| `GET /api/participants/:id` | `src/app/api/participants/[participantId]/route.ts:23` | `PARTICIPANT_READ` | `participantService.getParticipantDetail` |
| `POST .../enroll` | `.../enroll/route.ts:27` | `PARTICIPANT_ENROLL` | `participantService.enrollParticipant` |
| `POST .../complete-study` | `.../complete-study/route.ts:27` | `STUDY_COMPLETE` | `participantService.completeStudy` |
| `POST .../adverse-events` | `.../adverse-events/route.ts:27` | `ADVERSE_EVENT_CREATE` | `safetyEventService.recordAdverseEvent` |
| `POST .../deviations` | `.../deviations/route.ts:27` | `DEVIATION_CREATE` | `safetyEventService.recordDeviation` |
| `POST .../visits/:visitId/complete` | `.../visits/[visitId]/complete/route.ts:27` | `VISIT_COMPLETE` | `visitService.completeVisit` |
| `GET /api/protocol-versions` | `src/app/api/protocol-versions/route.ts:16` | `PARTICIPANT_READ` | `protocolService.listProtocolVersions` |
| `POST /api/protocol-versions` | `src/app/api/protocol-versions/route.ts:26` | `PROTOCOL_VERSION_MANAGE` | `protocolService.createProtocolVersion` |
| `POST /api/protocol-versions/:id/activate` | `.../[versionId]/activate/route.ts:27` | `PROTOCOL_VERSION_MANAGE` | `protocolService.activateProtocolVersion` |

There is no endpoint for withdrawing a participant, marking a screen failure, or marking a visit missed or cancelled. Those statuses exist only as type members (`src/types/domain.ts:33,35,38`) and Prisma enums, and `grep` finds no code that assigns them.

## Can you run it?

- **The app:** not without `npm install` (Next 15, React 19, Zod, React Query, clsx are all runtime imports). No `node_modules` exists in this checkout.
- **The tests:** `package.json:10` declares `node --test --experimental-strip-types tests/**/*.test.ts`. **Verified (ran) on Node 22.16:** this cannot pass as written, even with dependencies installed, for three independent reasons:
  1. Every test imports through the `@/` alias (`tests/services/permission-enforcement.test.ts:3-5`), and Node does not read `tsconfig.json` `paths`. The run fails with `ERR_MODULE_NOT_FOUND: Cannot find package '@/lib'`.
  2. `AppError` uses TypeScript parameter properties (`src/lib/http/errors.ts:4-5`, `public readonly status: number`). Node's strip-only mode rejects that with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`.
  3. Type-only names are imported as values (for example `import { Permission, Role, Session } from "@/types/domain"` at `src/lib/auth/permissions.ts:11`). Under strip-types, ESM then fails with `does not provide an export named ...`. This was reproduced with a two-file scratch case.
- After mechanically fixing those three issues in a **scratch copy** (never in the repo), the 3 service tests pass (3/3) and 15 additional checks written for this guide pass (15/15). The fourth repo test (`tests/validation/participantSchemas.test.ts`) imports `zod` and was **not run: needs deps**. Details and the exact transform are in [testing-rationale.md](../learning/testing-rationale.md).

## Verified findings (senior review)

Each finding below states how it was verified. "Ran" means a `node --test` check executed against the scratch copy. "Read" means confirmed by reading the cited lines.

| # | Finding | Evidence | How verified |
|---|---|---|---|
| F1 | A missing `x-demo-user-id` header silently authenticates the caller as the most privileged role, `DATA_MANAGER` (fail-open default) | `src/lib/auth/session.ts:15,19` | ran: a bare `Request` passes the `PROTOCOL_VERSION_MANAGE` guard with 200; an unknown id gets 401 |
| F2 | Creating a participant checks screening-number uniqueness (409) **before** site scope (403), so a site-101 coordinator can probe whether a site-202 screening number exists | `src/services/participantService.ts:117-127` | ran: `SCR-202-001` gives 409, `SCR-202-999` gives 403 |
| F3 | `toAppError()` turns every plain `Error` into HTTP 400, so "Protocol version not found." thrown by `protocolRules.ts:62` becomes a 400 rather than a 404, and every transition-rule violation is a 400 rather than a 409/422 | `src/lib/http/errors.ts:16-17` | ran: activate on a missing id returns `400 {"error":"Protocol version not found.","details":null}` |
| F4 | Two concurrent enrollments of the same participant both succeed and create 8 visit rows instead of 4 (check-then-act across `await`s, no transaction or lock) | `src/services/participantService.ts:164-209` | ran: `Promise.allSettled` gives fulfilled=2, visits=8 |
| F5 | Visit completion never compares `completedAt` with `windowStart`/`windowEnd`, and no deviation is created automatically for an out-of-window visit | `src/services/visitService.ts:40-48`, `src/lib/domain/stateTransitions.ts:23-31` | ran: completing WEEK8 (window ends 2026-03-17) on 2026-04-11 is accepted |
| F6 | Duplicate `visitCode`s inside one protocol version are not rejected (neither Zod nor service), which produces duplicate visit ids; the second visit can never be completed, so the participant can never complete the study | `src/lib/validation/protocolSchemas.ts:27`, `src/lib/domain/protocolRules.ts:39`, `src/repositories/visitRepository.ts:32` | ran: statuses end as `["COMPLETED","SCHEDULED"]` and `completeStudy` rejects |
| F7 | `assertParticipantCanCompleteStudy` requires **every** visit to be `COMPLETED`. It ignores the template `required` flag (despite the variable name `incompleteRequiredVisits`), so one `MISSED`/`CANCELLED` visit would block closeout forever (today nothing can set those statuses) | `src/lib/domain/stateTransitions.ts:38` | ran (pure function with a CANCELLED visit) + read |
| F8 | The activate route requires `{ activatedAt }` in the body and then discards it; the audit row uses server time | `src/app/api/protocol-versions/[versionId]/activate/route.ts:23`, `src/services/auditService.ts:24` | read (Zod not run: needs deps) |
| F9 | Dead helpers: `assertSiteAccess()` (`src/lib/http/routeContext.ts:43-50`) and `protocolRepository.findActiveVersion()` (`src/repositories/protocolRepository.ts:24-30`) have no callers | grep | read |
| F10 | Blinding is enforced on read only: a `STUDY_COORDINATOR` (no `TREATMENT_ARM_UNBLIND`) must **submit** `actualTreatmentArm` to enroll, then gets it masked in the response | `src/lib/validation/participantSchemas.ts:26`, `src/services/participantService.ts:193` | ran: stored arm is `"Comparator"`, response arm is `null` |
| F11 | Source header in `src/lib/domain/stateTransitions.ts:5` says `safetyEventService.ts` calls it; it does not (no import), so adverse events and deviations can be recorded for participants in any status | `src/services/safetyEventService.ts:11-15` | read |
| F12 | `ProtocolVersionList` hard-codes "`ACME-1 v2` is active" in its copy, which goes stale as soon as someone activates v3 | `src/components/protocols/ProtocolVersionList.tsx:25-26` | read |

Treat these findings as the curriculum's "senior" rung. The exercise ladders in [guided-reading-path.md](../learning/guided-reading-path.md) build up to them.

## Where to go next

- New to the repo: [docs/learning/guided-reading-path.md](../learning/guided-reading-path.md) (reading order plus a Goal/Check ladder).
- Tracing a bug: [request-lifecycle.md](request-lifecycle.md) for HTTP status origins, and [flow-traces.md](../learning/flow-traces.md) for end-to-end traces with line numbers.
- Changing auth: [auth-and-permissions.md](auth-and-permissions.md).
- Changing data shape: [domain-model.md](domain-model.md), which lists where the mock and the Prisma schema disagree.
