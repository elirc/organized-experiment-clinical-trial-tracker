import assert from "node:assert/strict";
import test from "node:test";
import { getServerDemoSession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { AppError } from "@/lib/http/errors";

test("study coordinator cannot manage protocol versions", async () => {
  // This test matters because permission drift usually starts with "temporary" admin access
  // added to operational roles, which can let site staff mutate protocol configuration.
  const session = await getServerDemoSession("user-coordinator-site-101");

  assert.throws(
    () => assertPermission(session, "PROTOCOL_VERSION_MANAGE"),
    (error: unknown) => error instanceof AppError && error.status === 403
  );
});
