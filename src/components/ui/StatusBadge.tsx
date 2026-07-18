import clsx from "clsx";

const badgeStyles: Record<string, string> = {
  SCREENING: "bg-slate-100 text-slate-700",
  ENROLLED: "bg-teal-100 text-teal-800",
  COMPLETED: "bg-moss/10 text-moss",
  DRAFT: "bg-slate-100 text-slate-700",
  ACTIVE: "bg-signal/10 text-signal",
  RETIRED: "bg-amber-100 text-amber-800",
  SCHEDULED: "bg-cyan-100 text-cyan-900",
  MISSED: "bg-rose-100 text-rose-700",
  CANCELLED: "bg-slate-200 text-slate-700",
  MINOR: "bg-amber-100 text-amber-700",
  MAJOR: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-rose-100 text-rose-700",
  MILD: "bg-emerald-100 text-emerald-700",
  MODERATE: "bg-amber-100 text-amber-700",
  SEVERE: "bg-orange-100 text-orange-700",
  LIFE_THREATENING: "bg-rose-100 text-rose-700"
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
        badgeStyles[value] ?? "bg-slate-100 text-slate-700"
      )}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
