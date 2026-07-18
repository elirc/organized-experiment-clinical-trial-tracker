/**
 * What this file does:
 * Encapsulates user lookup for session resolution.
 * What calls it:
 * `src/lib/auth/session.ts`.
 * What it calls:
 * `src/lib/mock-db/store.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Reading users directly from global state in auth code, making the auth boundary harder to replace later.
 */
import { getMockDb } from "@/lib/mock-db/store";

export const userRepository = {
  async findById(userId: string) {
    return getMockDb().users.find((user) => user.id === userId) ?? null;
  }
};

// ⚠️ SENIOR NOTE: Even a tiny auth lookup benefits from a repository seam because auth is
// usually one of the first integrations replaced when demo code becomes production code.
