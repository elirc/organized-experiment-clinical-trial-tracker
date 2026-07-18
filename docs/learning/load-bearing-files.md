# Load-Bearing Files

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
