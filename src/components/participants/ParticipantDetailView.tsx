"use client";

import { useParticipantDetail } from "@/hooks/useParticipantDetail";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function ParticipantDetailView({ participantId }: { participantId: string }) {
  const { data, isLoading, error, completeVisit } = useParticipantDetail(participantId);

  if (isLoading) {
    return <div className="rounded-[28px] bg-white/80 p-6 shadow-card">Loading participant...</div>;
  }

  if (error || !data) {
    return <div className="rounded-[28px] bg-rose-50 p-6 text-rose-700 shadow-card">Participant load failed.</div>;
  }

  const nextScheduledVisit = data.visits.find((visit) => visit.status === "SCHEDULED");

  return (
    <div className="grid gap-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="mesh-panel rounded-[28px] border border-white/70 p-6 shadow-card">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-[var(--font-serif)] text-4xl text-ink">{data.participant.screeningNumber}</h2>
            <StatusBadge value={data.participant.status} />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Subject</p>
              <p className="mt-2 text-sm text-slate-700">{data.participant.studySubjectId ?? "Pending enrollment"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pinned protocol</p>
              <p className="mt-2 text-sm text-slate-700">
                {data.protocolVersion
                  ? `${data.protocolVersion.protocolCode} v${data.protocolVersion.versionNumber}`
                  : "Not assigned"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Blinded code</p>
              <p className="mt-2 text-sm text-slate-700">{data.participant.blindedRandomizationCode ?? "Not randomized"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Treatment arm</p>
              <p className="mt-2 text-sm text-slate-700">
                {data.treatmentArmVisible ? data.participant.actualTreatmentArm ?? "Not assigned" : "Hidden by blinding policy"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Fast Action</p>
          <h3 className="mt-3 text-2xl font-semibold">Complete the next scheduled visit</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            This button exercises the domain rule that only `SCHEDULED` visits for `ENROLLED` participants can transition to `COMPLETED`.
          </p>
          {nextScheduledVisit ? (
            <button
              className="mt-5 rounded-full bg-sand px-5 py-3 text-sm font-semibold text-ink transition hover:translate-y-[-1px]"
              onClick={() =>
                completeVisit.mutate({
                  visitId: nextScheduledVisit.id,
                  completedAt: new Date().toISOString(),
                  notes: "Completed from demo dashboard."
                })
              }
            >
              Complete {nextScheduledVisit.label}
            </button>
          ) : (
            <p className="mt-5 text-sm text-slate-300">All scheduled visits are already completed.</p>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[28px] border border-white/60 bg-white/80 p-6 shadow-card">
          <h3 className="font-[var(--font-serif)] text-2xl text-ink">Visit schedule</h3>
          <div className="mt-5 space-y-4">
            {data.visits.map((visit) => (
              <div key={visit.id} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{visit.label}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{visit.visitCode}</p>
                  </div>
                  <StatusBadge value={visit.status} />
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Target {new Date(visit.targetDate).toLocaleDateString()} | Window {new Date(visit.windowStart).toLocaleDateString()} -{" "}
                  {new Date(visit.windowEnd).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-[28px] border border-white/60 bg-white/80 p-6 shadow-card">
            <h3 className="font-[var(--font-serif)] text-2xl text-ink">Adverse events</h3>
            <div className="mt-4 space-y-4">
              {data.adverseEvents.map((event) => (
                <div key={event.id} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <StatusBadge value={event.severity} />
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      {new Date(event.reportedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-ink">{event.description}</p>
                  <p className="mt-2 text-sm text-slate-600">{event.outcome}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/60 bg-white/80 p-6 shadow-card">
            <h3 className="font-[var(--font-serif)] text-2xl text-ink">Audit trail</h3>
            <div className="mt-4 space-y-3">
              {data.auditTrail.length === 0 ? (
                <p className="text-sm text-slate-600">This session does not have audit log visibility.</p>
              ) : (
                data.auditTrail.map((entry) => (
                  <div key={entry.id} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-sm font-semibold text-ink">{entry.action}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                      {new Date(entry.occurredAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
