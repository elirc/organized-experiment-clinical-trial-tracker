/**
 * What this file does:
 * Owns participant query and lifecycle operations, including enrollment and study completion.
 * What calls it:
 * Participant API route handlers and server-rendered pages.
 * What it calls:
 * Repositories under `src/repositories`, `src/lib/domain/*`, and `src/services/auditService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Mixing query shaping, transition rules, and persistence in a route handler instead of keeping a service seam.
 */
import { assertPermission, hasPermission } from "@/lib/auth/permissions";
import { buildScheduledVisits } from "@/lib/domain/protocolRules";
import { assertParticipantCanCompleteStudy, assertParticipantCanEnroll } from "@/lib/domain/stateTransitions";
import { AppError } from "@/lib/http/errors";
import { participantRepository } from "@/repositories/participantRepository";
import { protocolRepository } from "@/repositories/protocolRepository";
import { visitRepository } from "@/repositories/visitRepository";
import { eventRepository } from "@/repositories/eventRepository";
import { auditRepository } from "@/repositories/auditRepository";
import { auditService } from "@/services/auditService";
import { Participant, ParticipantDetail, ParticipantSummary, Session } from "@/types/domain";

function protocolLabel(versionNumber: number, protocolCode: string) {
  return `${protocolCode} v${versionNumber}`;
}

function maskTreatmentArm(session: Session, participant: Participant) {
  const canUnblind = hasPermission(session.user.role, "TREATMENT_ARM_UNBLIND");

  return {
    treatmentArm: canUnblind ? participant.actualTreatmentArm : null,
    treatmentArmVisible: canUnblind
  };
}

