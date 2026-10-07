# Request Lifecycle

> **Correction note (verification pass).** Earlier versions of the enroll and complete-visit traces below put the Zod parse *before* the permission guard, and the visit `update()` *before* the transition check. The code does the opposite: every mutating route calls `withRouteGuard(handler, request, permission)`, and the guard resolves the session and checks the permission (`src/lib/http/routeContext.ts:28`) **before** invoking the handler, where the parse lives (for example `src/app/api/participants/[participantId]/enroll/route.ts:21-27`). Likewise `assertVisitCanBeCompleted()` (`src/services/visitService.ts:40`) runs before `visitRepository.update()` (`:42`). The traces have been corrected in place.

## The one function every request goes through

```ts
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
```

(`src/lib/http/routeContext.ts:26-41`.) The order is fixed:

1. `params` are awaited in the route **before** the guard (for example `enroll/route.ts:19`). A bad path id never fails here; it fails later as a 404.
2. Identity: `getSessionFromRequest` (`src/lib/auth/session.ts:18-33`). This can produce a 401.
3. Authorization: `assertPermission` (`src/lib/auth/permissions.ts:49-59`). This can produce a 403.
4. Body: `readJson` (`routeContext.ts:16-18`), a bare `request.json()` cast to `T`. Invalid JSON throws a `SyntaxError`.
5. Validation: `schema.parse(...)` throws a `ZodError`.
6. Service: throws `AppError` (status chosen) or a plain `Error` (from the domain guards).
7. Success: always `200` via `Response.json(result)`. There is no 201 for creates and no 204 anywhere.

## Where each HTTP status comes from

`toAppError` decides every non-200 status:

```ts
export function toAppError(error: unknown) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, 400);
  }

  return new AppError("Unexpected error.", 500);
}
```

(`src/lib/http/errors.ts:11-21`.)

| Status | Raised by | Example message |
|---|---|---|
| 200 | `routeContext.ts:31` | any success, including creates |
| 400 | any plain `Error`: domain guards in `stateTransitions.ts` and `protocolRules.ts`, `SyntaxError` from `request.json()`, `ZodError` from `.parse()` | "Only screening participants can be enrolled." |
| 400 (!) | `protocolRules.ts:62` throws a plain `Error` | "Protocol version not found." (**verified (ran)**: activating a missing id gives `400 {"error":"Protocol version not found.","details":null}`) |
| 401 | `session.ts:23` | "Session user was not found." |
| 403 | `permissions.ts:51`, `participantService.ts:126` | "Role STUDY_COORDINATOR cannot perform PROTOCOL_VERSION_MANAGE." |
| 404 | `AppError(…, 404)` in services, for example `participantService.ts:77`, `visitService.ts:37` | "Participant not found." / "Visit not found." |
| 409 | `participantService.ts:120,179`, `protocolService.ts:45` | "This screening number already exists." |
| 500 | `AppError(…, 500)` after a failed repository update (for example `participantService.ts:197`), or a thrown non-`Error` value | "Enrollment failed." |

Consequences (Finding F3):

- A client cannot distinguish "your input was malformed" from "this state transition is not allowed": both are 400. Conventionally these would be 400/422 and 409.
- The same "not found" concept returns 404 from `enrollParticipant` (`participantService.ts:172-174`, an `AppError`) but 400 from `activateProtocolVersion` (via `protocolRules.ts:62`, a plain `Error`).
- For a `ZodError`, `error.message` is what ends up in `{ error }`. Per Zod v3's documented behaviour that message is a JSON string of the issues array. **Not run: needs deps** (no `zod` in this checkout).
- Unexpected programming errors (a `TypeError`, say) are also `Error`s, so they become **400 with the internal message**, not 500. A null dereference in a service would be reported to the client as a client error.

---

## Traces

Request: List participants for the dashboard
1. src/app/api/participants/route.ts — `GET()` receives the request and calls `withRouteGuard()`.
2. src/lib/http/routeContext.ts — `withRouteGuard()` resolves the session with `getSessionFromRequest()` and checks `PARTICIPANT_READ` with `assertPermission()`.
3. src/lib/auth/session.ts — `getSessionFromRequest()` loads the demo user and access scope.
4. src/services/participantService.ts — `listParticipants()` loads participants, protocol versions, and next scheduled visits, then applies blinding output shaping through `maskTreatmentArm()`.
5. src/repositories/participantRepository.ts — `list()` filters participants by the caller’s accessible `siteIds`.
6. src/repositories/protocolRepository.ts — `findAll()` loads protocol versions so pinned-version labels can be rendered.
7. src/repositories/visitRepository.ts — `listByParticipantId()` loads visits per participant to determine the next scheduled visit.
8. Returns `200` with `ParticipantSummary[]`.

