# Testing Rationale

The repo has **4 test files with 1 test each, 4 tests in total** (counted: one `test(` call per file at `tests/services/participant-transitions.test.ts:11`, `tests/services/permission-enforcement.test.ts:7`, `tests/services/site-scoping.test.ts:11`, `tests/validation/participantSchemas.test.ts:5`). They use `node:test` and `node:assert/strict`, not Vitest or Jest, and there is no Vitest config in this repo. The original rationale for each test is kept below. Everything after it was added by a verification pass that actually tried to run them.

## Original rationale (kept)

`tests/services/permission-enforcement.test.ts` checks `assertPermission()` in `src/lib/auth/permissions.ts`. This is worth a test because role drift tends to happen quietly during feature work, and once a coordinator can manage protocol versions you no longer have a trustworthy separation between site operations and study governance. A fuller production suite would also hit `src/app/api/protocol-versions/route.ts` end-to-end and verify the HTTP response is `403`.

`tests/validation/participantSchemas.test.ts` checks `enrollParticipantSchema.parse()` in `src/lib/validation/participantSchemas.ts`. This matters because enrollment is the moment where schedule generation and protocol pinning begin; a bad timestamp or malformed subject ID can create a participant record that looks valid but drives incorrect visit dates. A fuller production suite would include happy-path parsing, duplicate subject ID conflicts through `src/services/participantService.ts`, and contract tests around real API payloads.

`tests/services/participant-transitions.test.ts` checks `participantService.completeStudy()` in `src/services/participantService.ts`. This catches a high-cost production bug class: parent status transitions that ignore incomplete child records. A fuller production suite would add visit permutations, withdrawal flows, and transaction-failure tests to ensure audit logging and participant updates stay consistent together.

`tests/services/site-scoping.test.ts` checks `participantService.getParticipantDetail()` together with `participantRepository.findById()` in `src/repositories/participantRepository.ts`. This matters because site scoping is the project’s main data-isolation boundary in the non-multi-tenant design; if it fails, the system leaks subject data across operational teams. A fuller production suite would run the same scenario through every repository-backed read route, plus role combinations for monitors, pharmacists, and data managers.

## Does the declared test command work? No (verified, ran)

`package.json:10`: `"test": "node --test --experimental-strip-types tests/**/*.test.ts"`. Running a test file directly with Node v22.16.0 (no `npm`, since no `node_modules` exists) fails. Three independent blockers were each reproduced separately: #1 by running `tests/services/permission-enforcement.test.ts`, #2 by running `src/lib/http/errors.ts` directly, and #3 with a minimal two-file scratch case.

| # | Error | Cause | Where |
|---|---|---|---|
| 1 | `ERR_MODULE_NOT_FOUND: Cannot find package '@/lib' imported from …permission-enforcement.test.ts` | Node does not apply `tsconfig.json` `paths` (`"@/*": ["./src/*"]`, `tsconfig.json:17-19`) | every test file, lines 3-5 |
| 2 | `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX: TypeScript parameter property is not supported in strip-only mode` | `public readonly status: number` and `public readonly details?` in a constructor | `src/lib/http/errors.ts:4-5` |
| 3 | `SyntaxError: The requested module './domain.ts' does not provide an export named 'Role'` | type-only names imported without `import type` (for example `src/lib/auth/permissions.ts:11`), which strip-only mode keeps as runtime imports | reproduced with a 2-file scratch case; the same pattern is in most `src/` files |

Blockers 1-3 are independent of `npm install`: installing dependencies fixes none of them. The fourth test additionally imports `zod`, so it also needs `npm install`.

## How the tests were actually run for this guide

All of this happened in a scratch directory outside the repo. No repo file was modified.

1. A small Node script copied the 21 dependency-free files under `src/` (types, auth, http, domain, mock-db, repositories, services; **not** `validation/`, which needs Zod) and applied three mechanical transforms: `@/x` became a relative path ending in `.ts`; `import { … } from "@/types/domain"` became `import type`; `AppError`'s parameter properties became explicit field declarations with assignments. The script throws if the `AppError` transform does not apply, so a silent no-op is impossible.
2. The three service tests were copied with only their import paths rewritten to the scratch copy. Test bodies were unchanged.
3. Result: `node --test --experimental-strip-types` gave **3/3 pass**:
   - `participant cannot complete study while required visits are still scheduled`: ok
   - `study coordinator cannot manage protocol versions`: ok
   - `site-scoped coordinator cannot read a participant from another site`: ok
4. `tests/validation/participantSchemas.test.ts`: **not run: needs deps** (`zod`).
5. 15 additional checks (C1-C15) were written against the same scratch copy. All **15/15 pass**, so the full run is `tests 18, pass 18, fail 0`. They are listed below so you can re-create them.

