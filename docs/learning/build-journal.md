# Build Journal

## Stage 1 — Project framing and stack
- Built: The initial project shell in [package.json](../../package.json), [tsconfig.json](../../tsconfig.json), [tailwind.config.ts](../../tailwind.config.ts), and [src/app/layout.tsx](../../src/app/layout.tsx).
- Decisions made: Chose Next.js, TypeScript, Prisma, REST, Zod, React Query, and Tailwind. Chose a single-tenant sponsor-operated model with site-level scoping instead of full multi-tenancy.
- Why: The project is a backend-oriented internal CRUD system with complex domain rules, not a realtime product or public SaaS tenant platform.

## Stage 2 — Domain model and persistence boundary
- Built: [prisma/schema.prisma](../../prisma/schema.prisma), [src/types/domain.ts](../../src/types/domain.ts), [src/lib/mock-db/seed.ts](../../src/lib/mock-db/seed.ts), and repositories under [src/repositories](../../src/repositories).
- Decisions made: Used Prisma as the source-of-truth schema but kept repositories mock-backed through [src/lib/mock-db/store.ts](../../src/lib/mock-db/store.ts) so no database or generated Prisma client is needed.
- Why: This preserves realistic relational modeling and repository seams while honoring the no-install learning constraint.
- Correction (verification pass): "no install" only holds for the *database*. The app still imports `next`, `react`, `zod`, `@tanstack/react-query` and `clsx` at runtime, and the declared test command (`package.json:10`) fails on plain Node 22.16 even before dependencies matter, because of the `@/` alias, the `AppError` parameter properties, and value-imports of types. See [testing-rationale.md](testing-rationale.md).

## Stage 3 — Auth, permissions, validation, and domain rules
- Built: [src/lib/auth/session.ts](../../src/lib/auth/session.ts), [src/lib/auth/permissions.ts](../../src/lib/auth/permissions.ts), [src/lib/http/routeContext.ts](../../src/lib/http/routeContext.ts), [src/lib/domain/protocolRules.ts](../../src/lib/domain/protocolRules.ts), [src/lib/domain/stateTransitions.ts](../../src/lib/domain/stateTransitions.ts), and validation schemas under [src/lib/validation](../../src/lib/validation).
- Decisions made: Centralized RBAC and site scoping, and kept protocol scheduling plus state transitions in pure domain helpers instead of inside repositories or components.
- Why: The hard problems here are correctness and traceability, so the rules needed obvious homes.

## Stage 4 — Service layer and API surface
- Built: [src/services/participantService.ts](../../src/services/participantService.ts), [src/services/visitService.ts](../../src/services/visitService.ts), [src/services/safetyEventService.ts](../../src/services/safetyEventService.ts), [src/services/protocolService.ts](../../src/services/protocolService.ts), and routes under [src/app/api](../../src/app/api).
- Decisions made: Mutations emit audit logs from the service layer, and routes remain thin wrappers around validation plus service calls.
- Why: That keeps request traces clear and prevents business logic from fragmenting across HTTP files.

## Stage 5 — UI, tests, and learning docs
- Built: Dashboard pages and components under [src/app/participants](../../src/app/participants), [src/components](../../src/components), React Query hooks under [src/hooks](../../src/hooks), focused tests under [tests](../../tests), and the docs under [docs/architecture](../../docs/architecture) and [docs/learning](../../docs/learning).
- Decisions made: The UI deliberately uses the same REST surface the docs trace, so the frontend doubles as a reading aid rather than hiding the backend.
- Why: The project’s main teaching goal is learning how stronger engineers read and structure backend-heavy products.

## Major Decisions

### Decision: How to handle protocol versioning and visit schedules
- Why this matters: This is the hardest domain rule. If handled poorly, participants enrolled under `v1` can silently drift onto `v2`.
- Option 1: Store only the “current active version” and recompute visits on read.
  Pros: Minimal stored data.
  Cons: Breaks historical correctness and makes audits fragile.
  Likely future pain: Every protocol activation becomes risky.
- Option 2: Store `pinnedProtocolVersionId` on the participant but recompute visits from that version on read.
  Pros: Better than global active-version logic.
  Cons: Late edits to the protocol version or computation changes can still rewrite history.
  Likely future pain: Audit investigations become dependent on current code behavior.
