/**
 * What this file does:
 * Owns visit completion behavior and visit-level audit logging.
 * What calls it:
 * `src/app/api/participants/[participantId]/visits/[visitId]/complete/route.ts`.
 * What it calls:
 * `src/repositories/participantRepository.ts`, `src/repositories/visitRepository.ts`, and `src/lib/domain/stateTransitions.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Updating visit status without validating the parent participant's lifecycle state.
 */
import { assertVisitCanBeCompleted } from "@/lib/domain/stateTransitions";
import { AppError } from "@/lib/http/errors";
import { participantRepository } from "@/repositories/participantRepository";
import { visitRepository } from "@/repositories/visitRepository";
import { auditService } from "@/services/auditService";
import { Session } from "@/types/domain";

export const visitService = {
  async completeVisit(
    session: Session,
    participantId: string,
    visitId: string,
    input: {
      completedAt: string;
      notes?: string | null;
    }
  ) {
    const participant = await participantRepository.findById(session, participantId);

    if (!participant) {
      throw new AppError("Participant not found.", 404);
    }

    const visit = await visitRepository.findById(participantId, visitId);

    if (!visit) {
      throw new AppError("Visit not found.", 404);
    }

    assertVisitCanBeCompleted(participant, visit);

    const completedVisit = await visitRepository.update(visitId, (current) => ({
      ...current,
      status: "COMPLETED",
      completedAt: input.completedAt,
      completedById: session.user.id,
      notes: input.notes ?? null
    }));

    if (!completedVisit) {
      throw new AppError("Visit completion failed.", 500);
    }

    await auditService.record({
      entityType: "visit",
      entityId: visitId,
      action: "VISIT_COMPLETED",
      actorUserId: session.user.id,
      participantId,
      metadataJson: {
        visitCode: visit.visitCode,
        completedAt: input.completedAt
      }
    });

    // ⚠️ SENIOR NOTE: Visit completion logs the participantId explicitly so later audits
    // can be reconstructed without an extra join if child records are archived separately.
    return completedVisit;
  }
};
