/**
 * What this file does:
 * Centralizes participant and visit state transition rules so route handlers stay thin.
 * What calls it:
 * `src/services/participantService.ts`, `src/services/visitService.ts`, and `src/services/safetyEventService.ts`.
 * What it calls:
 * Pure checks only.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Hiding transition rules in React components or API handlers so the same rule is implemented differently in multiple places.
 */
import { Participant, ProtocolVersion, StudyVisit } from "@/types/domain";

export function assertParticipantCanEnroll(participant: Participant, protocolVersion: ProtocolVersion) {
  if (participant.status !== "SCREENING") {
    throw new Error("Only screening participants can be enrolled.");
  }

  if (protocolVersion.status !== "ACTIVE") {
    throw new Error("Participants can only enroll onto an active protocol version.");
  }
}

export function assertVisitCanBeCompleted(participant: Participant, visit: StudyVisit) {
  if (participant.status !== "ENROLLED") {
    throw new Error("Visits can only be completed for enrolled participants.");
  }

  if (visit.status !== "SCHEDULED") {
    throw new Error("Only scheduled visits can be completed.");
  }
}

export function assertParticipantCanCompleteStudy(participant: Participant, visits: StudyVisit[]) {
  if (participant.status !== "ENROLLED") {
    throw new Error("Only enrolled participants can be completed.");
  }

  const incompleteRequiredVisits = visits.filter((visit) => visit.status !== "COMPLETED");

  if (incompleteRequiredVisits.length > 0) {
    throw new Error("All scheduled visits must be completed before study completion.");
  }

  // ⚠️ SENIOR NOTE: Teams often forget to check related child records during a parent
  // transition. Completing the study without visit validation creates silent protocol drift.
}
