"use client";

import Link from "next/link";
import { ParticipantSummary } from "@/types/domain";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function ParticipantTable({ participants }: { participants: ParticipantSummary[] }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/60 bg-white/80 shadow-card">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50/90">
          <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
            <th className="px-5 py-4">Screening</th>
            <th className="px-5 py-4">Subject</th>
            <th className="px-5 py-4">Status</th>
            <th className="px-5 py-4">Protocol</th>
            <th className="px-5 py-4">Next Visit</th>
            <th className="px-5 py-4">Blinding</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
          {participants.map((participant) => (
            <tr key={participant.id} className="transition hover:bg-slate-50/90">
              <td className="px-5 py-4">
                <Link className="font-semibold text-signal hover:text-ink" href={`/participants/${participant.id}`}>
                  {participant.screeningNumber}
                </Link>
              </td>
              <td className="px-5 py-4">{participant.studySubjectId ?? "Pending enrollment"}</td>
              <td className="px-5 py-4">
                <StatusBadge value={participant.status} />
              </td>
              <td className="px-5 py-4">{participant.pinnedProtocolVersionLabel ?? "Not pinned yet"}</td>
              <td className="px-5 py-4">{participant.nextVisitLabel ?? "No scheduled visit"}</td>
              <td className="px-5 py-4">
                <span className="font-medium text-slate-600">
                  {participant.treatmentArm
                    ? `Arm visible: ${participant.treatmentArm}`
                    : participant.blindedRandomizationCode ?? "Blinded"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
