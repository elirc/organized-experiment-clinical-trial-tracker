"use client";

import { ParticipantTable } from "@/components/participants/ParticipantTable";
import { ProtocolVersionList } from "@/components/protocols/ProtocolVersionList";
import { useParticipants } from "@/hooks/useParticipants";

export function ParticipantDashboard() {
  const { data, isLoading, error } = useParticipants();

  return (
    <div className="grid gap-8">
      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="mesh-panel rounded-[28px] border border-white/70 p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Operational Rules</p>
          <h2 className="mt-3 font-[var(--font-serif)] text-3xl text-ink">The hard part lives in the backend.</h2>
          <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-600">
            <p>Enrollment pins a participant to a protocol version once, and future activations do not rewrite that history.</p>
            <p>Visit target dates are derived from `enrolledAt`, not from the protocol’s activation date or a calendar month.</p>
            <p>Only unblinded roles can see treatment assignment, even though all roles can see the randomization code.</p>
          </div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-slate-50 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Demo Session</p>
          <h2 className="mt-3 text-2xl font-semibold">Default caller: Data Manager</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Change the `x-demo-user-id` header in the API client to inspect how site scoping and blinding change the same endpoints.
          </p>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <p>`user-data-manager` can read all sites and manage protocol versions.</p>
            <p>`user-coordinator-site-101` is scoped to `site-101` and cannot unblind treatment arms.</p>
          </div>
        </div>
      </section>

      <section>
        {isLoading ? (
          <div className="rounded-[28px] bg-white/80 p-6 shadow-card">Loading participants...</div>
        ) : error || !data ? (
          <div className="rounded-[28px] bg-rose-50 p-6 text-rose-700 shadow-card">
            Participant data failed to load.
          </div>
        ) : (
          <ParticipantTable participants={data} />
        )}
      </section>

      <ProtocolVersionList />
    </div>
  );
}
