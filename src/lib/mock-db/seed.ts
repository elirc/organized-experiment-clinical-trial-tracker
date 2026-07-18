import {
  AdverseEvent,
  AuditLog,
  Participant,
  ProtocolDeviation,
  ProtocolVersion,
  StudyVisit,
  User
} from "@/types/domain";

const now = "2026-04-11T19:00:00.000Z";

export const demoUsers: User[] = [
  {
    id: "user-coordinator-site-101",
    email: "coordinator.site101@example.com",
    name: "Avery Nash",
    role: "STUDY_COORDINATOR",
    siteIds: ["site-101"]
  },
  {
    id: "user-pi-site-101",
    email: "pi.site101@example.com",
    name: "Dr. Marta Chen",
    role: "PRINCIPAL_INVESTIGATOR",
    siteIds: ["site-101"]
  },
  {
    id: "user-data-manager",
    email: "data.manager@example.com",
    name: "Jordan Patel",
    role: "DATA_MANAGER",
    siteIds: ["site-101", "site-202"]
  },
  {
    id: "user-monitor",
    email: "monitor@example.com",
    name: "Quinn Silva",
    role: "MEDICAL_MONITOR",
    siteIds: ["site-101", "site-202"]
  },
  {
    id: "user-pharmacist",
    email: "pharmacist@example.com",
    name: "Taylor Brooks",
    role: "UNBLINDED_PHARMACIST",
    siteIds: ["site-101", "site-202"]
  }
];

export const protocolVersionsSeed: ProtocolVersion[] = [
  {
    id: "protocol-acme-1-v1",
    protocolCode: "ACME-1",
    versionNumber: 1,
    status: "RETIRED",
    effectiveDate: "2025-11-01T00:00:00.000Z",
    summary: "Original schedule with visits at weeks 4, 8, and 12.",
    visitTemplates: [
      {
        visitCode: "BASELINE",
        label: "Baseline",
        dayOffset: 0,
        windowBeforeDays: 0,
        windowAfterDays: 0,
        required: true
      },
      {
        visitCode: "WEEK4",
        label: "Week 4",
        dayOffset: 28,
        windowBeforeDays: 3,
        windowAfterDays: 5,
        required: true
      },
      {
        visitCode: "WEEK8",
        label: "Week 8",
        dayOffset: 56,
        windowBeforeDays: 5,
        windowAfterDays: 5,
        required: true
      },
      {
        visitCode: "CLOSEOUT",
        label: "Closeout",
        dayOffset: 84,
        windowBeforeDays: 7,
        windowAfterDays: 7,
        required: true
      }
    ],
    createdById: "user-data-manager",
    createdAt: "2025-10-21T12:00:00.000Z",
    updatedAt: "2026-02-10T12:00:00.000Z"
  },
  {
    id: "protocol-acme-1-v2",
    protocolCode: "ACME-1",
    versionNumber: 2,
    status: "ACTIVE",
    effectiveDate: "2026-02-10T00:00:00.000Z",
    summary: "Updated schedule adds an early week 2 visit and shifts the week 8 visit to week 6.",
    visitTemplates: [
      {
        visitCode: "BASELINE",
        label: "Baseline",
        dayOffset: 0,
        windowBeforeDays: 0,
        windowAfterDays: 0,
        required: true
      },
      {
        visitCode: "WEEK2",
        label: "Week 2",
        dayOffset: 14,
        windowBeforeDays: 2,
        windowAfterDays: 3,
        required: true
      },
      {
        visitCode: "WEEK6",
        label: "Week 6",
        dayOffset: 42,
        windowBeforeDays: 4,
        windowAfterDays: 4,
        required: true
      },
      {
        visitCode: "CLOSEOUT",
        label: "Closeout",
        dayOffset: 84,
        windowBeforeDays: 7,
        windowAfterDays: 7,
        required: true
      }
    ],
    createdById: "user-data-manager",
    createdAt: "2026-02-01T12:00:00.000Z",
    updatedAt: "2026-02-10T12:00:00.000Z"
  }
];