- Option 3: Store `pinnedProtocolVersionId` and materialize visit rows at enrollment.
  Pros: Strong auditability, simple downstream visit operations, easier operational reporting.
  Cons: Requires more write-time orchestration.
  Likely future pain: Requires careful transaction boundaries in a production database.
- Choice: Option 3, implemented by `participantService.enrollParticipant()` in [src/services/participantService.ts](../../src/services/participantService.ts) calling `buildScheduledVisits()` in [src/lib/domain/protocolRules.ts](../../src/lib/domain/protocolRules.ts).
- Why this choice won: It best preserves historical truth and keeps future protocol activations from rewriting participant obligations.
- What junior/mid/senior engineers notice differently:
  Junior: Sees that visit generation happens after enrollment.
  Mid: Notices that the pinned version and materialized visits defend against future version changes.
  Senior: Worries about transactionality and immutability once Prisma replaces the mock adapter.

### Decision: Whether to include multi-tenancy
- Why this matters: Tenant boundaries change every repository and permission decision.
- Option 1: Add full tenant IDs everywhere now.
  Pros: More SaaS-ready.
  Cons: Extra complexity without a product requirement.
  Likely future pain: Noise in a learning project.
- Option 2: Stay single-tenant but add explicit site scoping.
  Pros: Realistic for sponsor-operated clinical systems and still teaches data isolation.
  Cons: Not the same as tenant isolation.
  Likely future pain: Tenant support would still require schema and session changes later.
- Choice: Option 2, implemented in `getSessionFromRequest()` in [src/lib/auth/session.ts](../../src/lib/auth/session.ts) and `participantRepository.findById()` in [src/repositories/participantRepository.ts](../../src/repositories/participantRepository.ts).
- Why this choice won: It matches the product description while preserving a clean path to future multi-tenancy.
- What junior/mid/senior engineers notice differently:
  Junior: Sees site filters as a permission detail.
  Mid: Notices the repository boundary is where scoping becomes reliable.
  Senior: Notes what schema and auth changes would be needed to evolve to real tenants.

### Decision: REST vs tRPC
- Why this matters: The teaching requirement depends on making the request lifecycle easy to follow.
- Option 1: tRPC.
  Pros: Great type safety and DX.
  Cons: The transport and boundary become less explicit for a learner trying to trace auth, validation, and HTTP rejection paths.
  Likely future pain: Harder to show route-level request flow in docs.
- Option 2: REST with thin routes plus Zod and services.
  Pros: Explicit request lifecycle and clearer separation between HTTP, validation, service, and repository layers.
  Cons: More boilerplate.
  Likely future pain: Endpoint sprawl if conventions weaken.
- Choice: Option 2, implemented across [src/app/api](../../src/app/api), [src/lib/http/routeContext.ts](../../src/lib/http/routeContext.ts), and the service files.
- Why this choice won: It makes the architecture reviewable and matches the project’s backend-teaching focus.
- What junior/mid/senior engineers notice differently:
  Junior: Sees the route-service split.
  Mid: Notices how validation and permission checks stay consistent across routes.
  Senior: Thinks about long-term API versioning, monitoring, and auth auditability.

### Decision: How to honor the no-install constraint without shipping shallow scaffolding
- Why this matters: The project needed to stay realistic without relying on generated Prisma artifacts or installed packages.
- Option 1: Write only docs and empty scaffolding.
  Pros: Fast.
  Cons: Teaches very little.
  Likely future pain: No meaningful codebase to read.
- Option 2: Skip Prisma entirely and build only an in-memory app.
  Pros: Simpler runtime.
  Cons: Loses the production data-model teaching value.
  Likely future pain: Harder to see how the system would map to a real database.
- Option 3: Keep Prisma schema as canonical design and back repositories with mock state.
  Pros: Preserves realistic modeling and service/repository boundaries while remaining install-free.
  Cons: Some runtime and test steps remain illustrative until dependencies are installed.
  Likely future pain: Mock and Prisma implementations would need to stay aligned.
- Choice: Option 3, implemented by pairing [prisma/schema.prisma](../../prisma/schema.prisma) with [src/lib/mock-db/store.ts](../../src/lib/mock-db/store.ts) and repositories under [src/repositories](../../src/repositories).
- Why this choice won: It delivers real architecture without violating the project constraint.
- What junior/mid/senior engineers notice differently:
  Junior: Sees a usable app with mock data.
  Mid: Notices the repository seam makes the persistence swap tractable.
  Senior: Watches for divergence risk between the schema design and mock adapter behavior.

