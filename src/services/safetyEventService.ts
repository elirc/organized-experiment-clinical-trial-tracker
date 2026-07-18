/**
 * What this file does:
 * Records adverse events and protocol deviations with participant/site authorization already enforced.
 * What calls it:
 * `src/app/api/participants/[participantId]/adverse-events/route.ts` and `src/app/api/participants/[participantId]/deviations/route.ts`.
 * What it calls:
 * `src/repositories/participantRepository.ts`, `src/repositories/eventRepository.ts`, and `src/services/auditService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Writing safety events without verifying the participant exists within the caller's scope first.
 */
import { AppError } from "@/lib/http/errors";
import { participantRepository } from "@/repositories/participantRepository";
import { eventRepository } from "@/repositories/eventRepository";
import { auditService } from "@/services/auditService";
import { Session } from "@/types/domain";

export const safetyEventService = {
  async recordAdverseEvent(
    session: Session,
    participantId: string,
    input: {
      reportedAt: string;
      severity: "MILD" | "MODERATE" | "SEVERE" | "LIFE_THREATENING";
      description: string;
      outcome: string;
      isSerious: boolean;
      requiresUnblinding: boolean;
    }
  ) {
    const participant = await participantRepository.findById(session, participantId);

    if (!participant) {
      throw new AppError("Participant not found.", 404);
    }

    const adverseEvent = await eventRepository.createAdverseEvent({
      participantId,
      createdById: session.user.id,
      ...input
    });

    // ⚠️ SENIOR NOTE: We log unblinding requirement as structured metadata because safety
    // escalations are the kind of workflow that later needs reporting without parsing prose.
    await auditService.record({
      entityType: "adverseEvent",
      entityId: adverseEvent.id,
      action: "ADVERSE_EVENT_RECORDED",
      actorUserId: session.user.id,
      participantId,
      metadataJson: {
        severity: adverseEvent.severity,
        requiresUnblinding: adverseEvent.requiresUnblinding
      }
    });

    return adverseEvent;
  },

  async recordDeviation(
    session: Session,
    participantId: string,
    input: {
      category: string;
      severity: "MINOR" | "MAJOR" | "CRITICAL";
      description: string;
      occurredAt: string;
    }
  ) {
    const participant = await participantRepository.findById(session, participantId);

    if (!participant) {
      throw new AppError("Participant not found.", 404);
    }

    const deviation = await eventRepository.createDeviation({
      participantId,
      createdById: session.user.id,
      ...input
    });

    await auditService.record({
      entityType: "protocolDeviation",
      entityId: deviation.id,
      action: "PROTOCOL_DEVIATION_RECORDED",
      actorUserId: session.user.id,
      participantId,
      metadataJson: {
        category: deviation.category,
        severity: deviation.severity
      }
    });

    return deviation;
  }
};
