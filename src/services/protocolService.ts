/**
 * What this file does:
 * Owns protocol version creation, listing, and activation workflows.
 * What calls it:
 * `src/app/api/protocol-versions/route.ts` and `src/app/api/protocol-versions/[versionId]/activate/route.ts`.
 * What it calls:
 * `src/repositories/protocolRepository.ts`, `src/services/auditService.ts`, and `src/lib/domain/protocolRules.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Letting activation logic live in the route and forgetting to retire the previous active version.
 */
import { AppError } from "@/lib/http/errors";
import { assertProtocolVersionCanBeActivated } from "@/lib/domain/protocolRules";
import { protocolRepository } from "@/repositories/protocolRepository";
import { auditService } from "@/services/auditService";
import { Session } from "@/types/domain";

export const protocolService = {
  async listProtocolVersions() {
    return protocolRepository.findAll();
  },

  async createProtocolVersion(
    session: Session,
    input: {
      protocolCode: string;
      versionNumber: number;
      effectiveDate: string;
      summary: string;
      visitTemplates: {
        visitCode: string;
        label: string;
        dayOffset: number;
        windowBeforeDays: number;
        windowAfterDays: number;
        required: boolean;
      }[];
    }
  ) {
    const existingVersions = await protocolRepository.findAll();
    const conflictingVersion = existingVersions.find(
      (version) => version.protocolCode === input.protocolCode && version.versionNumber === input.versionNumber
    );

    if (conflictingVersion) {
      throw new AppError("This protocol version number already exists.", 409);
    }

    const created = await protocolRepository.create({
      ...input,
      createdById: session.user.id
    });

    await auditService.record({
      entityType: "protocolVersion",
      entityId: created.id,
      action: "PROTOCOL_VERSION_CREATED",
      actorUserId: session.user.id,
      participantId: null,
      metadataJson: {
        protocolCode: created.protocolCode,
        versionNumber: created.versionNumber
      }
    });

    return created;
  },

  async activateProtocolVersion(session: Session, versionId: string) {
    const versions = await protocolRepository.findAll();
    const targetVersion = assertProtocolVersionCanBeActivated(versions, versionId);
    const activated = await protocolRepository.activate(targetVersion.id);

    if (!activated) {
      throw new AppError("Protocol version activation failed.", 500);
    }

    await auditService.record({
      entityType: "protocolVersion",
      entityId: activated.id,
      action: "PROTOCOL_VERSION_ACTIVATED",
      actorUserId: session.user.id,
      participantId: null,
      metadataJson: {
        protocolCode: activated.protocolCode,
        versionNumber: activated.versionNumber
      }
    });

    // ⚠️ SENIOR NOTE: Activation intentionally does not touch existing participants.
    // The pinned version on each participant is the source of truth for future scheduling.
    return activated;
  }
};