export const participantsSeed: Participant[] = [
  {
    id: "participant-001",
    screeningNumber: "SCR-101-001",
    studySubjectId: "SUBJ-101-1001",
    siteId: "site-101",
    status: "ENROLLED",
    initials: "AB",
    dateOfBirth: "1988-04-18T00:00:00.000Z",
    screenedAt: "2026-01-10T09:00:00.000Z",
    enrolledAt: "2026-01-15T09:00:00.000Z",
    completedAt: null,
    pinnedProtocolVersionId: "protocol-acme-1-v1",
    blindedRandomizationCode: "RX-2049",
    actualTreatmentArm: "Investigational Product",
    createdById: "user-coordinator-site-101",
    createdAt: "2026-01-10T09:00:00.000Z",
    updatedAt: now
  },
  {
    id: "participant-002",
    screeningNumber: "SCR-101-002",
    studySubjectId: null,
    siteId: "site-101",
    status: "SCREENING",
    initials: "CD",
    dateOfBirth: "1979-02-14T00:00:00.000Z",
    screenedAt: "2026-04-09T10:30:00.000Z",
    enrolledAt: null,
    completedAt: null,
    pinnedProtocolVersionId: null,
    blindedRandomizationCode: null,
    actualTreatmentArm: null,
    createdById: "user-coordinator-site-101",
    createdAt: "2026-04-09T10:30:00.000Z",
    updatedAt: now
  },
  {
    id: "participant-003",
    screeningNumber: "SCR-202-001",
    studySubjectId: "SUBJ-202-2001",
    siteId: "site-202",
    status: "ENROLLED",
    initials: "EF",
    dateOfBirth: "1990-10-21T00:00:00.000Z",
    screenedAt: "2026-03-01T08:00:00.000Z",
    enrolledAt: "2026-03-05T08:30:00.000Z",
    completedAt: null,
    pinnedProtocolVersionId: "protocol-acme-1-v2",
    blindedRandomizationCode: "RX-3101",
    actualTreatmentArm: "Comparator",
    createdById: "user-data-manager",
    createdAt: "2026-03-01T08:00:00.000Z",
    updatedAt: now
  }
];

