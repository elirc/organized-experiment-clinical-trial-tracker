# Flow Traces

How to use this file: read a trace with the code open, and jump with the line index below. Every line number here was checked against the current tree. The enroll trace includes the subject-ID uniqueness step that the earlier version omitted. New traces (home page, complete study, activate, screen) and debugging scenarios follow the original six.

## Line index for the functions named in the traces

| Function | Location |
|---|---|
| `ParticipantsPage` | `src/app/participants/page.tsx:3-5` |
| `ParticipantDashboard` | `src/components/dashboard/ParticipantDashboard.tsx:7-50` |
| `useParticipants` | `src/hooks/useParticipants.ts:7-12` |
| `fetchJson` | `src/hooks/apiClient.ts:3-19` |
| `withRouteGuard` | `src/lib/http/routeContext.ts:26-41` |
| `getSessionFromRequest` | `src/lib/auth/session.ts:18-33` |
| `assertPermission` | `src/lib/auth/permissions.ts:49-59` |
| `participantService.listParticipants` | `src/services/participantService.ts:37-71` |
| `participantService.getParticipantDetail` | `src/services/participantService.ts:73-103` |
| `maskTreatmentArm` | `src/services/participantService.ts:27-34` |
| `participantRepository.list` / `findById` | `src/repositories/participantRepository.ts:28-30` / `:32-44` |
| `protocolRepository.findAll` | `src/repositories/protocolRepository.ts:16-18` |
| `visitRepository.listByParticipantId` | `src/repositories/visitRepository.ts:15-17` |
| `ParticipantDetailView` | `src/components/participants/ParticipantDetailView.tsx:6-140` |
| `useParticipantDetail` (`completeVisit`) | `src/hooks/useParticipantDetail.ts:7-33` (`:14-27`) |
| `visitService.completeVisit` | `src/services/visitService.ts:19-69` |
| `assertVisitCanBeCompleted` | `src/lib/domain/stateTransitions.ts:23-31` |
| `safetyEventService.recordAdverseEvent` | `src/services/safetyEventService.ts:18-57` |
| `eventRepository.createAdverseEvent` | `src/repositories/eventRepository.ts:24-35` |

## Flow: Load participant dashboard
1. `src/app/participants/page.tsx` — renders `ParticipantDashboard`.
2. `src/components/dashboard/ParticipantDashboard.tsx` — calls `useParticipants()`.
3. `src/hooks/useParticipants.ts` — fires `GET /api/participants`.
4. `src/app/api/participants/route.ts` — `GET()` route handler.
5. `src/lib/http/routeContext.ts` — `withRouteGuard()` resolves session and checks `PARTICIPANT_READ`.
6. `src/lib/auth/session.ts` — `getSessionFromRequest()` builds `Session.accessScope`.
7. `src/lib/auth/permissions.ts` — `assertPermission()` enforces RBAC.
8. `src/services/participantService.ts` — `listParticipants()` shapes participant summaries and applies `maskTreatmentArm()`.
9. `src/repositories/participantRepository.ts` — `list()` scopes by site.
10. `src/repositories/protocolRepository.ts` — `findAll()` loads pinned protocol metadata.
11. `src/repositories/visitRepository.ts` — `listByParticipantId()` determines next scheduled visit.
12. Returns `ParticipantSummary[]`.