## PR Slices

### Slice 1 — Foundation and schema
- Purpose in one sentence: Establish the project shell and the canonical domain model.
- Files with novel logic: `prisma/schema.prisma`, `src/types/domain.ts`, `src/lib/mock-db/seed.ts`, `src/lib/mock-db/store.ts`
- Reviewer focus:
  `prisma/schema.prisma`: verify `Participant.pinnedProtocolVersionId` and `ProtocolVersion.visitTemplates` model the hard versioning requirement.
  `src/lib/mock-db/seed.ts`: verify seeded data demonstrates a participant pinned to `v1` while `v2` is active.
  `src/types/domain.ts`: verify DTOs separate backend entities from UI response shapes.
- Strong-reviewer flag: A junior reviewer might accept protocol rules stored directly on participants, but a stronger reviewer would ask for immutable protocol version records.

### Slice 2 — Auth, permissions, and request boundary
- Purpose in one sentence: Make authentication, RBAC, and site scoping explicit before feature routes land.
- Files with novel logic: `src/lib/auth/session.ts`, `src/lib/auth/permissions.ts`, `src/lib/http/routeContext.ts`, `src/repositories/participantRepository.ts`
- Reviewer focus:
  `src/lib/auth/permissions.ts`: verify the permission matrix matches the intended clinical roles.
  `src/lib/auth/session.ts`: verify `accessScope` is attached to the session, not recomputed ad hoc.
  `src/repositories/participantRepository.ts`: verify read methods enforce site scoping.
- Strong-reviewer flag: A junior reviewer might approve UI-only hiding of cross-site data, but a stronger reviewer will require repository-level scoping.

### Slice 3 — Participant lifecycle and protocol scheduling
- Purpose in one sentence: Implement screening, enrollment, protocol pinning, and study completion.
- Files with novel logic: `src/services/participantService.ts`, `src/lib/domain/protocolRules.ts`, `src/lib/domain/stateTransitions.ts`, `src/app/api/participants/[participantId]/enroll/route.ts`
- Reviewer focus:
  `src/services/participantService.ts`: verify `enrollParticipant()` pins the version and materializes visits immediately.
  `src/lib/domain/protocolRules.ts`: verify schedules derive from `enrollmentDate`, not activation dates.
  `src/lib/domain/stateTransitions.ts`: verify invalid lifecycle transitions are rejected centrally.
- Strong-reviewer flag: A junior reviewer might approve recomputing visits on read because it “stays up to date”; a stronger reviewer will flag that as historically unsafe.

### Slice 4 — Operational workflows: visits, deviations, adverse events, audit trail
- Purpose in one sentence: Implement day-to-day trial operations with audit logging.
- Files with novel logic: `src/services/visitService.ts`, `src/services/safetyEventService.ts`, `src/services/auditService.ts`, `src/repositories/auditRepository.ts`
- Reviewer focus:
  `src/services/visitService.ts`: verify visit completion checks both participant and visit state.
  `src/services/safetyEventService.ts`: verify safety writes verify participant scope first.
  `src/services/auditService.ts`: verify all mutating workflows emit audit entries through the same seam.
- Strong-reviewer flag: A junior reviewer might approve free-form note storage for safety events; a stronger reviewer will push for structured fields plus audit metadata.

### Slice 5 — UI, tests, and learning docs
- Purpose in one sentence: Add a thin dashboard, focused tests, and flow-oriented documentation around the backend.
- Files with novel logic: `src/hooks/useParticipantDetail.ts`, `src/components/participants/ParticipantDetailView.tsx`, `tests/services/site-scoping.test.ts`, `docs/architecture/request-lifecycle.md`
- Reviewer focus:
  `src/hooks/useParticipantDetail.ts`: verify mutations invalidate both detail and list queries.
  `src/components/participants/ParticipantDetailView.tsx`: verify the component triggers backend commands without embedding business rules.
  `docs/architecture/request-lifecycle.md`: verify the trace names the actual files and functions now in the repo.
- Strong-reviewer flag: A junior reviewer might approve docs that describe the intended architecture abstractly; a stronger reviewer will insist the docs trace concrete files and functions.
- Retrospective note: that flag was itself only half met. The original `request-lifecycle.md` named real files, but put validation before the permission guard and the visit update before its transition check. Naming the right files is not the same as tracing the right order. The verification pass corrected both traces.