Request: Enroll a screening participant onto an active protocol version
1. src/app/api/participants/[participantId]/enroll/route.ts:19-27 — `POST()` awaits `params`, then delegates to `withRouteGuard()` with `PARTICIPANT_ENROLL`.
2. src/lib/http/routeContext.ts:28 — `withRouteGuard()` resolves the session and checks `PARTICIPANT_ENROLL` (403 here for `MEDICAL_MONITOR`/`UNBLINDED_PHARMACIST`).
3. src/app/api/participants/[participantId]/enroll/route.ts:23 — inside the handler, `enrollParticipantSchema.parse(await readJson(request))` (`src/lib/validation/participantSchemas.ts:21-27`) validates protocol version ID, enrollment timestamp, subject ID, and blinding fields.
4. src/services/participantService.ts:164-168 — `participantRepository.findById(session, participantId)` does the scoped lookup (404 if out of scope).
5. src/services/participantService.ts:170-174 — `protocolRepository.findById()` loads the exact version that will be pinned (404 if missing).
6. src/services/participantService.ts:176-182 — `findByStudySubjectId()` (global, unscoped) rejects a subject ID already used by another participant (409).
7. src/services/participantService.ts:184 → src/lib/domain/stateTransitions.ts:13-21 — `assertParticipantCanEnroll()` rejects any participant not in `SCREENING` or any version not `ACTIVE` (plain `Error`, so 400).
8. src/services/participantService.ts:186-194 → src/repositories/participantRepository.ts:66-81 — `update()` sets `ENROLLED`, `enrolledAt`, `studySubjectId`, `pinnedProtocolVersionId`, blinding code and treatment arm.
9. src/services/participantService.ts:200-205 → src/lib/domain/protocolRules.ts:29-56 — `buildScheduledVisits()` generates visit dates from `enrolledAt` plus the pinned version's `visitTemplates`.
10. src/services/participantService.ts:209 → src/repositories/visitRepository.ts:19-22 — `createMany()` materializes the schedule.
11. src/services/participantService.ts:210-221 → src/services/auditService.ts:14-26 → src/repositories/auditRepository.ts:22-30 — appends `PARTICIPANT_ENROLLED`.
12. src/services/participantService.ts:223 — re-reads through `getParticipantDetail()`, so the response is blinded and audit-filtered for the caller.
13. Returns `200` with `ParticipantDetail` (**verified (ran)**: 4 visits for v2, arm `null` for a coordinator).

Steps 8, 10 and 11 are three independent writes with `await`s between them and no transaction. Two concurrent enrollments of `participant-002` both pass step 7 and both write. **Verified (ran):** fulfilled=2, 8 visit rows (Finding F4).

Request: Complete a scheduled visit
1. src/app/api/participants/[participantId]/visits/[visitId]/complete/route.ts:19-27 — `POST()` awaits both params and delegates to `withRouteGuard()`.
2. src/lib/http/routeContext.ts:28 — `withRouteGuard()` checks `VISIT_COMPLETE`.
3. .../complete/route.ts:23 — `completeVisitSchema.parse()` (`src/lib/validation/visitSchemas.ts:13-16`) validates `completedAt` and optional, nullable `notes` (≤500 chars).
4. src/services/visitService.ts:28-32 → src/repositories/participantRepository.ts:32-44 — `findById()` confirms the participant exists inside the caller's site scope.
5. src/services/visitService.ts:34-38 → src/repositories/visitRepository.ts:24-28 — `findById(participantId, visitId)` loads the visit anchored to the participant (404 if the visit belongs to someone else).
6. src/services/visitService.ts:40 → src/lib/domain/stateTransitions.ts:23-31 — `assertVisitCanBeCompleted()` requires participant `ENROLLED` and visit `SCHEDULED`.
7. src/services/visitService.ts:42-48 → src/repositories/visitRepository.ts:30-44 — `update()` locates the row by `visitId` **only** (`visitRepository.ts:32`) and marks it complete.
8. src/services/visitService.ts:54-64 — `auditService.record()` writes `VISIT_COMPLETED` with `visitCode` and `completedAt`.
9. Returns `200` with `StudyVisit`.

