import Link from "next/link";
import { getServerDemoSession } from "@/lib/auth/session";
import { participantService } from "@/services/participantService";

export default async function HomePage() {
  const session = await getServerDemoSession();
  const participants = await participantService.listParticipants(session);
  const active = participants.filter((participant) => participant.status === "ENROLLED").length;

  return (
    <main className="grid gap-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_1fr_1fr]">
        <div className="mesh-panel rounded-[28px] border border-white/70 p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Project Summary</p>
          <h2 className="mt-3 font-[var(--font-serif)] text-3xl text-ink">A realistic CRUD backend with clinical rules.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Participants move from screening to enrollment, visits, deviations, adverse events, and study completion.
            The backend preserves auditability, role-based permissions, blinding controls, and immutable protocol history.
          </p>
        </div>
        <div className="rounded-[28px] border border-white/60 bg-white/80 p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Why Prisma</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Prisma fits this project because the entity graph is highly relational, the schema needs to be legible to a
            growing team, and the service layer will eventually want transactions around enrollment plus audit writes.
          </p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Live Snapshot</p>
          <p className="mt-3 text-5xl font-semibold">{participants.length}</p>
          <p className="mt-2 text-sm text-slate-300">visible participants in the current session</p>
          <p className="mt-6 text-2xl font-semibold">{active}</p>
          <p className="mt-2 text-sm text-slate-300">currently enrolled participants</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-white/60 bg-white/80 p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Major Architectural Decisions</p>
          <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600">
            <p>Protocol versions are append-only records that can be activated or retired, never edited in place.</p>
            <p>Enrollment pins a participant to a version and materializes visit rows immediately from `enrolledAt`.</p>
            <p>Auth is mocked for the learning environment, but permission checks and site scoping are first-class backend boundaries.</p>
            <p>Repositories are mock-backed today so the project can ship without installs, but the Prisma schema remains the source-of-truth design artifact.</p>
          </div>
        </div>
        <div className="mesh-panel rounded-[28px] border border-white/70 p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Next Step</p>
          <h2 className="mt-3 font-[var(--font-serif)] text-3xl text-ink">Open the operational dashboard.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            The participants page exercises the same REST API your tests and docs trace, so it doubles as both demo UI and architecture map.
          </p>
          <Link
            className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            href="/participants"
          >
            View participants
          </Link>
        </div>
      </section>
    </main>
  );
}
