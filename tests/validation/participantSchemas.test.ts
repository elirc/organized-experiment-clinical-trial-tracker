import assert from "node:assert/strict";
import test from "node:test";
import { enrollParticipantSchema } from "@/lib/validation/participantSchemas";

test("enrollment schema rejects malformed enrollment payloads", () => {
  // This test matters because malformed enrollment dates or IDs can create bad visit schedules
  // that look legitimate until monitors reconcile the participant timeline later.
  assert.throws(() =>
    enrollParticipantSchema.parse({
      protocolVersionId: "",
      enrolledAt: "not-a-date",
      studySubjectId: "123",
      blindedRandomizationCode: "A",
      actualTreatmentArm: ""
    })
  );
});