What is not checked: whether `completedAt` falls inside `windowStart..windowEnd`, or even after `enrolledAt`. **Verified (ran):** completing WEEK8 for `participant-001` on `2026-04-11` (window closed `2026-03-17`) succeeds, and the deviation count stays at 1 (Finding F5).

Request: Reject a coordinator trying to activate a protocol version
1. src/app/api/protocol-versions/[versionId]/activate/route.ts — `POST()` enters the route and delegates to `withRouteGuard()`.
2. src/lib/http/routeContext.ts — `withRouteGuard()` calls `getSessionFromRequest()` and then `assertPermission(session, "PROTOCOL_VERSION_MANAGE")`.
3. src/lib/auth/permissions.ts — `assertPermission()` throws `AppError(403)` because the `STUDY_COORDINATOR` role does not include `PROTOCOL_VERSION_MANAGE`.
4. src/lib/http/routeContext.ts — `withRouteGuard()` catches the error and serializes the rejection payload.
5. Returns `403` with `{ error, details }`.

Request: Reject cross-site participant detail access
1. src/app/api/participants/[participantId]/route.ts — `GET()` enters the participant detail handler.
2. src/lib/http/routeContext.ts — `withRouteGuard()` resolves the session and checks `PARTICIPANT_READ`.
3. src/services/participantService.ts — `getParticipantDetail()` calls `participantRepository.findById(session, participantId)`.
4. src/repositories/participantRepository.ts — `findById()` returns `null` because the participant’s `siteId` is not included in the coordinator’s access scope.
5. src/services/participantService.ts — `getParticipantDetail()` throws `AppError(404, "Participant not found.")`.
6. src/lib/http/routeContext.ts — `withRouteGuard()` converts the error to JSON.
7. Returns `404` with `{ error, details }`.

Request: Screen (create) a participant
1. src/app/api/participants/route.ts:19-28 — `POST()` delegates to `withRouteGuard()` with `PARTICIPANT_CREATE` (`:26`).
2. src/app/api/participants/route.ts:22 — `createParticipantSchema.parse()` (`src/lib/validation/participantSchemas.ts:13-19`). `dateOfBirth` must be a full ISO datetime, not a date.
3. src/services/participantService.ts:115 — a second `assertPermission(session, "PARTICIPANT_CREATE")`, the only service-level permission check in the codebase.
4. src/services/participantService.ts:117-123 — global screening-number uniqueness (409).
5. src/services/participantService.ts:125-127 — site scope check on `input.siteId` (403). The ordering of steps 4 and 5 is Finding F2.
6. src/services/participantService.ts:129-136 → src/repositories/participantRepository.ts:46-64 — insert with `status: "SCREENING"` and all enrollment fields `null`.
7. src/services/participantService.ts:138-148 — audit `PARTICIPANT_SCREENED`.
8. Returns `200` with the raw `Participant` (not a `ParticipantDetail`).

Request: Complete a participant's study
1. src/app/api/participants/[participantId]/complete-study/route.ts:21-27 — guard `STUDY_COMPLETE` (coordinators get 403 here).
2. .../complete-study/route.ts:23 — `completeStudySchema.parse()` (`participantSchemas.ts:29-31`).
3. src/services/participantService.ts:227-231 — scoped `findById` (404).
4. src/services/participantService.ts:233-234 → src/lib/domain/stateTransitions.ts:33-46 — every visit must be `COMPLETED`, otherwise 400 "All scheduled visits must be completed before study completion." This is what `tests/services/participant-transitions.test.ts:16-22` asserts for `participant-001`, which has two scheduled visits.
5. src/services/participantService.ts:236-240 — `update()` sets `COMPLETED` and `completedAt`. `completedAt` is not compared with the last visit date.
6. src/services/participantService.ts:246-255 — audit `PARTICIPANT_COMPLETED`.
7. Returns `200` with `ParticipantDetail`.

Request: Create a protocol version
1. src/app/api/protocol-versions/route.ts:19-28 — guard `PROTOCOL_VERSION_MANAGE` (`:26`), then `createProtocolVersionSchema.parse()` (`:22`, schema at `src/lib/validation/protocolSchemas.ts:22-28`).
2. src/services/protocolService.ts:39-46 — 409 if the same `(protocolCode, versionNumber)` exists.
3. src/services/protocolService.ts:48-51 → src/repositories/protocolRepository.ts:32-44 — insert as `DRAFT`.
4. src/services/protocolService.ts:53-63 — audit `PROTOCOL_VERSION_CREATED` with `participantId: null`.
5. Returns `200` with the `ProtocolVersion`.
Not checked: unique `visitCode`s inside `visitTemplates` (Finding F6), or that `versionNumber` is greater than the existing ones (gaps such as v2 → v5 are allowed, and so is a lower number such as v1 under a new `protocolCode`, as long as the pair is unique; `versionNumber` must only be a positive integer, `protocolSchemas.ts:24`).

