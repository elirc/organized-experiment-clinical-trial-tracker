import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { getServerDemoSession } from "@/lib/auth/session";
import { resetMockDb } from "@/lib/mock-db/store";
import { participantService } from "@/services/participantService";

beforeEach(() => {
  resetMockDb();
});

test("site-scoped coordinator cannot read a participant from another site", async () => {
  // This test matters because access-scope bugs are a common real-world data leak class:
  // one missed filter can expose another site's subjects, visits, or safety events.
  const session = await getServerDemoSession("user-coordinator-site-101");

  await assert.rejects(
    () => participantService.getParticipantDetail(session, "participant-003"),
    /Participant not found/
  );
});