| Check | What it proves | Source under test |
|---|---|---|
| C1 | `buildVisitDates` reproduces all 8 seeded visit windows exactly | `src/lib/domain/protocolRules.ts:19-27`, `src/lib/mock-db/seed.ts:201-338` |
| C2 | generated visit ids are `<participantId>-<visitCode>`, all `SCHEDULED`, label `ACME-1-v2` | `protocolRules.ts:35-55` |
| C3 | activation guard: RETIRED/unknown throw plain `Error`; ACTIVE passes | `protocolRules.ts:58-73` |
| C4 | enrollment and visit guards, plus one CANCELLED visit blocking completion | `src/lib/domain/stateTransitions.ts` |
| C5 | permission counts `[5, 6, 9, 3, 2]`; only monitor and pharmacist can unblind | `src/lib/auth/permissions.ts:14-47` |
| C6 | header-less request is the data manager (200 on `PROTOCOL_VERSION_MANAGE`); unknown id gives 401 | `src/lib/auth/session.ts:19-24` (F1) |
| C7 | plain `Error` becomes 400, including "Protocol version not found." | `src/lib/http/errors.ts:16-17` (F3) |
| C8 | 409-before-403 existence probe | `src/services/participantService.ts:117-127` (F2) |
| C9 | enrollment creates 4 v2 visits and an audit row; coordinator response masks the arm, and the store keeps it | `participantService.ts:153-224` (F10) |
| C10 | two concurrent enrollments both succeed, giving 8 visits | `participantService.ts:164-209` (F4) |
| C11 | out-of-window visit completion accepted, no deviation | `src/services/visitService.ts:40-48` (F5) |
| C12 | duplicate `visitCode` makes study completion impossible; activation retires siblings | `protocolRules.ts:39`, `src/repositories/visitRepository.ts:32` (F6) |
| C13 | re-activating the ACTIVE version succeeds and writes an audit row | `protocolRules.ts:65-72` |
| C14 | after v3 activation, v2 cannot be re-activated (400) | `protocolRules.ts:65-67` |
| C15 | duplicate visit completion rejected; duplicate AE accepted (no idempotency) | `stateTransitions.ts:28-30`, `src/repositories/eventRepository.ts:24-35` |

Caveat: the transforms are mechanical and do not change behaviour, but the scratch copy is still not the repo. If you fix blockers 1-3 in the repo itself, re-run before relying on these results.

## What each existing test does *not* catch

- **permission-enforcement** calls `assertPermission` directly (`tests/services/permission-enforcement.test.ts:13`). It would still pass if a route passed the wrong permission string to `withRouteGuard`, or if the guard stopped being called. It covers 1 of 50 role×permission cells.
- **participant-transitions** asserts only the rejection path for one participant. It would still pass if `completeStudy` *never* succeeded, for example if the guard demanded impossible conditions. There is no happy-path test.
- **site-scoping** checks only `getParticipantDetail`. It would not catch a scoping regression in `list()` (`src/repositories/participantRepository.ts:28-30`) or in the visit/AE/deviation paths, and it would not catch Finding F2.
- **participantSchemas** feeds a payload in which all 5 fields are invalid at once (`tests/validation/participantSchemas.test.ts:9-15`). Removing any single rule (say `.datetime()` on `enrolledAt`) would leave the test green, because other fields still fail.

## Proposed test ladder (Goal + Check)

1. **Junior.** *Goal:* add the happy path for `completeStudy`: complete WEEK8 and CLOSEOUT for `participant-001`, then complete the study. *Check:* status `COMPLETED`, and one `PARTICIPANT_COMPLETED` audit row added.
2. **Junior.** *Goal:* split the schema test into 5 single-field cases. *Check:* each case changes one field from a valid baseline. Needs `zod`, so run it only after `npm install`.
3. **Mid.** *Goal:* a table-driven permission test over all 50 role×permission pairs. *Check:* the expected matrix is written out in the test, independently of `rolePermissions` (do not import the map to build expectations).
4. **Mid.** *Goal:* scope tests for `list()`, `completeVisit`, `recordAdverseEvent` and `recordDeviation` as the site-101 coordinator against `participant-003`. *Check:* list excludes it, and each mutation rejects with "Participant not found."
5. **Senior.** *Goal:* turn C8, C10 and C12 into regression tests that **fail today**. Mark them `test.todo` or `{ todo: true }` until fixed. *Check:* each fails for the documented reason before the fix and passes after.
6. **Senior.** *Goal:* make the declared `npm test` work. *Check:* fix blockers 1-3 (for example `import type`, explicit fields, and a tiny resolve hook or relative imports in tests), and `node --test --experimental-strip-types tests/services/*.test.ts` passes 3/3 in the repo itself.
