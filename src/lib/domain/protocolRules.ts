/**
 * What this file does:
 * Builds immutable visit schedules from a protocol version and enrollment date, and enforces activation rules.
 * What calls it:
 * `src/services/participantService.ts` and `src/services/protocolService.ts`.
 * What it calls:
 * Only small local date helpers in this file so the scheduling rules stay easy to review.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Recomputing participant schedules from "current active protocol" instead of the participant's pinned version.
 */
import { ProtocolVersion, StudyVisit, VisitTemplate } from "@/types/domain";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(isoDate: string, offset: number): string {
  return new Date(new Date(isoDate).getTime() + offset * MS_PER_DAY).toISOString();
}

export function buildVisitDates(enrollmentDate: string, template: VisitTemplate) {
  const targetDate = addDays(enrollmentDate, template.dayOffset);

  return {
    targetDate,
    windowStart: addDays(targetDate, -template.windowBeforeDays),
    windowEnd: addDays(targetDate, template.windowAfterDays)
  };
}

export function buildScheduledVisits(args: {
  participantId: string;
  protocolVersion: ProtocolVersion;
  enrollmentDate: string;
  now: string;
}): StudyVisit[] {
  return args.protocolVersion.visitTemplates.map((template) => {
    const dates = buildVisitDates(args.enrollmentDate, template);

    return {
      id: `${args.participantId}-${template.visitCode}`,
      participantId: args.participantId,
      protocolCode: `${args.protocolVersion.protocolCode}-v${args.protocolVersion.versionNumber}`,
      visitCode: template.visitCode,
      label: template.label,
      dayOffset: template.dayOffset,
      windowStart: dates.windowStart,
      targetDate: dates.targetDate,
      windowEnd: dates.windowEnd,
      status: "SCHEDULED",
      completedAt: null,
      completedById: null,
      notes: null,
      createdAt: args.now,
      updatedAt: args.now
    };
  });
}

export function assertProtocolVersionCanBeActivated(protocolVersions: ProtocolVersion[], versionId: string) {
  const targetVersion = protocolVersions.find((version) => version.id === versionId);

  if (!targetVersion) {
    throw new Error("Protocol version not found.");
  }

  if (targetVersion.status === "RETIRED") {
    throw new Error("Retired protocol versions cannot be re-activated.");
  }

  // ⚠️ SENIOR NOTE: Version activation is where teams often allow in-place edits,
  // which breaks auditability because enrolled participants stop matching the rule set
  // they were consented under. Activation here assumes versions are append-only.
  return targetVersion;
}
