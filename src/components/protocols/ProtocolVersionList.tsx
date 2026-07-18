"use client";

import { useProtocolVersions } from "@/hooks/useProtocolVersions";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function ProtocolVersionList() {
  const { data, isLoading, error } = useProtocolVersions();

  if (isLoading) {
    return <div className="rounded-[28px] bg-white/80 p-6 shadow-card">Loading protocol versions...</div>;
  }

  if (error || !data) {
    return <div className="rounded-[28px] bg-rose-50 p-6 text-rose-700 shadow-card">Protocol versions failed to load.</div>;
  }

  return (
    <div className="rounded-[28px] border border-white/60 bg-white/80 p-6 shadow-card">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Protocol Ledger</p>
          <h2 className="mt-2 font-[var(--font-serif)] text-3xl text-ink">Version history stays immutable.</h2>
        </div>
        <p className="max-w-sm text-sm leading-6 text-slate-600">
          `ACME-1 v2` is active, but `participant-001` remains pinned to `v1`, which is why visit timing is derived
          from enrollment records rather than the calendar.
        </p>
      </div>
      <div className="space-y-4">
        {data.map((version) => (
          <div key={version.id} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-ink">
                    {version.protocolCode} v{version.versionNumber}
                  </h3>
                  <StatusBadge value={version.status} />
                </div>
                <p className="max-w-2xl text-sm leading-6 text-slate-600">{version.summary}</p>
              </div>
              <div className="text-sm text-slate-500">
                Effective {new Date(version.effectiveDate).toLocaleDateString()}
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {version.visitTemplates.map((visit) => (
                <div key={visit.visitCode} className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{visit.visitCode}</p>
                  <p className="mt-1 text-sm font-medium text-ink">{visit.label}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Day {visit.dayOffset}, window -{visit.windowBeforeDays}/+{visit.windowAfterDays}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
