# Guided Reading Path

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