Request: Activate a protocol version (data manager)
1. src/app/api/protocol-versions/[versionId]/activate/route.ts:21-27 — guard `PROTOCOL_VERSION_MANAGE`.
2. .../activate/route.ts:23 — `activateProtocolVersionSchema.parse()` requires `{ activatedAt }` and the result is **discarded** (Finding F8).
3. src/services/protocolService.ts:69-70 → src/lib/domain/protocolRules.ts:58-73 — not found gives a plain `Error`, so **400**. `RETIRED` gives 400. `ACTIVE` and `DRAFT` pass.
4. src/services/protocolService.ts:71 → src/repositories/protocolRepository.ts:46-79 — the target becomes `ACTIVE`, and active siblings with the same `protocolCode` become `RETIRED` (`:55-57` is the sibling filter).
5. src/services/protocolService.ts:77-87 — audit `PROTOCOL_VERSION_ACTIVATED`.
6. Returns `200` with the activated version. Enrolled participants are untouched (`protocolService.ts:89-90`).

Request: Record a protocol deviation
1. src/app/api/participants/[participantId]/deviations/route.ts:21-27 — guard `DEVIATION_CREATE`, then `createDeviationSchema.parse()` (`src/lib/validation/eventSchemas.ts:22-27`).
2. src/services/safetyEventService.ts:69-73 — scoped participant lookup (404).
3. src/services/safetyEventService.ts:75-79 → src/repositories/eventRepository.ts:37-48 — insert. No participant-status check, so a `SCREENING` or `COMPLETED` participant can receive deviations.
4. src/services/safetyEventService.ts:81-91 — audit `PROTOCOL_DEVIATION_RECORDED` with category and severity.
5. Returns `200` with the `ProtocolDeviation`. The detail page never renders deviations: `ParticipantDetailView.tsx` only maps `data.visits`, `data.adverseEvents` and `data.auditTrail`.

## Debugging scenarios

| Symptom | Where to look | Cause |
|---|---|---|
| 400 with a long JSON-looking `error` string | `src/lib/http/errors.ts:16-17` | a `ZodError` was flattened into `message` |
| 400 "Unexpected token …" / "… is not valid JSON" | `src/lib/http/routeContext.ts:16-18` | empty or invalid body. `readJson` has no try/catch, so `SyntaxError` becomes 400 |
| 400 on activate even though the version id is right | `activate/route.ts:23` | the body lacks `activatedAt`, which the schema requires even though nothing uses it |
| 400 "Participants can only enroll onto an active protocol version." | `stateTransitions.ts:18-20` | the client sent the v1 id. v1 is `RETIRED` in the seed (`seed.ts:56`) |
| 200 but the UI didn't update after a visit completion | `src/hooks/useParticipantDetail.ts:23-26` | invalidation keys must match `["participant", id]` and `["participants"]` exactly. Compare with `useParticipants.ts:9` |
| A TypeError inside a service shows up as 400 | `errors.ts:16-17` | all `Error` subclasses map to 400 (Finding F3) |

## Exercise ladder (Goal + Check)

1. **Junior.** *Goal:* for each of the 11 handlers, write down the first status code a coordinator from site-101 would get with a valid body. *Check:* compare with the permission matrix in [auth-and-permissions.md](auth-and-permissions.md). You should have exactly 4 handlers returning 403 for a coordinator: complete-study, adverse-events, `POST /api/protocol-versions`, and activate.
2. **Mid.** *Goal:* introduce a `DomainRuleError` (409/422) thrown by `stateTransitions.ts` and `protocolRules.ts`, and map it in `toAppError`. *Check:* a pure `node --test` file asserting `toAppError(new DomainRuleError("x")).status === 409` and `toAppError(new TypeError("x")).status === 500`.
3. **Mid.** *Goal:* return 201 for creates. *Check:* `withRouteGuard` gains an optional status argument, and only the two create routes pass it.
4. **Senior.** *Goal:* make enrollment atomic (Finding F4). *Check:* the scratch concurrency check (two `enrollParticipant` calls under `Promise.allSettled`) yields exactly one fulfilled result and 4 visit rows. With Prisma that means `$transaction` plus a conditional update (`where: { id, status: "SCREENING" }`).
