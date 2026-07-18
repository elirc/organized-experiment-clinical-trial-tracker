# Request Lifecycle

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
1. src/app/api/participants/[participantId]/enroll/route.ts — `POST()` reads the request body and calls `enrollParticipantSchema.parse()`.
2. src/lib/http/routeContext.ts — `withRouteGuard()` resolves the session and checks `PARTICIPANT_ENROLL`.
3. src/lib/validation/participantSchemas.ts — `enrollParticipantSchema.parse()` validates protocol version ID, enrollment timestamp, subject ID, and blinding fields.
4. src/services/participantService.ts — `enrollParticipant()` loads the participant and protocol version, checks duplicate subject IDs, and applies lifecycle rules.
5. src/lib/domain/stateTransitions.ts — `assertParticipantCanEnroll()` rejects any participant not currently in `SCREENING` or any protocol version not in `ACTIVE`.
6. src/repositories/participantRepository.ts — `findById()` scopes the participant lookup and `update()` pins `pinnedProtocolVersionId`, subject ID, blinding code, and treatment arm.
7. src/repositories/protocolRepository.ts — `findById()` loads the exact version that will be pinned.
8. src/lib/domain/protocolRules.ts — `buildScheduledVisits()` generates visit dates from `enrolledAt` plus protocol `visitTemplates`.
9. src/repositories/visitRepository.ts — `createMany()` materializes the participant’s visit schedule.
10. src/services/auditService.ts — `record()` appends the enrollment audit entry.
11. src/repositories/auditRepository.ts — `create()` stores the immutable audit log row.
12. Returns `200` with `ParticipantDetail`.

Request: Complete a scheduled visit
1. src/app/api/participants/[participantId]/visits/[visitId]/complete/route.ts — `POST()` parses the completion command.
2. src/lib/http/routeContext.ts — `withRouteGuard()` checks `VISIT_COMPLETE`.
3. src/lib/validation/visitSchemas.ts — `completeVisitSchema.parse()` validates the visit completion timestamp and optional notes.
4. src/services/visitService.ts — `completeVisit()` loads the participant and visit.
5. src/repositories/participantRepository.ts — `findById()` confirms the participant exists inside the caller’s site scope.
6. src/repositories/visitRepository.ts — `findById()` loads the visit anchored to the participant and `update()` marks it complete.
7. src/lib/domain/stateTransitions.ts — `assertVisitCanBeCompleted()` ensures the participant is `ENROLLED` and the visit is `SCHEDULED`.
8. src/services/auditService.ts — `record()` writes the visit completion event.
9. src/repositories/auditRepository.ts — `create()` stores the audit row.
10. Returns `200` with `StudyVisit`.

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
