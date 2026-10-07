# Concepts Demonstrated

Each concept below has three parts. The original "where to look" entry is kept and corrected. Under it, **In this code** quotes the real lines (copied exactly, with file:line), and **Check** gives a small exercise with a concrete pass condition. Checks marked *(ran)* were executed against a scratch copy of the code with `node --test`. See [testing-rationale.md](testing-rationale.md) for how.

## Service layer
Where to look: [src/services/participantService.ts](../../src/services/participantService.ts) — `enrollParticipant()` coordinates validation assumptions, repositories, scheduling, and audit logging without putting that logic in routes.
Also see: [src/services/visitService.ts](../../src/services/visitService.ts) for a narrower command-oriented service.
Risk if wrong: Route handlers become fat, rules diverge, and lifecycle behavior becomes hard to test.

**In this code.** A full route handler is 29 lines, most of them a header comment. The working part is:

```ts
  return withRouteGuard(
    async (session) => {
      const body = enrollParticipantSchema.parse(await readJson(request));
      return participantService.enrollParticipant(session, participantId, body);
    },
    request,
    "PARTICIPANT_ENROLL"
  );
```

(`src/app/api/participants/[participantId]/enroll/route.ts:21-28`.) The service takes a typed `input` and does not re-validate it (`src/services/participantService.ts:153-163`), so services trust whatever their caller passes. That is safe when the caller is a route with Zod in front, and unsafe for any other caller. Scratch check C12 called `protocolService.createProtocolVersion` directly with duplicate visit codes and the service accepted them.

**Check.** *Goal:* name every service method that is called from somewhere other than a route handler. *Pass:* only `participantService.listParticipants` (from `src/app/page.tsx:7`); `grep -rn "Service\." src/app src/components | grep -v src/app/api` prints only `src/app/page.tsx:7`.

## Repository pattern
Where to look: [src/repositories/participantRepository.ts](../../src/repositories/participantRepository.ts) — `list()` and `findById()` isolate scoped persistence access.
Also see: [src/repositories/protocolRepository.ts](../../src/repositories/protocolRepository.ts) for protocol activation persistence.
Risk if wrong: Business logic leaks into persistence code or data isolation gets skipped in one query path.

**In this code.** Updates take an *updater function* instead of a partial object:

```ts
  async update(participantId: string, updater: (participant: Participant) => Participant) {
    const state = getMockDb();
    const index = state.participants.findIndex((participant) => participant.id === participantId);

    if (index < 0) {
      return null;
    }

    const updated = updater(state.participants[index]);
    state.participants[index] = {
      ...updated,
      updatedAt: new Date().toISOString()
    };
```

(`src/repositories/participantRepository.ts:66-78`.) The repository owns `updatedAt`, and the service decides the new fields (`src/services/participantService.ts:186-194`). One subtlety: `update()` is **not** scoped. It takes a bare id. Every caller does a scoped `findById` first, so the scoping lives in the call sequence, not in the method.

`visitRepository` makes the same anchoring trade-off: `findById(participantId, visitId)` is anchored (`src/repositories/visitRepository.ts:24-28`), but `update(visitId, …)` is not (`:30-32`).

**Check.** *Goal:* list every repository method that does not take a `Session` or a parent id and can therefore return or modify data from any site. *Pass:* your list includes `participantRepository.findByScreeningNumber`, `findByStudySubjectId` and `update`, `visitRepository.update` and `listByParticipantId`, all `eventRepository` and `auditRepository` methods, and every `protocolRepository` method. You can explain why each is safe today (each is reached only after a scoped participant lookup, or the data is global).

## Zod validation boundary
Where to look: [src/lib/validation/participantSchemas.ts](../../src/lib/validation/participantSchemas.ts) — `enrollParticipantSchema.parse()` is invoked before `participantService.enrollParticipant()`.
Also see: [src/lib/validation/eventSchemas.ts](../../src/lib/validation/eventSchemas.ts) for safety-record inputs.
Risk if wrong: Invalid commands reach the service layer and create partially valid clinical records.

**In this code.**

```ts
export const enrollParticipantSchema = z.object({
  protocolVersionId: z.string().min(1),
  enrolledAt: z.string().datetime(),
  studySubjectId: z.string().min(4).max(30),
  blindedRandomizationCode: z.string().min(4).max(20),
  actualTreatmentArm: z.string().min(3).max(80)
});
```

(`src/lib/validation/participantSchemas.ts:21-27`.) The schema checks shape. Relationships are left to the service: whether the version exists, whether it is active, whether the subject id is free. Two gaps a reviewer should know about:

