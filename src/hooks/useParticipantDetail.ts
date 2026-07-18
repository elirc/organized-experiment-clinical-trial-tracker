"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/apiClient";
import { ParticipantDetail, StudyVisit } from "@/types/domain";

export function useParticipantDetail(participantId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["participant", participantId],
    queryFn: () => fetchJson<ParticipantDetail>(`/api/participants/${participantId}`)
  });

  const completeVisit = useMutation({
    mutationFn: (payload: { visitId: string; completedAt: string; notes?: string | null }) =>
      fetchJson<StudyVisit>(`/api/participants/${participantId}/visits/${payload.visitId}/complete`, {
        method: "POST",
        body: JSON.stringify({
          completedAt: payload.completedAt,
          notes: payload.notes ?? null
        })
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["participant", participantId] });
      await queryClient.invalidateQueries({ queryKey: ["participants"] });
    }
  });

  return {
    ...query,
    completeVisit
  };
}
