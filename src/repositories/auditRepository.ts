/**
 * What this file does:
 * Appends immutable audit events and reads the audit trail per participant.
 * What calls it:
 * `src/services/auditService.ts` and `src/services/participantService.ts`.
 * What it calls:
 * `src/lib/mock-db/store.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Rewriting or deleting audit rows during "cleanup", which destroys forensic value.
 */
import { nextId } from "@/lib/mock-db/ids";
import { getMockDb } from "@/lib/mock-db/store";
import { AuditLog } from "@/types/domain";

export const auditRepository = {
  async listByParticipantId(participantId: string) {
    return getMockDb().auditLogs
      .filter((log) => log.participantId === participantId)
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  },

  async create(input: Omit<AuditLog, "id">) {
    const auditLog: AuditLog = {
      id: nextId("audit"),
      ...input
    };

    getMockDb().auditLogs.push(auditLog);
    return auditLog;
  }
};

// ⚠️ SENIOR NOTE: Audit ordering should use the recorded timestamp, not insertion order,
// because real systems often backfill imports or replay events.