- `createProtocolVersionSchema.visitTemplates` is `z.array(visitTemplateSchema).min(1)` (`src/lib/validation/protocolSchemas.ts:27`), with no uniqueness constraint on `visitCode` (Finding F6).
- `activateProtocolVersionSchema` requires `activatedAt` (`protocolSchemas.ts:30-32`), and the route throws the parsed value away (`src/app/api/protocol-versions/[versionId]/activate/route.ts:23`).

**Check.** *Goal:* explain which of the 5 fields in the repo's only validation test (`tests/validation/participantSchemas.test.ts:9-15`) would fail on its own. *Pass:* `protocolVersionId: ""` (min 1), `enrolledAt: "not-a-date"`, `studySubjectId: "123"` (min 4), `blindedRandomizationCode: "A"` (min 4) and `actualTreatmentArm: ""` (min 3). All five are invalid, so the test cannot tell which rule fired. A stronger test changes one field per case. *(Not run: needs `zod`.)*

## Auth/session flow
Where to look: [src/lib/auth/session.ts](../../src/lib/auth/session.ts) — `getSessionFromRequest()` resolves the caller and access scope.
Also see: [src/lib/http/routeContext.ts](../../src/lib/http/routeContext.ts) for where session resolution plugs into request handling.
Risk if wrong: The caller’s identity and scope drift apart, which leads to inconsistent authorization and scoping behavior.

**In this code.**

```ts
  return {
    user,
    accessScope: {
      siteIds: user.siteIds,
      canReadAllSites: GLOBAL_ACCESS_ROLES.has(user.role)
    }
  };
```

(`src/lib/auth/session.ts:26-32`; the same literal is repeated at `:42-48` with `satisfies Session`.) Scope is derived once per request and travels with the session object to the repositories.

**Check (ran).** *Goal:* predict the role of a request with no `x-demo-user-id` header. *Pass:* `DATA_MANAGER`, because of `request.headers.get("x-demo-user-id") ?? DEFAULT_DEMO_USER_ID` (`session.ts:19`). Scratch check C6 confirmed it: the header-less request passed a `PROTOCOL_VERSION_MANAGE` guard with 200 (Finding F1).

## Role-based access control
Where to look: [src/lib/auth/permissions.ts](../../src/lib/auth/permissions.ts) — `rolePermissions` and `assertPermission()` map roles to capabilities.
Also see: [src/app/api/protocol-versions/[versionId]/activate/route.ts](../../src/app/api/protocol-versions/[versionId]/activate/route.ts) for a protected endpoint using the guard.
Risk if wrong: Operational roles can gain unintended authority over protocol governance or safety-sensitive data.

**In this code.** Roles map to permissions once (`src/lib/auth/permissions.ts:14-43`), and code asks about permissions, never roles. The only role-name checks outside the map are in `session.ts:16` (`GLOBAL_ACCESS_ROLES`), and those decide *scope*, not *capability*. Keeping those two ideas apart is the concept.

**Check (ran).** *Goal:* count the permissions per role without reading the table in [auth-and-permissions.md](../architecture/auth-and-permissions.md). *Pass:* coordinator 5, PI 6, data manager 9, medical monitor 3, pharmacist 2. Scratch check C5 computed exactly `[5, 6, 9, 3, 2]` from `hasPermission`.

## State transitions
Where to look: [src/lib/domain/stateTransitions.ts](../../src/lib/domain/stateTransitions.ts) — `assertParticipantCanEnroll()`, `assertVisitCanBeCompleted()`, and `assertParticipantCanCompleteStudy()`.
Also see: [src/services/participantService.ts](../../src/services/participantService.ts) for where those guards are applied.
Risk if wrong: Participants or visits can move into clinically invalid states without an explicit failure.

**In this code.**

```ts
export function assertParticipantCanCompleteStudy(participant: Participant, visits: StudyVisit[]) {
  if (participant.status !== "ENROLLED") {
    throw new Error("Only enrolled participants can be completed.");
  }

  const incompleteRequiredVisits = visits.filter((visit) => visit.status !== "COMPLETED");
```

(`src/lib/domain/stateTransitions.ts:33-38`.) The guards are pure functions over plain objects, which is why they could be tested directly with `node --test` and no mocks. Two caveats: they throw plain `Error`, which `toAppError` maps to HTTP 400 (`src/lib/http/errors.ts:16-17`), and the variable name says "required" while the filter ignores `VisitTemplate.required` (Finding F7).

**Check (ran).** *Goal:* write a pure test showing that one `CANCELLED` visit blocks study completion even when all other visits are `COMPLETED`. *Pass:* `assert.throws(..., /All scheduled visits/)`. This is scratch check C4.

## Audit logging
Where to look: [src/services/auditService.ts](../../src/services/auditService.ts) — `record()` is the single audit write path.
Also see: [src/repositories/auditRepository.ts](../../src/repositories/auditRepository.ts) for append-only persistence and [src/services/participantService.ts](../../src/services/participantService.ts) for usage.
Risk if wrong: Important lifecycle changes become unverifiable after the fact.