export const visitsSeed: StudyVisit[] = [
  {
    id: "participant-001-BASELINE",
    participantId: "participant-001",
    protocolCode: "ACME-1-v1",
    visitCode: "BASELINE",
    label: "Baseline",
    dayOffset: 0,
    windowStart: "2026-01-15T09:00:00.000Z",
    targetDate: "2026-01-15T09:00:00.000Z",
    windowEnd: "2026-01-15T09:00:00.000Z",
    status: "COMPLETED",
    completedAt: "2026-01-15T11:00:00.000Z",
    completedById: "user-pi-site-101",
    notes: "Baseline labs collected.",
    createdAt: "2026-01-15T09:00:00.000Z",
    updatedAt: now
  },
  {
    id: "participant-001-WEEK4",
    participantId: "participant-001",
    protocolCode: "ACME-1-v1",
    visitCode: "WEEK4",
    label: "Week 4",
    dayOffset: 28,
    windowStart: "2026-02-09T09:00:00.000Z",
    targetDate: "2026-02-12T09:00:00.000Z",
    windowEnd: "2026-02-17T09:00:00.000Z",
    status: "COMPLETED",
    completedAt: "2026-02-12T10:00:00.000Z",
    completedById: "user-coordinator-site-101",
    notes: "Participant tolerated dose escalation.",
    createdAt: "2026-01-15T09:00:00.000Z",
    updatedAt: now
  },
  {
    id: "participant-001-WEEK8",
    participantId: "participant-001",
    protocolCode: "ACME-1-v1",
    visitCode: "WEEK8",
    label: "Week 8",
    dayOffset: 56,
    windowStart: "2026-03-07T09:00:00.000Z",
    targetDate: "2026-03-12T09:00:00.000Z",
    windowEnd: "2026-03-17T09:00:00.000Z",
    status: "SCHEDULED",
    completedAt: null,
    completedById: null,
    notes: null,
    createdAt: "2026-01-15T09:00:00.000Z",
    updatedAt: now
  },
  {
    id: "participant-001-CLOSEOUT",
    participantId: "participant-001",
    protocolCode: "ACME-1-v1",
    visitCode: "CLOSEOUT",
    label: "Closeout",
    dayOffset: 84,
    windowStart: "2026-04-02T09:00:00.000Z",
    targetDate: "2026-04-09T09:00:00.000Z",
    windowEnd: "2026-04-16T09:00:00.000Z",
    status: "SCHEDULED",
    completedAt: null,
    completedById: null,
    notes: null,
    createdAt: "2026-01-15T09:00:00.000Z",
    updatedAt: now
  },
  {
    id: "participant-003-BASELINE",
    participantId: "participant-003",
    protocolCode: "ACME-1-v2",
    visitCode: "BASELINE",
    label: "Baseline",
    dayOffset: 0,
    windowStart: "2026-03-05T08:30:00.000Z",
    targetDate: "2026-03-05T08:30:00.000Z",
    windowEnd: "2026-03-05T08:30:00.000Z",
    status: "COMPLETED",
    completedAt: "2026-03-05T09:30:00.000Z",
    completedById: "user-data-manager",
    notes: "IP dispensed by pharmacist.",
    createdAt: "2026-03-05T08:30:00.000Z",
    updatedAt: now
  },
  {
    id: "participant-003-WEEK2",
    participantId: "participant-003",
    protocolCode: "ACME-1-v2",
    visitCode: "WEEK2",
    label: "Week 2",
    dayOffset: 14,
    windowStart: "2026-03-17T08:30:00.000Z",
    targetDate: "2026-03-19T08:30:00.000Z",
    windowEnd: "2026-03-22T08:30:00.000Z",
    status: "COMPLETED",
    completedAt: "2026-03-20T08:45:00.000Z",
    completedById: "user-data-manager",
    notes: "Early toxicity review completed.",
    createdAt: "2026-03-05T08:30:00.000Z",
    updatedAt: now
  },
  {
    id: "participant-003-WEEK6",
    participantId: "participant-003",
    protocolCode: "ACME-1-v2",
    visitCode: "WEEK6",
    label: "Week 6",
    dayOffset: 42,
    windowStart: "2026-04-12T08:30:00.000Z",
    targetDate: "2026-04-16T08:30:00.000Z",
    windowEnd: "2026-04-20T08:30:00.000Z",
    status: "SCHEDULED",
    completedAt: null,
    completedById: null,
    notes: null,
    createdAt: "2026-03-05T08:30:00.000Z",
    updatedAt: now
  },
  {
    id: "participant-003-CLOSEOUT",
    participantId: "participant-003",
    protocolCode: "ACME-1-v2",
    visitCode: "CLOSEOUT",
    label: "Closeout",
    dayOffset: 84,
    windowStart: "2026-05-21T08:30:00.000Z",
    targetDate: "2026-05-28T08:30:00.000Z",
    windowEnd: "2026-06-04T08:30:00.000Z",
    status: "SCHEDULED",
    completedAt: null,
    completedById: null,
    notes: null,
    createdAt: "2026-03-05T08:30:00.000Z",
    updatedAt: now
  }
];

export const adverseEventsSeed: AdverseEvent[] = [
  {
    id: "ae-001",
    participantId: "participant-001",
    reportedAt: "2026-03-03T10:00:00.000Z",
    severity: "MODERATE",
    description: "Transient infusion reaction.",
    outcome: "Resolved with supportive care.",
    isSerious: false,
    requiresUnblinding: false,
    createdById: "user-pi-site-101",
    createdAt: "2026-03-03T11:00:00.000Z",
    updatedAt: now
  }
];

export const deviationsSeed: ProtocolDeviation[] = [
  {
    id: "dev-001",
    participantId: "participant-001",
    category: "Visit Window",
    severity: "MINOR",
    description: "Week 4 labs processed 1 day late.",
    occurredAt: "2026-02-13T12:00:00.000Z",
    createdById: "user-coordinator-site-101",
    createdAt: "2026-02-13T13:00:00.000Z",
    updatedAt: now
  }
];

export const auditLogsSeed: AuditLog[] = [
  {
    id: "audit-001",
    entityType: "participant",
    entityId: "participant-001",
    action: "PARTICIPANT_ENROLLED",
    actorUserId: "user-pi-site-101",
    participantId: "participant-001",
    metadataJson: {
      protocolVersionId: "protocol-acme-1-v1",
      studySubjectId: "SUBJ-101-1001"
    },
    occurredAt: "2026-01-15T09:05:00.000Z"
  }
];
