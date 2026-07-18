import Link from "next/link";
import { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mesh-panel mb-8 overflow-hidden rounded-[32px] border border-white/70 p-8 shadow-card">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-signal">
              Clinical Operations Console
            </p>
            <h1 className="font-[var(--font-serif)] text-4xl leading-tight text-ink sm:text-5xl">
              Participant tracking built around protocol versions, safety workflows, and audit trails.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              Demo users are resolved by the `x-demo-user-id` header. The default session is the data manager so the
              dashboard exposes the full operational surface while still enforcing site scoping and blinding rules.
            </p>
          </div>
          <nav className="flex gap-3 text-sm font-medium">
            <Link className="rounded-full bg-ink px-4 py-2 text-white transition hover:bg-slate-800" href="/">
              Overview
            </Link>
            <Link
              className="rounded-full border border-slate-300 bg-white/70 px-4 py-2 text-slate-700 transition hover:border-signal hover:text-signal"
              href="/participants"
            >
              Participants
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
