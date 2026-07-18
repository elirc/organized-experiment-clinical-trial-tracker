/**
 * What this file does:
 * Owns protocol version persistence and active-version lookup behavior.
 * What calls it:
 * `src/services/protocolService.ts` and `src/services/participantService.ts`.
 * What it calls:
 * `src/lib/mock-db/store.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Updating active protocol rows in place rather than creating immutable versions.
 */
import { nextId } from "@/lib/mock-db/ids";
import { getMockDb } from "@/lib/mock-db/store";
import { ProtocolVersion } from "@/types/domain";

export const protocolRepository = {
  async findAll() {
    return [...getMockDb().protocolVersions].sort((left, right) => right.versionNumber - left.versionNumber);
  },

  async findById(versionId: string) {
    return getMockDb().protocolVersions.find((version) => version.id === versionId) ?? null;
  },

  async findActiveVersion(protocolCode: string) {
    return (
      getMockDb().protocolVersions.find(
        (version) => version.protocolCode === protocolCode && version.status === "ACTIVE"
      ) ?? null
    );
  },

  async create(input: Omit<ProtocolVersion, "id" | "createdAt" | "updatedAt" | "status">) {
    const now = new Date().toISOString();
    const version: ProtocolVersion = {
      id: nextId(`protocol-${input.protocolCode.toLowerCase()}-v${input.versionNumber}`),
      status: "DRAFT",
      createdAt: now,
      updatedAt: now,
      ...input
    };

    getMockDb().protocolVersions.push(version);
    return version;
  },

  async activate(versionId: string) {
    const state = getMockDb();
    const target = state.protocolVersions.find((version) => version.id === versionId);

    if (!target) {
      return null;
    }

    state.protocolVersions = state.protocolVersions.map((version) => {
      if (version.protocolCode !== target.protocolCode) {
        return version;
      }

      if (version.id === target.id) {
        return {
          ...version,
          status: "ACTIVE",
          updatedAt: new Date().toISOString()
        };
      }

      if (version.status === "ACTIVE") {
        return {
          ...version,
          status: "RETIRED",
          updatedAt: new Date().toISOString()
        };
      }

      return version;
    });

    return state.protocolVersions.find((version) => version.id === versionId) ?? null;
  }
};

// ⚠️ SENIOR NOTE: The activation path must retire only sibling versions of the same protocol code.
// A missing filter here would silently corrupt every study's active version state.