**In this code.**

```ts
  async record(event: {
    entityType: string;
    entityId: string;
    action: string;
    actorUserId: string;
    participantId: string | null;
    metadataJson: Record<string, unknown>;
  }) {
    return auditRepository.create({
      ...event,
      occurredAt: new Date().toISOString()
    });
  }
```

(`src/services/auditService.ts:14-26`.) `grep -rn 'action: "' src/services` finds 8 audit actions, one per mutation method: `PARTICIPANT_SCREENED` (`participantService.ts:141`), `PARTICIPANT_ENROLLED` (`:213`), `PARTICIPANT_COMPLETED` (`:249`), `PROTOCOL_VERSION_CREATED` (`protocolService.ts:56`), `PROTOCOL_VERSION_ACTIVATED` (`:80`), `ADVERSE_EVENT_RECORDED` (`safetyEventService.ts:47`), `PROTOCOL_DEVIATION_RECORDED` (`:84`) and `VISIT_COMPLETED` (`visitService.ts:57`). `action` is typed `string`, so a typo would silently create a new action.

Weak points:
- The audit write happens **after** the state change, and not atomically with it. If `auditService.record` threw, the change would persist without an audit row.
- `occurredAt` is always server time. Client-supplied times (`completedAt`, `activatedAt`) are not the audit time.
- Protocol audit rows have `participantId: null` and no read path exists for them (`src/repositories/auditRepository.ts:16-20` only filters by participant).

**Check.** *Goal:* list every mutation and the audit action it emits. *Pass:* 8 mutations and 8 actions, one each (screen, enroll, complete study, complete visit, AE, deviation, create version, activate version).

## Data isolation via site scoping
Where to look: [src/repositories/participantRepository.ts](../../src/repositories/participantRepository.ts) — `canAccessSite()`, `list()`, and `findById()`.
Also see: [src/lib/auth/session.ts](../../src/lib/auth/session.ts) for how `siteIds` enter the session.
Risk if wrong: One site’s coordinator can read another site’s subject data.

**In this code.**

```ts
  async findById(session: Session, participantId: string) {
    const participant = getMockDb().participants.find((candidate) => candidate.id === participantId) ?? null;

    if (!participant) {
      return null;
    }

    if (!canAccessSite(session, participant.siteId)) {
      return null;
    }

    return participant;
  },
```

(`src/repositories/participantRepository.ts:32-44`.) Both branches return the same `null`, so "doesn't exist" and "not yours" look identical to the service, which turns both into 404. That is the existence-hiding idea. Finding F2 shows where it fails: creating a participant leaks existence through a 409 that comes *before* the scope check (`src/services/participantService.ts:117-127`).

**Check (ran).** *Goal:* show the probe. *Pass:* as `user-coordinator-site-101`, `createScreeningParticipant` with `screeningNumber: "SCR-202-001", siteId: "site-202"` rejects with status 409, and with `"SCR-202-999"` rejects with 403. This is scratch check C8.

## Protocol version pinning
Where to look: [src/services/participantService.ts](../../src/services/participantService.ts) — `enrollParticipant()` writes `pinnedProtocolVersionId`.
Also see: [prisma/schema.prisma](../../prisma/schema.prisma) — `Participant.pinnedProtocolVersionId`.
Risk if wrong: Participants enrolled under v1 could silently start following v2 rules after activation.

**In this code.** Pinning is a single field write inside the enrollment updater, `pinnedProtocolVersionId: protocolVersion.id` (`src/services/participantService.ts:191`). The pin is only as strong as the rule that nothing rewrites the pinned version's templates, and that rule is a convention: there is no update method on `protocolRepository` (`src/repositories/protocolRepository.ts:15-80` has `findAll`, `findById`, `findActiveVersion`, `create` and `activate`). Activation changes only `status` and `updatedAt` (`:59-72`).

The read side uses the pin for display only: `listParticipants` derives the label (`participantService.ts:46-49`), and `getParticipantDetail` returns the pinned version (`:85-87`). Scheduling never re-reads it after enrollment, because the visits are already materialized.

**Check.** *Goal:* using the seed, explain why `participant-001` shows WEEK8 as its next visit while the active protocol has no WEEK8. *Pass:* you cite `pinnedProtocolVersionId: "protocol-acme-1-v1"` (`src/lib/mock-db/seed.ts:156`) and the materialized visit with id `participant-001-WEEK8` (`seed.ts:237`), which has `status: "SCHEDULED"` (`seed.ts:246`). Then confirm in `participantService.ts:50-52` that "next visit" is the earliest-`targetDate` `SCHEDULED` visit. WEEK8 (target 2026-03-12) beats CLOSEOUT (target 2026-04-09).