## Retrospective: what a verification pass found per slice

This section was added after the code was re-read line by line and the dependency-free parts were executed (method: [testing-rationale.md](testing-rationale.md)). It maps each finding back to the slice whose review should have caught it. Finding numbers refer to the table in [docs/architecture/README.md](../architecture/README.md).

### Slice 1 (foundation and schema)
- **Mock/schema divergence.** The schema's `@@unique([participantId, visitCode])` (`prisma/schema.prisma:137`) has no mock equivalent, so duplicate visit codes produce duplicate visit ids (F6, verified by running). The "Senior: watches for divergence risk" line in the no-install decision above predicted exactly this. A reviewer could have asked for a list of every schema constraint and where the mock enforces it. [domain-model.md](../architecture/domain-model.md) now has that list.
- **Declared-but-unreachable statuses.** `SCREEN_FAILED`, `WITHDRAWN`, `MISSED` and `CANCELLED` exist in `src/types/domain.ts:33,35,38`, but no code sets them. That is fine for scope control, but `assertParticipantCanCompleteStudy` (`src/lib/domain/stateTransitions.ts:38`) will need rework the moment `MISSED` becomes reachable (F7).

### Slice 2 (auth, permissions, request boundary)
- **Fail-open identity default** (F1): `session.ts:19` falls back to the data manager. The reviewer-focus bullet "verify `accessScope` is attached to the session" was satisfied, but nobody asked "what happens with *no* session?".
- **Dead helper** (F9): `assertSiteAccess()` was written in this slice (`routeContext.ts:43-50`) and never wired in. Slice 3 then re-implemented the condition inline at `participantService.ts:125`.
- **Error taxonomy** (F3): `toAppError` (`errors.ts:11-21`) maps every `Error` to 400. This slice set the error contract, and the domain guards written in Slice 3 throw plain `Error`s that inherit it.

### Slice 3 (participant lifecycle)
- **Check ordering leaks existence** (F2): screening-number 409 before site 403 (`participantService.ts:117-127`).
- **Non-atomic enrollment** (F4): three writes with no transaction. Two concurrent enrollments both succeed (verified by running: 8 visits instead of 4). The original decision record already listed "Requires careful transaction boundaries in a production database" as likely future pain. The mock shows the pain is present today, not only in production.
- **Blinded write path** (F10): the enrollment payload carries `actualTreatmentArm` from blinded roles.

### Slice 4 (operational workflows)
- **Visit windows unused** (F5): windows are computed carefully in Slice 3 and never consulted when a visit is completed.
- **Safety writes ignore participant status** (F11): the `stateTransitions.ts` header claims `safetyEventService.ts` calls it. It does not.

### Slice 5 (UI, tests, docs)
- **Unrunnable test command**: `package.json:10` cannot run on Node 22.16 as written (verified by running, three distinct errors).
- **Deviations are fetched but never rendered**: `getParticipantDetail` returns `deviations` (`participantService.ts:99`), and `ParticipantDetailView.tsx` has no deviation section.
- **Hard-coded status copy**: `ProtocolVersionList.tsx:25-26` states that ACME-1 v2 is active (F12).

## If you rebuilt this project: an ordered fix plan

Each step is small enough for one PR, and each has a check you can run without dependencies (except where noted).

1. **Make the tests runnable.** Change the `AppError` parameter properties to explicit fields, switch type imports to `import type`, and replace the `@/` alias in tests with relative imports or a loader. *Check:* `node --test --experimental-strip-types tests/services/*.test.ts` passes 3/3. The Zod test still needs `npm install`.
2. **Close the fail-open default** (F1). *Check:* a header-less request gets 401.
3. **Reorder scope before uniqueness** (F2). *Check:* cross-site probes all return 403.
4. **Introduce a domain error type** (F3). *Check:* `toAppError(new TypeError())` is 500, and a transition violation is 409.
5. **Reject duplicate visit codes** (F6) at both the service and the schema. *Check:* creating a version with two `BASE` templates gives 400/409.
6. **Make enrollment atomic** (F4). *Check:* the concurrency check yields one success.
7. **Use visit windows** (F5). Decide whether out-of-window completion is rejected or auto-records a deviation. *Check:* completing WEEK8 for `participant-001` on 2026-04-11 has the agreed effect.

