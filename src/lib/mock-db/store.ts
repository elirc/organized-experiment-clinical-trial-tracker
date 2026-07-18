/**
 * What this file does:
 * Holds the in-memory persistence adapter used by repositories in this learning build.
 * What calls it:
 * Every repository under `src/repositories`.
 * What it calls:
 * `src/lib/mock-db/seed.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Mutating shared arrays directly in service code instead of isolating persistence behind repositories.
 */
import {
  adverseEventsSeed,
  auditLogsSeed,
  demoUsers,
  deviationsSeed,
  participantsSeed,
  protocolVersionsSeed,
  visitsSeed
} from "@/lib/mock-db/seed";
import {
  AdverseEvent,
  AuditLog,
  Participant,
  ProtocolDeviation,
  ProtocolVersion,
  StudyVisit,
  User
} from "@/types/domain";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type MockDbState = {
  users: User[];
  protocolVersions: ProtocolVersion[];
  participants: Participant[];
  visits: StudyVisit[];
  adverseEvents: AdverseEvent[];
  deviations: ProtocolDeviation[];
  auditLogs: AuditLog[];
};

const state: MockDbState = {
  users: clone(demoUsers),
  protocolVersions: clone(protocolVersionsSeed),
  participants: clone(participantsSeed),
  visits: clone(visitsSeed),
  adverseEvents: clone(adverseEventsSeed),
  deviations: clone(deviationsSeed),
  auditLogs: clone(auditLogsSeed)
};

export function getMockDb() {
  return state;
}

export function resetMockDb() {
  state.users = clone(demoUsers);
  state.protocolVersions = clone(protocolVersionsSeed);
  state.participants = clone(participantsSeed);
  state.visits = clone(visitsSeed);
  state.adverseEvents = clone(adverseEventsSeed);
  state.deviations = clone(deviationsSeed);
  state.auditLogs = clone(auditLogsSeed);
}

// ⚠️ SENIOR NOTE: Shared state is acceptable for a learning repo, but a real service
// would scope this behind transactions. Without that, concurrent writes can race.
