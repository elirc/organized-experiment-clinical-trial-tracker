# Flow Traces

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
1. `src/app/api/participants/[participantId]/enroll/route.ts` — `POST()` receives the command.
2. `src/lib/http/routeContext.ts` — `withRouteGuard()` authenticates and authorizes `PARTICIPANT_ENROLL`.
3. `src/lib/validation/participantSchemas.ts` — `enrollParticipantSchema.parse()`.
4. `src/services/participantService.ts` — `enrollParticipant()` orchestrates the workflow.
5. `src/repositories/participantRepository.ts` — `findById()` loads the participant inside scope.
6. `src/repositories/protocolRepository.ts` — `findById()` loads the chosen protocol version.
7. `src/lib/domain/stateTransitions.ts` — `assertParticipantCanEnroll()` enforces valid lifecycle state.
8. `src/repositories/participantRepository.ts` — `update()` pins the protocol version and writes subject/blinding fields.
9. `src/lib/domain/protocolRules.ts` — `buildScheduledVisits()` derives visits from `enrolledAt`.
10. `src/repositories/visitRepository.ts` — `createMany()` persists the visit schedule.
11. `src/services/auditService.ts` — `record()` emits `PARTICIPANT_ENROLLED`.
12. `src/repositories/auditRepository.ts` — `create()` persists the audit event.
13. Returns `ParticipantDetail`.

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