## Visit schedule materialization
Where to look: [src/lib/domain/protocolRules.ts](../../src/lib/domain/protocolRules.ts) — `buildScheduledVisits()` derives visit windows from `enrollmentDate`.
Also see: [src/services/participantService.ts](../../src/services/participantService.ts) for when the service materializes those rows.
Risk if wrong: Study timelines drift and downstream visit compliance logic becomes unreliable.

**In this code.**

```ts
    await visitRepository.createMany(scheduledVisits);
```

(`src/services/participantService.ts:209`, just after the `⚠️ SENIOR NOTE` at `:207-208`.) The visit rows are produced by `buildScheduledVisits` (`src/lib/domain/protocolRules.ts:29-56`). Each row copies `label`, `dayOffset` and the three dates from the template. It does **not** copy `required`, which is why the completion guard cannot honour it (Finding F7).

**Check (ran).** *Goal:* prove the seed was generated by the same rule the code uses. *Pass:* for each of the 8 seeded visits, `buildVisitDates(enrolledAt, template)` deep-equals the stored `{targetDate, windowStart, windowEnd}`. This is scratch check C1, 8/8 matched.

## Blinding logic
Where to look: [src/services/participantService.ts](../../src/services/participantService.ts) — `maskTreatmentArm()` controls whether `actualTreatmentArm` is returned.
Also see: [src/lib/auth/permissions.ts](../../src/lib/auth/permissions.ts) for the `TREATMENT_ARM_UNBLIND` permission.
Risk if wrong: Blinded operational staff can see treatment assignment and compromise study integrity.

**In this code.** The detail response overwrites the arm with the masked value:

```ts
    return {
      participant: {
        ...participant,
        actualTreatmentArm: blindedFields.treatmentArm
      },
```

(`src/services/participantService.ts:91-95`.) The spread-then-override order matters. If `...participant` came last, the real arm would win. The list view uses a separate `treatmentArm` field instead (`:65`), so the two DTOs encode blinding differently. Anyone adding a third DTO must remember to mask it.

**Check (ran).** *Goal:* show that blinding is read-side only. *Pass:* enroll `participant-002` as the coordinator with `actualTreatmentArm: "Comparator"`. The response has `participant.actualTreatmentArm === null` and `treatmentArmVisible === false`, while `getMockDb()` holds `"Comparator"`. This is scratch check C9 (Finding F10).

## Immutable version activation
Where to look: [src/services/protocolService.ts](../../src/services/protocolService.ts) — `activateProtocolVersion()` activates one version without touching enrolled participants.
Also see: [src/repositories/protocolRepository.ts](../../src/repositories/protocolRepository.ts) — `activate()` retires only sibling active versions.
Risk if wrong: Active-version changes can corrupt protocol state across studies or rewrite history.

**In this code.**

```ts
    state.protocolVersions = state.protocolVersions.map((version) => {
      if (version.protocolCode !== target.protocolCode) {
        return version;
      }
```

(`src/repositories/protocolRepository.ts:54-57`.) The sibling filter is the line the file's own senior note warns about (`:82-83`). Note that `activate()` **replaces** the `protocolVersions` array (`:54`) instead of mutating it in place. Any code holding a reference from an earlier `getMockDb().protocolVersions` would see stale data. The repositories avoid this by calling `getMockDb()` fresh each time.

**Check (ran).** *Goal:* activate a new v3 and observe the siblings. *Pass:* statuses `1:RETIRED, 2:RETIRED, 3:ACTIVE` (scratch check C12). Then activate v2 again and predict the outcome. *Answer (ran, check C14):* rejected with 400 "Retired protocol versions cannot be re-activated.", because v2 was retired by the v3 activation (`src/lib/domain/protocolRules.ts:65-67`). Rollback to an earlier version is impossible by design. Decide whether that is right for your trial.

## Concepts the code demonstrates by omission

These are worth learning precisely because they are absent:

- **Transactions.** No multi-write operation is atomic (enrollment: `participantService.ts:186-221`). See Finding F4.
- **Idempotency.** Re-posting a visit completion fails the second time with a plain `Error` (so 400), because the visit is no longer `SCHEDULED`. That is safe. Re-posting an adverse event creates a duplicate, because there is no idempotency key (`src/repositories/eventRepository.ts:24-35`). Both behaviours were verified (ran) in check C15.
- **Optimistic concurrency.** `updatedAt` is written (`participantRepository.ts:77`) but never compared.
- **Pagination.** `listParticipants` loads everything and runs one visit query per participant (`participantService.ts:43-45`), which is an N+1 shape once a real DB is behind it.
