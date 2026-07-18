/**
 * What this file does:
 * Persists visit schedules and visit completion state.
 * What calls it:
 * `src/services/participantService.ts` and `src/services/visitService.ts`.
 * What it calls:
 * `src/lib/mock-db/store.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Coupling visit writes to the participant repository until visit logic becomes impossible to test separately.
 */
import { getMockDb } from "@/lib/mock-db/store";
import { StudyVisit } from "@/types/domain";

export const visitRepository = {
  async listByParticipantId(participantId: string) {
    return getMockDb().visits.filter((visit) => visit.participantId === participantId);
  },

  async createMany(visits: StudyVisit[]) {
    getMockDb().visits.push(...visits);
    return visits;
  },

  async findById(participantId: string, visitId: string) {
    return (
      getMockDb().visits.find((visit) => visit.participantId === participantId && visit.id === visitId) ?? null
    );
  },

  async update(visitId: string, updater: (visit: StudyVisit) => StudyVisit) {
    const state = getMockDb();
    const index = state.visits.findIndex((visit) => visit.id === visitId);

    if (index < 0) {
      return null;
    }

    state.visits[index] = {
      ...updater(state.visits[index]),
      updatedAt: new Date().toISOString()
    };

    return state.visits[index];
  }
};

// ⚠️ SENIOR NOTE: Visit lookup uses both participantId and visitId because child entities
// should never be mutable through an identifier that is not anchored to the parent context.