## Flow: Enroll screening participant onto active protocol
1. `src/app/api/participants/[participantId]/enroll/route.ts:15-29` — `POST()` receives the command.
2. `src/lib/http/routeContext.ts:26-29` — `withRouteGuard()` authenticates and authorizes `PARTICIPANT_ENROLL`.
3. `src/app/api/participants/[participantId]/enroll/route.ts:23` → `src/lib/validation/participantSchemas.ts:21-27` — `enrollParticipantSchema.parse()`.
4. `src/services/participantService.ts:153-224` — `enrollParticipant()` orchestrates the workflow.
5. `src/repositories/participantRepository.ts:32-44` — `findById()` loads the participant inside scope (called at `participantService.ts:164`).
6. `src/repositories/protocolRepository.ts:20-22` — `findById()` loads the chosen protocol version (`participantService.ts:170`).
7. `src/repositories/participantRepository.ts:24-26` — `findByStudySubjectId()` checks global subject-ID uniqueness (`participantService.ts:176-182`). *This step was missing from the earlier version of this trace.*
8. `src/lib/domain/stateTransitions.ts:13-21` — `assertParticipantCanEnroll()` enforces valid lifecycle state (`participantService.ts:184`).
9. `src/repositories/participantRepository.ts:66-81` — `update()` pins the protocol version and writes subject/blinding fields (`participantService.ts:186-194`).
10. `src/lib/domain/protocolRules.ts:29-56` — `buildScheduledVisits()` derives visits from `enrolledAt` (`participantService.ts:200-205`).
11. `src/repositories/visitRepository.ts:19-22` — `createMany()` persists the visit schedule (`participantService.ts:209`).
12. `src/services/auditService.ts:14-26` — `record()` emits `PARTICIPANT_ENROLLED` (`participantService.ts:210-221`).
13. `src/repositories/auditRepository.ts:22-30` — `create()` persists the audit event with id `nextId("audit")`.
14. `src/services/participantService.ts:223` — returns `this.getParticipantDetail(...)`, so the response goes through blinding and audit filtering (lines `73-103`).
15. Returns `ParticipantDetail`.

## Flow: Reject coordinator protocol activation
1. `src/app/api/protocol-versions/[versionId]/activate/route.ts` — `POST()` enters the route.
2. `src/lib/http/routeContext.ts` — `withRouteGuard()` loads the session.
3. `src/lib/auth/session.ts` — `getSessionFromRequest()` resolves `user-coordinator-site-101`.
4. `src/lib/auth/permissions.ts` — `assertPermission(session, "PROTOCOL_VERSION_MANAGE")` throws `AppError(403)`.
5. `src/lib/http/routeContext.ts` — `withRouteGuard()` catches and serializes the error.
6. Returns `{ error, details }` with `403`.

## Flow: Complete scheduled visit
1. `src/app/participants/[participantId]/page.tsx` — renders `ParticipantDetailView`.
2. `src/components/participants/ParticipantDetailView.tsx` — button click calls `completeVisit.mutate(...)`.
3. `src/hooks/useParticipantDetail.ts` — fires `POST /api/participants/[participantId]/visits/[visitId]/complete`.
4. `src/app/api/participants/[participantId]/visits/[visitId]/complete/route.ts` — `POST()` route handler.
5. `src/lib/http/routeContext.ts` — `withRouteGuard()` checks `VISIT_COMPLETE`.
6. `src/lib/validation/visitSchemas.ts` — `completeVisitSchema.parse()`.
7. `src/services/visitService.ts` — `completeVisit()` loads participant and visit.
8. `src/repositories/participantRepository.ts` — `findById()` validates scope.
9. `src/repositories/visitRepository.ts` — `findById()` loads the visit.
10. `src/lib/domain/stateTransitions.ts` — `assertVisitCanBeCompleted()`.
11. `src/repositories/visitRepository.ts` — `update()` marks the visit complete.
12. `src/services/auditService.ts` — `record()` emits `VISIT_COMPLETED`.
13. `src/repositories/auditRepository.ts` — `create()` stores the audit row.
14. Returns updated `StudyVisit`.

## Flow: Block cross-site participant detail read
1. `src/app/api/participants/[participantId]/route.ts` — `GET()` route handler.
2. `src/lib/http/routeContext.ts` — `withRouteGuard()` authorizes `PARTICIPANT_READ`.
3. `src/services/participantService.ts` — `getParticipantDetail()` calls the repository.
4. `src/repositories/participantRepository.ts` — `findById(session, participantId)` returns `null` because `siteId` is out of scope.
5. `src/services/participantService.ts` — `getParticipantDetail()` throws `AppError("Participant not found.", 404)`.
6. `src/lib/http/routeContext.ts` — `withRouteGuard()` returns the rejection payload.
7. Returns `404`.

