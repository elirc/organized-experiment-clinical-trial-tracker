# Concepts Demonstrated

## Service layer
Where to look: [src/services/participantService.ts](/c:/Users/Owner/Desktop/ww11/src/services/participantService.ts) — `enrollParticipant()` coordinates validation assumptions, repositories, scheduling, and audit logging without putting that logic in routes.
Also see: [src/services/visitService.ts](/c:/Users/Owner/Desktop/ww11/src/services/visitService.ts) for a narrower command-oriented service.
Risk if wrong: Route handlers become fat, rules diverge, and lifecycle behavior becomes hard to test.

## Repository pattern
Where to look: [src/repositories/participantRepository.ts](/c:/Users/Owner/Desktop/ww11/src/repositories/participantRepository.ts) — `list()` and `findById()` isolate scoped persistence access.
Also see: [src/repositories/protocolRepository.ts](/c:/Users/Owner/Desktop/ww11/src/repositories/protocolRepository.ts) for protocol activation persistence.
Risk if wrong: Business logic leaks into persistence code or data isolation gets skipped in one query path.

## Zod validation boundary
Where to look: [src/lib/validation/participantSchemas.ts](/c:/Users/Owner/Desktop/ww11/src/lib/validation/participantSchemas.ts) — `enrollParticipantSchema.parse()` is invoked before `participantService.enrollParticipant()`.
Also see: [src/lib/validation/eventSchemas.ts](/c:/Users/Owner/Desktop/ww11/src/lib/validation/eventSchemas.ts) for safety-record inputs.
Risk if wrong: Invalid commands reach the service layer and create partially valid clinical records.

## Auth/session flow
Where to look: [src/lib/auth/session.ts](/c:/Users/Owner/Desktop/ww11/src/lib/auth/session.ts) — `getSessionFromRequest()` resolves the caller and access scope.
Also see: [src/lib/http/routeContext.ts](/c:/Users/Owner/Desktop/ww11/src/lib/http/routeContext.ts) for where session resolution plugs into request handling.
Risk if wrong: The caller’s identity and scope drift apart, which leads to inconsistent authorization and scoping behavior.

## Role-based access control
Where to look: [src/lib/auth/permissions.ts](/c:/Users/Owner/Desktop/ww11/src/lib/auth/permissions.ts) — `rolePermissions` and `assertPermission()` map roles to capabilities.
Also see: [src/app/api/protocol-versions/[versionId]/activate/route.ts](/c:/Users/Owner/Desktop/ww11/src/app/api/protocol-versions/[versionId]/activate/route.ts) for a protected endpoint using the guard.
Risk if wrong: Operational roles can gain unintended authority over protocol governance or safety-sensitive data.

## State transitions
Where to look: [src/lib/domain/stateTransitions.ts](/c:/Users/Owner/Desktop/ww11/src/lib/domain/stateTransitions.ts) — `assertParticipantCanEnroll()`, `assertVisitCanBeCompleted()`, and `assertParticipantCanCompleteStudy()`.
Also see: [src/services/participantService.ts](/c:/Users/Owner/Desktop/ww11/src/services/participantService.ts) for where those guards are applied.
Risk if wrong: Participants or visits can move into clinically invalid states without an explicit failure.

## Audit logging
Where to look: [src/services/auditService.ts](/c:/Users/Owner/Desktop/ww11/src/services/auditService.ts) — `record()` is the single audit write path.
Also see: [src/repositories/auditRepository.ts](/c:/Users/Owner/Desktop/ww11/src/repositories/auditRepository.ts) for append-only persistence and [src/services/participantService.ts](/c:/Users/Owner/Desktop/ww11/src/services/participantService.ts) for usage.
Risk if wrong: Important lifecycle changes become unverifiable after the fact.

## Data isolation via site scoping
Where to look: [src/repositories/participantRepository.ts](/c:/Users/Owner/Desktop/ww11/src/repositories/participantRepository.ts) — `canAccessSite()`, `list()`, and `findById()`.
Also see: [src/lib/auth/session.ts](/c:/Users/Owner/Desktop/ww11/src/lib/auth/session.ts) for how `siteIds` enter the session.
Risk if wrong: One site’s coordinator can read another site’s subject data.

## Protocol version pinning
Where to look: [src/services/participantService.ts](/c:/Users/Owner/Desktop/ww11/src/services/participantService.ts) — `enrollParticipant()` writes `pinnedProtocolVersionId`.
Also see: [prisma/schema.prisma](/c:/Users/Owner/Desktop/ww11/prisma/schema.prisma) — `Participant.pinnedProtocolVersionId`.
Risk if wrong: Participants enrolled under v1 could silently start following v2 rules after activation.

## Visit schedule materialization
Where to look: [src/lib/domain/protocolRules.ts](/c:/Users/Owner/Desktop/ww11/src/lib/domain/protocolRules.ts) — `buildScheduledVisits()` derives visit windows from `enrollmentDate`.
Also see: [src/services/participantService.ts](/c:/Users/Owner/Desktop/ww11/src/services/participantService.ts) for when the service materializes those rows.
Risk if wrong: Study timelines drift and downstream visit compliance logic becomes unreliable.

## Blinding logic
Where to look: [src/services/participantService.ts](/c:/Users/Owner/Desktop/ww11/src/services/participantService.ts) — `maskTreatmentArm()` controls whether `actualTreatmentArm` is returned.
Also see: [src/lib/auth/permissions.ts](/c:/Users/Owner/Desktop/ww11/src/lib/auth/permissions.ts) for the `TREATMENT_ARM_UNBLIND` permission.
Risk if wrong: Blinded operational staff can see treatment assignment and compromise study integrity.

## Immutable version activation
Where to look: [src/services/protocolService.ts](/c:/Users/Owner/Desktop/ww11/src/services/protocolService.ts) — `activateProtocolVersion()` activates one version without touching enrolled participants.
Also see: [src/repositories/protocolRepository.ts](/c:/Users/Owner/Desktop/ww11/src/repositories/protocolRepository.ts) — `activate()` retires only sibling active versions.
Risk if wrong: Active-version changes can corrupt protocol state across studies or rewrite history.
