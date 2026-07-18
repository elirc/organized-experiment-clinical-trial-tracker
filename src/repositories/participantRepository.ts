/**
 * What this file does:
 * Stores and queries participant records with explicit site scoping support.
 * What calls it:
 * `src/services/participantService.ts` and `src/services/safetyEventService.ts`.
 * What it calls:
 * `src/lib/mock-db/store.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Forgetting to thread the caller's site scope into queries and accidentally returning cross-site records.
 */
import { nextId } from "@/lib/mock-db/ids";
import { getMockDb } from "@/lib/mock-db/store";
import { Participant, Session } from "@/types/domain";

function canAccessSite(session: Session, siteId: string) {
  return session.accessScope.canReadAllSites || session.accessScope.siteIds.includes(siteId);
}

export const participantRepository = {
  async findByScreeningNumber(screeningNumber: string) {
    return getMockDb().participants.find((participant) => participant.screeningNumber === screeningNumber) ?? null;
  },

  async findByStudySubjectId(studySubjectId: string) {
    return getMockDb().participants.find((participant) => participant.studySubjectId === studySubjectId) ?? null;
  },

  async list(session: Session) {
    return getMockDb().participants.filter((participant) => canAccessSite(session, participant.siteId));
  },

  async findById(session: Session, participantId: string) {
    const participant = getMockDb().participants.find((candidate) => candidate.id === participantId) ?? null;

    if (!participant) {
      return null;
    }

    if (!canAccessSite(session, participant.siteId)) {
      return null;
    }

    return participant;
  },

  async create(input: Omit<Participant, "id" | "createdAt" | "updatedAt" | "status" | "studySubjectId" | "enrolledAt" | "completedAt" | "pinnedProtocolVersionId" | "blindedRandomizationCode" | "actualTreatmentArm">) {
    const now = new Date().toISOString();
    const participant: Participant = {
      id: nextId("participant"),
      studySubjectId: null,
      status: "SCREENING",
      enrolledAt: null,
      completedAt: null,
      pinnedProtocolVersionId: null,
      blindedRandomizationCode: null,
      actualTreatmentArm: null,
      createdAt: now,
      updatedAt: now,
      ...input
    };

    getMockDb().participants.push(participant);
    return participant;
  },

  async update(participantId: string, updater: (participant: Participant) => Participant) {
    const state = getMockDb();
    const index = state.participants.findIndex((participant) => participant.id === participantId);

    if (index < 0) {
      return null;
    }

    const updated = updater(state.participants[index]);
    state.participants[index] = {
      ...updated,
      updatedAt: new Date().toISOString()
    };

    return state.participants[index];
  }
};

// ⚠️ SENIOR NOTE: Returning `null` on out-of-scope lookups helps prevent existence leaks.
// A 404 here is safer than revealing that a cross-site participant record exists.