## Flow: Record adverse event
1. `src/app/api/participants/[participantId]/adverse-events/route.ts` — `POST()` route handler.
2. `src/lib/http/routeContext.ts` — `withRouteGuard()` checks `ADVERSE_EVENT_CREATE`.
3. `src/lib/validation/eventSchemas.ts` — `createAdverseEventSchema.parse()`.
4. `src/services/safetyEventService.ts` — `recordAdverseEvent()` orchestrates the write.
5. `src/repositories/participantRepository.ts` — `findById()` verifies the participant is in scope.
6. `src/repositories/eventRepository.ts` — `createAdverseEvent()` persists the safety record.
7. `src/services/auditService.ts` — `record()` emits `ADVERSE_EVENT_RECORDED`.
8. `src/repositories/auditRepository.ts` — `create()` appends the audit row.
9. Returns `AdverseEvent`.

Note: no UI calls this endpoint. The only UI mutation is `completeVisit` (`src/hooks/useParticipantDetail.ts:14-27`). Exercising AE, deviation, enroll, screen, complete-study or protocol endpoints requires an HTTP client.

## Flow: Server-render the home page (no HTTP API involved)
1. `src/app/page.tsx:5` — `HomePage` is an async Server Component.
2. `src/app/page.tsx:6` → `src/lib/auth/session.ts:35-49` — `getServerDemoSession()` with no argument resolves `user-data-manager`. There is no request, so no header to read.
3. `src/app/page.tsx:7` → `src/services/participantService.ts:37-71` — `listParticipants(session)` is called **directly**, with no `withRouteGuard` and no `assertPermission`. That is acceptable here only because the data manager has `PARTICIPANT_READ`.
4. `src/app/page.tsx:8` — counts `ENROLLED` summaries. With the seed this is 3 visible and 2 enrolled.
5. Renders. The UI states "visible participants in the current session" (`page.tsx:31`), but "current session" is always the data manager.

## Flow: Complete a participant's study (API only)
1. `src/app/api/participants/[participantId]/complete-study/route.ts:15-29` — `POST()`, permission `STUDY_COMPLETE`.
2. `.../complete-study/route.ts:23` → `src/lib/validation/participantSchemas.ts:29-31` — `completeStudySchema.parse()`.
3. `src/services/participantService.ts:227-231` — scoped `findById`, 404 if missing or out of scope.
4. `src/services/participantService.ts:233` → `src/repositories/visitRepository.ts:15-17` — loads **all** visits for the participant.
5. `src/services/participantService.ts:234` → `src/lib/domain/stateTransitions.ts:33-46` — requires `ENROLLED`, then every visit `COMPLETED`.
6. `src/services/participantService.ts:236-240` — `update()` to `COMPLETED`.
7. `src/services/participantService.ts:246-255` — audit `PARTICIPANT_COMPLETED`.
8. `src/services/participantService.ts:257` — returns the re-read detail.

For seeded `participant-001` this fails at step 5, because WEEK8 and CLOSEOUT are `SCHEDULED` (`src/lib/mock-db/seed.ts:246,263`). That is the repo's `tests/services/participant-transitions.test.ts`, which passed 1/1 when run against the scratch copy.

## Flow: Activate a protocol version (data manager, success path)
1. `src/app/api/protocol-versions/[versionId]/activate/route.ts:15-29` — `POST()`, permission `PROTOCOL_VERSION_MANAGE`.
2. `.../activate/route.ts:23` — parses `{ activatedAt }` and discards it.
3. `src/services/protocolService.ts:69` → `src/repositories/protocolRepository.ts:16-18` — loads all versions.
4. `src/services/protocolService.ts:70` → `src/lib/domain/protocolRules.ts:58-73` — rejects unknown or `RETIRED`.
5. `src/services/protocolService.ts:71` → `src/repositories/protocolRepository.ts:46-79` — swaps statuses within the same `protocolCode`.
6. `src/services/protocolService.ts:77-87` — audit `PROTOCOL_VERSION_ACTIVATED` (no participant).
7. Returns the version. No participant or visit row changes. The UI's `["protocolVersions"]` query (`src/hooks/useProtocolVersions.ts:9`) is not invalidated, because there is no UI mutation for activation.

