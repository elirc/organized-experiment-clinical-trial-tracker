import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { getServerDemoSession } from "@/lib/auth/session";
import { resetMockDb } from "@/lib/mock-db/store";
import { participantService } from "@/services/participantService";

beforeEach(() => {
  resetMockDb();
});

test("participant cannot complete study while required visits are still scheduled", async () => {
  // This test matters because silent invalid lifecycle transitions create protocol deviations
  // that are expensive to detect once exports and closeout reports have already started.
  const session = await getServerDemoSession("user-pi-site-101");

  await assert.rejects(
    () =>
      participantService.completeStudy(session, "participant-001", {
        completedAt: "2026-04-11T19:00:00.000Z"
      }),
    /All scheduled visits must be completed/
  );
});
