/**
 * What this file does:
 * Declares the application-level domain types shared across services, repositories, hooks, and components.
 * What calls it:
 * Nearly every non-generated file in `src/`.
 * What it calls:
 * Nothing; this is a pure type boundary.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Letting the UI invent its own shapes instead of keeping a shared contract for domain entities and DTOs.
 */
export type Role =
  | "STUDY_COORDINATOR"
  | "PRINCIPAL_INVESTIGATOR"
  | "DATA_MANAGER"
  | "MEDICAL_MONITOR"
  | "UNBLINDED_PHARMACIST";

export type Permission =
  | "PARTICIPANT_READ"
  | "PARTICIPANT_CREATE"
  | "PARTICIPANT_ENROLL"
  | "VISIT_COMPLETE"
  | "STUDY_COMPLETE"
  | "ADVERSE_EVENT_CREATE"
  | "DEVIATION_CREATE"
  | "PROTOCOL_VERSION_MANAGE"
  | "AUDIT_LOG_READ"
  | "TREATMENT_ARM_UNBLIND";

export type ParticipantStatus =
  | "SCREENING"
  | "ENROLLED"
  | "SCREEN_FAILED"
  | "COMPLETED"
  | "WITHDRAWN";

export type ProtocolVersionStatus = "DRAFT" | "ACTIVE" | "RETIRED";
export type VisitStatus = "SCHEDULED" | "COMPLETED" | "MISSED" | "CANCELLED";
export type AdverseEventSeverity = "MILD" | "MODERATE" | "SEVERE" | "LIFE_THREATENING";
export type DeviationSeverity = "MINOR" | "MAJOR" | "CRITICAL";

export type VisitTemplate = {
  visitCode: string;
  label: string;
  dayOffset: number;
  windowBeforeDays: number;
  windowAfterDays: number;
  required: boolean;
};

export type ProtocolVersion = {
  id: string;
  protocolCode: string;
  versionNumber: number;
  status: ProtocolVersionStatus;
  effectiveDate: string;
  summary: string;
  visitTemplates: VisitTemplate[];
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type Participant = {
  id: string;
  screeningNumber: string;
  studySubjectId: string | null;
  siteId: string;
  status: ParticipantStatus;
  initials: string;
  dateOfBirth: string;
  screenedAt: string;
  enrolledAt: string | null;
  completedAt: string | null;
  pinnedProtocolVersionId: string | null;
  blindedRandomizationCode: string | null;
  actualTreatmentArm: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type StudyVisit = {
  id: string;
  participantId: string;
  protocolCode: string;
  visitCode: string;
  label: string;
  dayOffset: number;
  windowStart: string;
  targetDate: string;
  windowEnd: string;
  status: VisitStatus;
  completedAt: string | null;
  completedById: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdverseEvent = {
  id: string;
  participantId: string;
  reportedAt: string;
  severity: AdverseEventSeverity;
  description: string;
  outcome: string;
  isSerious: boolean;
  requiresUnblinding: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type ProtocolDeviation = {
  id: string;
  participantId: string;
  category: string;
  severity: DeviationSeverity;
  description: string;
  occurredAt: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId: string;
  participantId: string | null;
  metadataJson: Record<string, unknown>;
  occurredAt: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  siteIds: string[];
};

export type Session = {
  user: User;
  accessScope: {
    siteIds: string[];
    canReadAllSites: boolean;
  };
};

export type ParticipantSummary = {
  id: string;
  screeningNumber: string;
  studySubjectId: string | null;
  siteId: string;
  status: ParticipantStatus;
  pinnedProtocolVersionLabel: string | null;
  nextVisitLabel: string | null;
  blindedRandomizationCode: string | null;
  treatmentArm: string | null;
};

export type ParticipantDetail = {
  participant: Participant;
  protocolVersion: ProtocolVersion | null;
  visits: StudyVisit[];
  adverseEvents: AdverseEvent[];
  deviations: ProtocolDeviation[];
  auditTrail: AuditLog[];
  treatmentArmVisible: boolean;
};

// ⚠️ SENIOR NOTE: Shared types should describe stable domain contracts, not accidental
// component-specific shape changes, or the backend boundary gets eroded by presentation needs.
