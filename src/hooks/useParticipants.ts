"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/apiClient";
import { ParticipantSummary } from "@/types/domain";

export function useParticipants() {
  return useQuery({
    queryKey: ["participants"],
    queryFn: () => fetchJson<ParticipantSummary[]>("/api/participants")
  });
}