## Flow: Screen a new participant (API only)
1. `src/app/api/participants/route.ts:19-28` — `POST()`, permission `PARTICIPANT_CREATE`.
2. `src/app/api/participants/route.ts:22` → `src/lib/validation/participantSchemas.ts:13-19`.
3. `src/services/participantService.ts:115` — redundant `assertPermission` (the only one inside a service).
4. `src/services/participantService.ts:117-123` → `src/repositories/participantRepository.ts:20-22` — global screening-number check, 409.
5. `src/services/participantService.ts:125-127` — site check, 403.
6. `src/services/participantService.ts:129-136` → `src/repositories/participantRepository.ts:46-64` — insert as `SCREENING`.
7. `src/services/participantService.ts:138-148` — audit `PARTICIPANT_SCREENED`.
8. Returns the raw `Participant`.

## Debugging scenarios (symptom → where to look → cause)

1. **"Complete Week 8" button does nothing visible.** Look at `src/components/participants/ParticipantDetailView.tsx:62-68`: the mutation has no `onError` handler and the component never reads `completeVisit.error` or `isPending`. Cause: if the API returns 4xx, `fetchJson` throws (`src/hooks/apiClient.ts:13-16`) and React Query stores the error, but nothing renders it.
2. **The button completes a visit other than the one you expected.** Look at `ParticipantDetailView.tsx:17`: `data.visits.find((visit) => visit.status === "SCHEDULED")` takes the first scheduled visit **in array order**, while the list page's "next visit" sorts by `targetDate` (`src/services/participantService.ts:50-52`). Cause: both agree today only because `createMany` pushes visits in template order (`src/repositories/visitRepository.ts:20`) and the seed lists them chronologically.
3. **Participant list still shows the old "next visit" after completing a visit.** Look at `src/hooks/useParticipantDetail.ts:23-26`. Cause: an invalidation key typo. Both `["participant", participantId]` and `["participants"]` must be invalidated, and the second must match `src/hooks/useParticipants.ts:9`.
4. **The detail page shows "Participant load failed." for `participant-003` after you switch `DEMO_USER_ID` to the coordinator.** Look at `src/repositories/participantRepository.ts:39-41`. Cause: `participant-003` is at site-202. The API returns 404, `fetchJson` throws, and the component shows its generic error (`ParticipantDetailView.tsx:13-15`).
5. **Audit trail panel says "does not have audit log visibility" for a data manager.** Look at `ParticipantDetailView.tsx:122-123`. Cause: that copy is shown for **any** empty array. `participant-003` has no audit rows in the seed (`src/lib/mock-db/seed.ts:370-384`).
6. **Deviations you POSTed never appear on the page.** Look at `ParticipantDetailView.tsx`. Cause: it renders visits, adverse events and audit, but not `data.deviations`, even though the API returns them (`participantService.ts:99`).

## Exercise ladder (Goal + Check)

1. **Junior.** *Goal:* trace `GET /api/participants/participant-002` as the data manager and list every function called. *Check:* your list has `withRouteGuard → requireRouteContext → getSessionFromRequest → userRepository.findById → assertPermission → getParticipantDetail → participantRepository.findById → (5 parallel reads) → maskTreatmentArm → hasPermission ×2`, and the pinned-version read resolves `null` because `pinnedProtocolVersionId` is `null` (`participantService.ts:85-87`).
2. **Mid.** *Goal:* add error display to the visit button (debugging scenario 1). *Check:* with the API forced to 400, the error message from `body.error` is visible on the page.
3. **Mid.** *Goal:* make the button and the list agree on "next visit" (scenario 2). *Check:* both use the same sort. Write a pure helper and test it with `node --test`.
4. **Senior.** *Goal:* write the enroll trace for a Prisma implementation, marking which steps belong inside `$transaction`. *Check:* steps 7-13 (uniqueness check through audit write) are inside the transaction. The response read (step 14) is after it, and the uniqueness check is backed by the `@unique` constraint on `studySubjectId` (`prisma/schema.prisma:94`).
