"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/apiClient";
import { ProtocolVersion } from "@/types/domain";

export function useProtocolVersions() {
  return useQuery({
    queryKey: ["protocolVersions"],
    queryFn: () => fetchJson<ProtocolVersion[]>("/api/protocol-versions")
  });
}
