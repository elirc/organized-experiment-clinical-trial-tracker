/**
 * What this file does:
 * Owns adverse event and protocol deviation persistence.
 * What calls it:
 * `src/services/safetyEventService.ts`.
 * What it calls:
 * `src/lib/mock-db/store.ts` and `src/lib/mock-db/ids.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Combining unrelated event types in one loose table shape that weakens validation and auditability.
 */
import { nextId } from "@/lib/mock-db/ids";
import { getMockDb } from "@/lib/mock-db/store";
import { AdverseEvent, ProtocolDeviation } from "@/types/domain";

export const eventRepository = {
  async listAdverseEventsByParticipantId(participantId: string) {
    return getMockDb().adverseEvents.filter((event) => event.participantId === participantId);
  },

  async listDeviationsByParticipantId(participantId: string) {
    return getMockDb().deviations.filter((event) => event.participantId === participantId);
  },

  async createAdverseEvent(input: Omit<AdverseEvent, "id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const adverseEvent: AdverseEvent = {
      id: nextId("ae"),
      createdAt: now,
      updatedAt: now,
      ...input
    };

    getMockDb().adverseEvents.push(adverseEvent);
    return adverseEvent;
  },

  async createDeviation(input: Omit<ProtocolDeviation, "id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const deviation: ProtocolDeviation = {
      id: nextId("dev"),
      createdAt: now,
      updatedAt: now,
      ...input
    };

    getMockDb().deviations.push(deviation);
    return deviation;
  }
};

// ⚠️ SENIOR NOTE: Safety-event repositories should preserve separate write paths for adverse
// events and deviations because they have different downstream reporting obligations.