export const participantService = {
  async listParticipants(session: Session): Promise<ParticipantSummary[]> {
    const [participants, protocolVersions] = await Promise.all([
      participantRepository.list(session),
      protocolRepository.findAll()
    ]);

    const summaries = await Promise.all(
      participants.map(async (participant) => {
        const visits = await visitRepository.listByParticipantId(participant.id);
        const pinnedVersion =
          participant.pinnedProtocolVersionId === null
            ? null
            : protocolVersions.find((version) => version.id === participant.pinnedProtocolVersionId) ?? null;
        const nextVisit = visits
          .filter((visit) => visit.status === "SCHEDULED")
          .sort((left, right) => left.targetDate.localeCompare(right.targetDate))[0];
        const blindedFields = maskTreatmentArm(session, participant);

        return {
          id: participant.id,
          screeningNumber: participant.screeningNumber,
          studySubjectId: participant.studySubjectId,
          siteId: participant.siteId,
          status: participant.status,
          pinnedProtocolVersionLabel:
            pinnedVersion === null ? null : protocolLabel(pinnedVersion.versionNumber, pinnedVersion.protocolCode),
          nextVisitLabel: nextVisit?.label ?? null,
          blindedRandomizationCode: participant.blindedRandomizationCode,
          treatmentArm: blindedFields.treatmentArm
        };
      })
    );

    return summaries.sort((left, right) => left.screeningNumber.localeCompare(right.screeningNumber));
  },

  async getParticipantDetail(session: Session, participantId: string): Promise<ParticipantDetail> {
    const participant = await participantRepository.findById(session, participantId);

    if (!participant) {
      throw new AppError("Participant not found.", 404);
    }

    const [visits, adverseEvents, deviations, auditTrail, protocolVersion] = await Promise.all([
      visitRepository.listByParticipantId(participant.id),
      eventRepository.listAdverseEventsByParticipantId(participant.id),
      eventRepository.listDeviationsByParticipantId(participant.id),
      auditRepository.listByParticipantId(participant.id),
      participant.pinnedProtocolVersionId === null
        ? Promise.resolve(null)
        : protocolRepository.findById(participant.pinnedProtocolVersionId)
    ]);
    const blindedFields = maskTreatmentArm(session, participant);

    return {
      participant: {
        ...participant,
        actualTreatmentArm: blindedFields.treatmentArm
      },
      protocolVersion,
      visits,
      adverseEvents,
      deviations,
      auditTrail: hasPermission(session.user.role, "AUDIT_LOG_READ") ? auditTrail : [],
      treatmentArmVisible: blindedFields.treatmentArmVisible
    };
  },

  async createScreeningParticipant(
    session: Session,
    input: {
      screeningNumber: string;
      siteId: string;
      initials: string;
      dateOfBirth: string;
      screenedAt: string;
    }
  ) {
    assertPermission(session, "PARTICIPANT_CREATE");

    const existingScreeningNumber = await participantRepository.findByScreeningNumber(input.screeningNumber);

    if (existingScreeningNumber) {
      throw new AppError("This screening number already exists.", 409, {
        screeningNumber: input.screeningNumber
      });
    }

    if (!session.accessScope.canReadAllSites && !session.accessScope.siteIds.includes(input.siteId)) {
      throw new AppError("Caller cannot create participants for this site.", 403, { siteId: input.siteId });
    }

    const created = await participantRepository.create({
      screeningNumber: input.screeningNumber,
      siteId: input.siteId,
      initials: input.initials,
      dateOfBirth: input.dateOfBirth,
      screenedAt: input.screenedAt,
      createdById: session.user.id
    });

    await auditService.record({
      entityType: "participant",
      entityId: created.id,
      action: "PARTICIPANT_SCREENED",
      actorUserId: session.user.id,
      participantId: created.id,
      metadataJson: {
        screeningNumber: created.screeningNumber,
        siteId: created.siteId
      }
    });

    return created;
  },

  async enrollParticipant(
    session: Session,
    participantId: string,
    input: {
      protocolVersionId: string;
      enrolledAt: string;
      studySubjectId: string;
      blindedRandomizationCode: string;
      actualTreatmentArm: string;
    }
  ) {
    const participant = await participantRepository.findById(session, participantId);

    if (!participant) {
      throw new AppError("Participant not found.", 404);
    }

    const protocolVersion = await protocolRepository.findById(input.protocolVersionId);

    if (!protocolVersion) {
      throw new AppError("Protocol version not found.", 404);
    }

    const conflictingSubjectId = await participantRepository.findByStudySubjectId(input.studySubjectId);

    if (conflictingSubjectId && conflictingSubjectId.id !== participantId) {
      throw new AppError("This study subject ID is already in use.", 409, {
        studySubjectId: input.studySubjectId
      });
    }

    assertParticipantCanEnroll(participant, protocolVersion);

    const enrolledParticipant = await participantRepository.update(participant.id, (current) => ({
      ...current,
      status: "ENROLLED",
      enrolledAt: input.enrolledAt,
      studySubjectId: input.studySubjectId,
      pinnedProtocolVersionId: protocolVersion.id,
      blindedRandomizationCode: input.blindedRandomizationCode,
      actualTreatmentArm: input.actualTreatmentArm
    }));

    if (!enrolledParticipant) {
      throw new AppError("Enrollment failed.", 500);
    }

    const scheduledVisits = buildScheduledVisits({
      participantId: participant.id,
      protocolVersion,
      enrollmentDate: input.enrolledAt,
      now: new Date().toISOString()
    });

    // ⚠️ SENIOR NOTE: Visit rows are materialized at enrollment time so later protocol
    // activations cannot retroactively rewrite participant obligations.
    await visitRepository.createMany(scheduledVisits);
    await auditService.record({
      entityType: "participant",
      entityId: participant.id,
      action: "PARTICIPANT_ENROLLED",
      actorUserId: session.user.id,
      participantId: participant.id,
      metadataJson: {
        protocolVersionId: protocolVersion.id,
        versionNumber: protocolVersion.versionNumber,
        studySubjectId: input.studySubjectId
      }
    });

    return this.getParticipantDetail(session, participant.id);
  },

  async completeStudy(session: Session, participantId: string, input: { completedAt: string }) {
    const participant = await participantRepository.findById(session, participantId);

    if (!participant) {
      throw new AppError("Participant not found.", 404);
    }

    const visits = await visitRepository.listByParticipantId(participant.id);
    assertParticipantCanCompleteStudy(participant, visits);

    const completed = await participantRepository.update(participant.id, (current) => ({
      ...current,
      status: "COMPLETED",
      completedAt: input.completedAt
    }));

    if (!completed) {
      throw new AppError("Study completion failed.", 500);
    }

    await auditService.record({
      entityType: "participant",
      entityId: participant.id,
      action: "PARTICIPANT_COMPLETED",
      actorUserId: session.user.id,
      participantId: participant.id,
      metadataJson: {
        completedAt: input.completedAt
      }
    });

    return this.getParticipantDetail(session, participant.id);
  }
};
