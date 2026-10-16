"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { SCORE_CRITERIA, SCORE_MAX, SOURCES, type ScoreKey } from "@/lib/options";

/* ---------- types ---------- */

type Cand = {
  id: string;
  status: string;
  category_id: string | null;
  source: string | null;
  recruiter_id: string | null;
  location_applied: string | null;
  created_at: string;
};
type JoinedEvent = { candidate_id: string; created_at: string };
type Assess = { candidate_id: string; created_at: string } & Record<ScoreKey, number | null>;
type Vac = {
  id: string;
  category_id: string | null;
  positions: number;
  approval_status: string;
  recruiter_id: string | null;
  target_joining_date: string | null;
  created_at: string;
};
type Post = {
  id: string;
  category_id: string | null;
  platform: string;
  status: string;
  applications_received: number;
  cost: number | null;
  owner_id: string | null;
  posted_on: string;
};
type Task = {
  id: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
  completed_at: string | null;
};
type Intv = { id: string; status: string; scheduled_at: string };
type Off = {
  id: string;
  candidate_id: string;
  offer_status: string;
  expected_joining_date: string | null;
  created_at: string;
};
type Named = { id: string; name: string };
type Person = { id: string; full_name: string | null; email: string | null };
type Slice = { label: string; value: number; color: string };
type Row = { label: string; value: number };
type Tab = "overview" | "recruiters" | "sources" | "tasks";

/* ---------- constants ---------- */

const PIPE_SLICES = [
  { label: "New", stages: ["New"], color: "#38bdf8" },
  { label: "Contacted", stages: ["Contacted"], color: "#1d6fd8" },
  { label: "Screening", stages: ["Screening"], color: "#8a9bb8" },
  { label: "Interviews", stages: ["Interview Scheduled", "Interview Completed"], color: "#5b3fb4" },
  { label: "Selected & offer", stages: ["Selected", "Offer Released", "Offer Accepted"], color: "#f87171" },
  { label: "Joined", stages: ["Joined"], color: "#10b981" },
  { label: "On hold", stages: ["On Hold"], color: "#fbbf24" },
  { label: "Closed out", stages: ["Rejected", "Withdrawn", "Did Not Join"], color: "#64748b" },
];

const DROP_SLICES = [
  { label: "Rejected", color: "#f87171" },
  { label: "Withdrawn", color: "#f59e0b" },
  { label: "Did Not Join", color: "#8b5cf6" },
  { label: "On Hold", color: "#38bdf8" },
];

const INACTIVE = ["Joined", "Rejected", "Withdrawn", "Did Not Join", "On Hold"];

const PALETTE = ["#1d6fd8", "#38bdf8", "#5b3fb4", "#8a9bb8", "#f87171", "#4ade80", "#14b8a6", "#f59e0b"];

const VAC_COLORS: Record<string, string> = {
  Draft: "#94a3b8",
  "Pending Approval": "#f59e0b",
  Approved: "#10b981",
  Rejected: "#ef4444",
  Closed: "#64748b",
};
const TASK_COLORS: Record<string, string> = {
  New: "#38bdf8",
  "In Progress": "#1d6fd8",
  "Waiting for Approval": "#8b5cf6",
  Blocked: "#ef4444",
  Completed: "#10b981",
  Cancelled: "#94a3b8",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TILE = {
  purple: "from-violet-700 to-indigo-500",
  navy: "from-blue-950 to-blue-700",
  cyan: "from-sky-700 to-cyan-500",
  green: "from-teal-600 to-emerald-400",
};

/* ---------- helpers ---------- */

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
const keyOfIso = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const keyOfDate = (s: string) => s.slice(0, 7);

function monthList(startOffset: number, count: number, now: Date) {
  const out: { key: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + startOffset + i, 1);
    out.push({
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
      label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
    });
  }
  return out;
}

function countBy(keys: string[], months: { key: string }[]): number[] {
  const map = new Map<string, number>();
  for (const k of keys) map.set(k, (map.get(k) ?? 0) + 1);
  return months.map((m) => map.get(m.key) ?? 0);
}

function sumBy(items: { key: string; n: number }[], months: { key: string }[]): number[] {
  const map = new Map<string, number>();
  for (const it of items) map.set(it.key, (map.get(it.key) ?? 0) + it.n);
  return months.map((m) => map.get(m.key) ?? 0);
}

function tally<T>(items: T[], getLabel: (t: T) => string | null | undefined, fallback = "Not recorded"): Row[] {
  const map = new Map<string, Row>();
  for (const it of items) {
    const label = (getLabel(it) ?? "").trim() || fallback;
    const key = label.toLowerCase();
    const cur = map.get(key);
    if (cur) cur.value += 1;
    else map.set(key, { label, value: 1 });
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

function toSlices(rows: Row[], n = 7): Slice[] {
  const top = rows.slice(0, n);
  const rest = rows.slice(n).reduce((s, r) => s + r.value, 0);
  const all = rest > 0 ? [...top, { label: "Other", value: rest }] : top;
  return all.map((r, i) => ({ ...r, color: PALETTE[i % PALETTE.length] }));
}

function averageOf(a: Partial<Record<ScoreKey, number | null>>): number | null {
  const vals = SCORE_CRITERIA.map((c) => a[c.key]).filter((v): v is number => typeof v === "number");
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "-");
const niceMax = (v: number) => {
  if (v <= 4) return 4;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 4, 5, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
};
const short = (s: string, n = 16) => (s.length > n ? `${s.slice(0, n - 1)}...` : s);

/* ---------- small UI pieces ---------- */

const selectCls =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ text = "No data for these filters." }: { text?: string }) {
  return <p className="py-8 text-center text-sm text-slate-400">{text}</p>;
}

function Tile({ label, value, tone, hint }: { label: string; value: string | number; tone: keyof typeof TILE; hint?: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${TILE[tone]} p-4 text-white shadow-sm`}>
      <p className="text-xs font-medium text-white/80">{label}</p>
      <p className="mt-1 text-2xl font-bold sm:text-3xl">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-white/70">{hint}</p>}
    </div>
  );
}

function Donut({ slices, centreLabel }: { slices: Slice[]; centreLabel: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <Empty />;

  const cx = 170;
  const cy = 112;
  const R = 58;
  const SW = 26;
  const C = 2 * Math.PI * R;

  let acc = 0;
  const parts = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const frac = s.value / total;
      const start = acc;
      acc += frac;
      return { ...s, frac, start };
    });

  const lastY = { left: -999, right: -999 };
  const labels: { key: string; x: number; y: number; anchor: "start" | "end"; text: string }[] = [];
  for (const p of parts) {
    if (p.frac < 0.035) continue;
    const mid = (p.start + p.frac / 2) * 2 * Math.PI - Math.PI / 2;
    const rr = R + SW / 2 + 8;
    const x = cx + rr * Math.cos(mid);
    const y = cy + rr * Math.sin(mid);
    const side = Math.cos(mid) >= 0 ? "right" : "left";
    if (Math.abs(y - lastY[side]) < 13) continue;
    lastY[side] = y;
    labels.push({
      key: p.label,
      x,
      y,
      anchor: side === "right" ? "start" : "end",
      text: `${short(p.label)} ${(p.frac * 100).toFixed(1)}%`,
    });
  }

  return (
    <div>
      <svg viewBox="0 0 340 224" className="mx-auto w-full max-w-md" role="img" aria-label={`${centreLabel}: ${total}`}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e2e8f0" strokeWidth={SW} />
        {parts.map((p) => {
          const len = p.frac * C;
          return (
            <circle
              key={p.label}
              cx={cx}
              cy={cy}
              r={R}
              fill="none"
              stroke={p.color}
              strokeWidth={SW}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-p.start * C}
              transform={`rotate(-90 ${cx} ${cy})`}
            >
              <title>
                {p.label}: {p.value} ({(p.frac * 100).toFixed(1)}%)
              </title>
            </circle>
          );
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" className="fill-slate-900" fontSize="22" fontWeight="700">
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-500" fontSize="10">
          {centreLabel}
        </text>
        {labels.map((l) => (
          <text key={l.key} x={l.x + (l.anchor === "start" ? 4 : -4)} y={l.y + 3} textAnchor={l.anchor} fontSize="10.5" className="fill-slate-600">
            {l.text}
          </text>
        ))}
      </svg>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="shrink-0 font-medium text-slate-900">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bars({ rows, color = "#1d6fd8", max, format }: { rows: Row[]; color?: string; max?: number; format?: (n: number) => string }) {
  if (rows.length === 0) return <Empty />;
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between text-xs text-slate-600">
            <span className="truncate pr-2">{r.label}</span>
            <span className="shrink-0 font-medium text-slate-900">{format ? format(r.value) : r.value}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${Math.min(100, (r.value / top) * 100)}%`, backgroundColor: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DualLine({
  months,
  a,
  b,
  aLabel,
  bLabel,
}: {
  months: { label: string }[];
  a: number[];
  b: number[];
  aLabel: string;
  bLabel: string;
}) {
  if (a.every((v) => v === 0) && b.every((v) => v === 0)) return <Empty />;

  const W = 640;
  const H = 250;
  const L = 40;
  const Rm = 40;
  const T = 14;
  const B = 34;
  const iw = W - L - Rm;
  const ih = H - T - B;
  const maxA = niceMax(Math.max(1, ...a));
  const maxB = niceMax(Math.max(1, ...b));
  const n = months.length;
  const x = (i: number) => L + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const yA = (v: number) => T + ih - (v / maxA) * ih;
  const yB = (v: number) => T + ih - (v / maxB) * ih;
  const path = (vals: number[], y: (v: number) => number) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <div>
      <div className="mb-1 flex flex-wrap justify-end gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-800" /> {aLabel} (left)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> {bLabel} (right)
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${aLabel} and ${bLabel} by month`}>
        {[0, 1, 2, 3, 4].map((g) => {
          const yy = T + (ih / 4) * g;
          return (
            <g key={g}>
              <line x1={L} x2={W - Rm} y1={yy} y2={yy} stroke="#e2e8f0" />
              <text x={L - 6} y={yy + 3} textAnchor="end" fontSize="10" className="fill-slate-500">
                {Math.round(maxA - (maxA / 4) * g)}
              </text>
              <text x={W - Rm + 6} y={yy + 3} textAnchor="start" fontSize="10" className="fill-slate-500">
                {Math.round(maxB - (maxB / 4) * g)}
              </text>
            </g>
          );
        })}
        {months.map((m, i) =>
          i % 2 === 0 || n <= 6 ? (
            <text key={m.label} x={x(i)} y={H - 12} textAnchor="middle" fontSize="10" className="fill-slate-500">
              {m.label}
            </text>
          ) : null
        )}
        <path d={path(a, yA)} fill="none" stroke="#1e40af" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={path(b, yB)} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinejoin="round" />
        {a.map((v, i) => (
          <circle key={`a${i}`} cx={x(i)} cy={yA(v)} r="3.5" fill="#1e40af">
            <title>
              {months[i].label} - {aLabel}: {v}
            </title>
          </circle>
        ))}
        {b.map((v, i) => (
          <circle key={`b${i}`} cx={x(i)} cy={yB(v)} r="3.5" fill="#38bdf8">
            <title>
              {months[i].label} - {bLabel}: {v}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

/* ---------- main ---------- */

export default function DashboardClient({
  canSeeRecruitment,
  canSeeOffers,
  candidates,
  joinedEvents,
  assessments,
  vacancies,
  postings,
  tasks,
  interviews,
  offers,
  categories,
  people,
}: {
  canSeeRecruitment: boolean;
  canSeeOffers: boolean;
  candidates: Cand[];
  joinedEvents: JoinedEvent[];
  assessments: Assess[];
  vacancies: Vac[];
  postings: Post[];
  tasks: Task[];
  interviews: Intv[];
  offers: Off[];
  categories: Named[];
  people: Person[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(canSeeRecruitment ? "overview" : "tasks");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [categoryF, setCategoryF] = useState("");
  const [recruiterF, setRecruiterF] = useState("");
  const [sourceF, setSourceF] = useState("");
  const [stageF, setStageF] = useState("");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  if (now === null) {
    return <div className="p-8 text-sm text-slate-500">Loading dashboard...</div>;
  }

  const today = now.toLocaleDateString("en-CA");
  const nowMs = now.getTime();

  const personName = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Unknown";
  };
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorised";

  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);

  const stageGroup = PIPE_SLICES.find((g) => g.label === stageF);

  /* candidate sets */
  const trendCands = candidates.filter(
    (c) => (!categoryF || c.category_id === categoryF) && (!recruiterF || c.recruiter_id === recruiterF)
  );
  const trendIds = new Set(trendCands.map((c) => c.id));
  const fCands = trendCands.filter(
    (c) =>
      inRange(localDate(c.created_at)) &&
      (!sourceF || c.source === sourceF) &&
      (!stageGroup || stageGroup.stages.includes(c.status))
  );
  const fIds = new Set(fCands.map((c) => c.id));

  /* vacancies, postings, tasks */
  const trendVacs = vacancies.filter(
    (v) => (!categoryF || v.category_id === categoryF) && (!recruiterF || v.recruiter_id === recruiterF)
  );
  const fVacs = trendVacs.filter((v) => inRange(localDate(v.created_at)));
  const fPosts = postings.filter(
    (p) => inRange(p.posted_on) && (!categoryF || p.category_id === categoryF) && (!recruiterF || p.owner_id === recruiterF)
  );
  const taskScope = tasks.filter((t) => !recruiterF || t.assigned_to === recruiterF);
  const fTasks = taskScope.filter((t) => inRange(localDate(t.created_at)));

  /* joined dates: earliest per candidate */
  const joinedAt = new Map<string, string>();
  for (const e of joinedEvents) {
    const cur = joinedAt.get(e.candidate_id);
    if (!cur || e.created_at < cur) joinedAt.set(e.candidate_id, e.created_at);
  }

  /* latest assessment per candidate */
  const latest = new Map<string, Assess>();
  for (const a of assessments) if (!latest.has(a.candidate_id)) latest.set(a.candidate_id, a);
  const scored = Array.from(latest.values()).filter((a) => fIds.has(a.candidate_id));
  const scoreRows: Row[] = SCORE_CRITERIA.map((crit) => {
    const vals = scored.map((a) => a[crit.key]).filter((v): v is number => typeof v === "number");
    return { label: crit.label, value: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0 };
  }).filter((r) => r.value > 0);

  /* KPIs */
  const joinedCount = fCands.filter((c) => c.status === "Joined").length;
  const activeCount = fCands.filter((c) => !INACTIVE.includes(c.status)).length;
  const approvedVacs = fVacs.filter((v) => v.approval_status === "Approved");
  const openPositions = approvedVacs.reduce((s, v) => s + v.positions, 0);

  const daysToHire: number[] = [];
  for (const c of fCands) {
    const j = joinedAt.get(c.id);
    if (c.status === "Joined" && j) {
      daysToHire.push(Math.max(0, (new Date(j).getTime() - new Date(c.created_at).getTime()) / 86400000));
    }
  }
  const avgDays = daysToHire.length ? (daysToHire.reduce((s, v) => s + v, 0) / daysToHire.length).toFixed(1) : "-";

  const offersInPeriod = offers.filter((o) => inRange(localDate(o.created_at)));
  const accepted = offersInPeriod.filter((o) => o.offer_status === "Accepted").length;
  const decided = offersInPeriod.filter((o) => ["Accepted", "Declined", "Expired"].includes(o.offer_status)).length;
  const offerRate = canSeeOffers ? pct(accepted, decided) : "-";

  const upcoming = interviews.filter((i) => i.status === "Scheduled" && new Date(i.scheduled_at).getTime() >= nowMs).length;

  const ageDays = trendVacs
    .filter((v) => v.approval_status === "Approved")
    .map((v) => (nowMs - new Date(v.created_at).getTime()) / 86400000);
  const avgVacAge = ageDays.length ? (ageDays.reduce((s, v) => s + v, 0) / ageDays.length).toFixed(1) : "-";

  /* time series */
  const past = monthList(-11, 12, now);
  const future = monthList(0, 12, now);
  const addedSeries = countBy(trendCands.map((c) => keyOfIso(c.created_at)), past);
  const joinedSeries = countBy(
    Array.from(joinedAt.entries())
      .filter(([id]) => trendIds.has(id))
      .map(([, iso]) => keyOfIso(iso)),
    past
  );

  const dueSeries = sumBy(
    trendVacs
      .filter((v) => v.approval_status === "Approved" && v.target_joining_date)
      .map((v) => ({ key: keyOfDate(v.target_joining_date as string), n: v.positions })),
    future
  );
  const statusById = new Map(candidates.map((c) => [c.id, c.status]));
  const expectedSeries = countBy(
    offers
      .filter((o) => o.offer_status === "Accepted" && o.expected_joining_date && statusById.get(o.candidate_id) !== "Joined")
      .map((o) => keyOfDate(o.expected_joining_date as string)),
    future
  );

  /* donuts */
  const pipeSlices: Slice[] = PIPE_SLICES.map((g) => ({
    label: g.label,
    value: fCands.filter((c) => g.stages.includes(c.status)).length,
    color: g.color,
  }));
  const dropSlices: Slice[] = DROP_SLICES.map((d) => ({
    label: d.label,
    value: fCands.filter((c) => c.status === d.label).length,
    color: d.color,
  }));
  const vacSlices: Slice[] = Object.keys(VAC_COLORS)
    .map((s) => ({ label: s, value: fVacs.filter((v) => v.approval_status === s).length, color: VAC_COLORS[s] }))
    .filter((s) => s.value > 0);
  const categorySlices = toSlices(tally(fCands, (c) => (c.category_id ? categoryName(c.category_id) : null), "Uncategorised"));
  const sourceSlices = toSlices(tally(fCands, (c) => c.source));
  const locationRows = tally(fCands, (c) => c.location_applied).slice(0, 8);

  /* recruiters */
  const recruiterIds = Array.from(new Set(fCands.map((c) => c.recruiter_id)));
  const recruiterTable = recruiterIds
    .map((id) => {
      const mine = fCands.filter((c) => c.recruiter_id === id);
      const vals = mine
        .map((c) => latest.get(c.id))
        .filter((a): a is Assess => !!a)
        .map((a) => averageOf(a))
        .filter((v): v is number => v !== null);
      return {
        name: personName(id),
        total: mine.length,
        active: mine.filter((c) => !INACTIVE.includes(c.status)).length,
        joined: mine.filter((c) => c.status === "Joined").length,
        score: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null,
      };
    })
    .sort((a, b) => b.total - a.total);

  /* sources */
  const sourceTable = tally(fCands, (c) => c.source).map((r) => {
    const mine = fCands.filter((c) => (c.source ?? "Not recorded").toLowerCase() === r.label.toLowerCase());
    return { source: r.label, total: r.value, joined: mine.filter((c) => c.status === "Joined").length };
  });

  /* postings */
  const platformRows = tally(fPosts, (p) => p.platform).map((r) => {
    const mine = fPosts.filter((p) => p.platform.toLowerCase() === r.label.toLowerCase());
    const apps = mine.reduce((s, p) => s + p.applications_received, 0);
    const cost = mine.reduce((s, p) => s + (p.cost ?? 0), 0);
    const hasCost = mine.some((p) => p.cost != null);
    return { platform: r.label, postings: r.value, apps, perApp: hasCost && apps > 0 ? cost / apps : null };
  });
  const maxApps = Math.max(1, ...platformRows.map((r) => r.apps));

  /* tasks */
  const openTasks = taskScope.filter((t) => t.status !== "Completed" && t.status !== "Cancelled");
  const overdueTasks = openTasks.filter((t) => t.due_date && t.due_date < today).length;
  const weekAhead = new Date(now);
  weekAhead.setDate(weekAhead.getDate() + 7);
  const weekStr = weekAhead.toLocaleDateString("en-CA");
  const dueSoon = openTasks.filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekStr).length;
  const doneTasks = fTasks.filter((t) => t.status === "Completed").length;
  const countedTasks = fTasks.filter((t) => t.status !== "Cancelled").length;
  const taskSlices: Slice[] = Object.keys(TASK_COLORS)
    .map((s) => ({ label: s, value: fTasks.filter((t) => t.status === s).length, color: TASK_COLORS[s] }))
    .filter((s) => s.value > 0);
  const ownerRows = tally(openTasks, (t) => personName(t.assigned_to)).slice(0, 10);
  const createdSeries = countBy(taskScope.map((t) => keyOfIso(t.created_at)), past);
  const completedSeries = countBy(
    taskScope.filter((t) => t.completed_at).map((t) => keyOfIso(t.completed_at as string)),
    past
  );

  const sourceOptions = Array.from(new Set([...SOURCES, ...candidates.map((c) => c.source).filter((s): s is string => !!s)]));
  const recruiters = people.filter((p) => p.full_name || p.email);
  const filtersActive = !!(from || to || categoryF || recruiterF || sourceF || stageF);

  function preset(days: number | "year" | "all") {
    if (days === "all") {
      setFrom("");
      setTo("");
      return;
    }
    const d = new Date();
    if (days === "year") d.setMonth(0, 1);
    else d.setDate(d.getDate() - days);
    setFrom(d.toLocaleDateString("en-CA"));
    setTo("");
  }

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "overview", label: "Overview", show: canSeeRecruitment },
    { key: "recruiters", label: "Recruiters", show: canSeeRecruitment },
    { key: "sources", label: "Sources & postings", show: canSeeRecruitment },
    { key: "tasks", label: "Tasks", show: true },
  ];

  const offersNote = !canSeeOffers ? "Offer figures need HR Head, Recruitment Lead or HR Operations access" : undefined;

  return (
    <div className="mx-auto max-w-[1700px] p-3 md:p-6">
      <div className="rounded-3xl bg-gradient-to-br from-sky-100 via-slate-50 to-indigo-100 p-3 md:p-5">
        {/* banner */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-800 px-5 py-4 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-lg font-bold">S</div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Recruitment dashboard</h1>
              <p className="text-xs text-white/70">SPARRC - live from your database</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2" aria-label="Dashboard sections">
            {tabs
              .filter((t) => t.show)
              .map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    tab === t.key ? "bg-white text-blue-950" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            <button
              onClick={() => router.refresh()}
              className="ml-1 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
              aria-label="Refresh data"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </nav>
        </header>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
          {/* content */}
          <div className="min-w-0">
            {!canSeeRecruitment && (
              <p className="mb-4 rounded-xl bg-white/80 p-3 text-sm text-slate-600">
                Recruitment data is limited to recruitment roles, so only task figures are shown for your role.
              </p>
            )}

            {tab === "overview" && canSeeRecruitment && (
              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Tile label="Total candidates" value={fCands.length} tone="purple" />
                    <Tile label="Joining rate" value={pct(joinedCount, fCands.length)} tone="navy" hint={`${joinedCount} joined`} />
                    <Tile label="Offer acceptance" value={offerRate} tone="cyan" hint={offersNote ?? `${accepted} of ${decided} decided`} />
                    <Tile label="Avg days to hire" value={avgDays} tone="green" hint="Added to joined" />
                    <Tile label="Active pipeline" value={activeCount} tone="purple" />
                    <Tile label="Open positions" value={openPositions} tone="navy" hint={`${approvedVacs.length} approved vacancies`} />
                    <Tile label="Upcoming interviews" value={upcoming} tone="cyan" hint="Right now" />
                    <Tile label="Avg vacancy age (days)" value={avgVacAge} tone="green" hint="Approved vacancies" />
                  </div>

                  <Panel title="Candidates added vs joined (last 12 months)" subtitle="Ignores the report date; respects category and recruiter">
                    <DualLine months={past} a={addedSeries} b={joinedSeries} aLabel="Candidates added" bLabel="Joined" />
                  </Panel>
                  <Panel
                    title="Hiring projection (next 12 months)"
                    subtitle={
                      canSeeOffers
                        ? "Approved positions by target joining date vs accepted offers expected to join (offers ignore the category filter)"
                        : "Approved positions by target joining date. Offer figures need HR Head, Recruitment Lead or HR Operations access"
                    }
                  >
                    <DualLine months={future} a={dueSeries} b={expectedSeries} aLabel="Positions due" bLabel="Accepted offers expected" />
                  </Panel>
                </div>

                <div className="space-y-4">
                  <Panel title="Recruitment pipeline" subtitle="Where candidates are now">
                    <Donut slices={pipeSlices} centreLabel="candidates" />
                  </Panel>
                  <Panel title="Where candidates drop out" subtitle="Reasons are not recorded yet, so this shows the stage they left from">
                    <Donut slices={dropSlices} centreLabel="candidates" />
                  </Panel>
                  <Panel title="Average candidate scores" subtitle={`Latest assessment per candidate, out of ${SCORE_MAX} (${scored.length} assessed)`}>
                    <Bars rows={scoreRows} max={SCORE_MAX} color="#10b981" format={(n) => n.toFixed(1)} />
                  </Panel>
                </div>
              </div>
            )}

            {tab === "recruiters" && canSeeRecruitment && (
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel title="Pipeline workload" subtitle="Candidates currently in the pipeline">
                    <Bars
                      rows={tally(fCands.filter((c) => !INACTIVE.includes(c.status)), (c) => personName(c.recruiter_id)).slice(0, 10)}
                      color="#5b3fb4"
                    />
                  </Panel>
                  <Panel title="Joined by recruiter">
                    <Bars
                      rows={tally(fCands.filter((c) => c.status === "Joined"), (c) => personName(c.recruiter_id)).slice(0, 10)}
                      color="#10b981"
                    />
                  </Panel>
                </div>
                <Panel title="Recruiter summary">
                  {recruiterTable.length === 0 ? (
                    <Empty />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase text-slate-400">
                          <tr>
                            <th className="pb-2 font-medium">Recruiter</th>
                            <th className="pb-2 text-right font-medium">Candidates</th>
                            <th className="pb-2 text-right font-medium">In pipeline</th>
                            <th className="pb-2 text-right font-medium">Joined</th>
                            <th className="pb-2 text-right font-medium">Joining rate</th>
                            <th className="pb-2 text-right font-medium">Avg score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recruiterTable.map((r) => (
                            <tr key={r.name}>
                              <td className="py-2 font-medium text-slate-900">{r.name}</td>
                              <td className="py-2 text-right text-slate-700">{r.total}</td>
                              <td className="py-2 text-right text-slate-700">{r.active}</td>
                              <td className="py-2 text-right text-slate-700">{r.joined}</td>
                              <td className="py-2 text-right text-slate-700">{pct(r.joined, r.total)}</td>
                              <td className="py-2 text-right text-slate-700">{r.score === null ? "-" : `${r.score.toFixed(1)} / ${SCORE_MAX}`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              </div>
            )}

            {tab === "sources" && canSeeRecruitment && (
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel title="Candidates by source">
                    <Donut slices={sourceSlices} centreLabel="candidates" />
                  </Panel>
                  <Panel title="Candidates by role category">
                    <Donut slices={categorySlices} centreLabel="candidates" />
                  </Panel>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel title="Source performance" subtitle="How many candidates from each source reached Joined">
                    {sourceTable.length === 0 ? (
                      <Empty />
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase text-slate-400">
                          <tr>
                            <th className="pb-2 font-medium">Source</th>
                            <th className="pb-2 text-right font-medium">Candidates</th>
                            <th className="pb-2 text-right font-medium">Joined</th>
                            <th className="pb-2 text-right font-medium">Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sourceTable.map((r) => (
                            <tr key={r.source}>
                              <td className="py-2 text-slate-800">{r.source}</td>
                              <td className="py-2 text-right text-slate-700">{r.total}</td>
                              <td className="py-2 text-right text-slate-700">{r.joined}</td>
                              <td className="py-2 text-right text-slate-700">{pct(r.joined, r.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Panel>
                  <Panel title="Top locations applied for">
                    <Bars rows={locationRows} color="#38bdf8" />
                  </Panel>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel title="Job postings by platform" subtitle="Postings, applications and cost per application">
                    {platformRows.length === 0 ? (
                      <Empty />
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase text-slate-400">
                          <tr>
                            <th className="pb-2 font-medium">Platform</th>
                            <th className="pb-2 text-right font-medium">Posts</th>
                            <th className="pb-2 text-right font-medium">Applications</th>
                            <th className="pb-2 text-right font-medium">Cost / app</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {platformRows.map((r) => (
                            <tr key={r.platform}>
                              <td className="py-2 text-slate-800">{r.platform}</td>
                              <td className="py-2 text-right text-slate-600">{r.postings}</td>
                              <td className="py-2 text-right">
                                <span className="text-slate-900">{r.apps}</span>
                                <div className="ml-auto mt-1 h-1.5 w-16 rounded-full bg-slate-100">
                                  <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${(r.apps / maxApps) * 100}%` }} />
                                </div>
                              </td>
                              <td className="py-2 text-right text-slate-600">
                                {r.perApp === null ? "-" : r.perApp.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Panel>
                  <Panel title="Vacancy status" subtitle="Vacancies by approval status">
                    <Donut slices={vacSlices} centreLabel="vacancies" />
                  </Panel>
                </div>
              </div>
            )}

            {tab === "tasks" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Tile label="Open tasks" value={openTasks.length} tone="purple" />
                  <Tile label="Overdue" value={overdueTasks} tone="navy" hint="Right now" />
                  <Tile label="Completion rate" value={pct(doneTasks, countedTasks)} tone="cyan" hint={`${doneTasks} of ${countedTasks}, cancelled excluded`} />
                  <Tile label="Due in 7 days" value={dueSoon} tone="green" hint="Right now" />
                </div>
                <Panel title="Tasks created vs completed (last 12 months)" subtitle="Ignores the report date; respects the recruiter filter">
                  <DualLine months={past} a={createdSeries} b={completedSeries} aLabel="Created" bLabel="Completed" />
                </Panel>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel title="Task status">
                    <Donut slices={taskSlices} centreLabel="tasks" />
                  </Panel>
                  <Panel title="Open tasks by owner">
                    <Bars rows={ownerRows} color="#f59e0b" />
                  </Panel>
                </div>
              </div>
            )}
          </div>

          {/* filters */}
          <aside className="order-first space-y-4 xl:order-last xl:sticky xl:top-4 xl:self-start">
            <section className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Filters</h2>

              <p className="mt-4 text-xs font-medium text-slate-500">Report date</p>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={selectCls} aria-label="From date" />
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={selectCls} aria-label="To date" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ["30 days", 30],
                    ["90 days", 90],
                    ["This year", "year"],
                    ["All time", "all"],
                  ] as const
                ).map(([label, v]) => (
                  <button
                    key={label}
                    onClick={() => preset(v)}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="mt-4 block text-xs font-medium text-slate-500">Role category</label>
              <select value={categoryF} onChange={(e) => setCategoryF(e.target.value)} className={selectCls}>
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <label className="mt-3 block text-xs font-medium text-slate-500">Recruiter</label>
              <select value={recruiterF} onChange={(e) => setRecruiterF(e.target.value)} className={selectCls}>
                <option value="">All</option>
                {recruiters.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                ))}
              </select>

              <label className="mt-3 block text-xs font-medium text-slate-500">Source</label>
              <select value={sourceF} onChange={(e) => setSourceF(e.target.value)} className={selectCls}>
                <option value="">All</option>
                {sourceOptions.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>

              <label className="mt-3 block text-xs font-medium text-slate-500">Pipeline stage</label>
              <select value={stageF} onChange={(e) => setStageF(e.target.value)} className={selectCls}>
                <option value="">All</option>
                {PIPE_SLICES.map((g) => (
                  <option key={g.label}>{g.label}</option>
                ))}
              </select>

              {filtersActive && (
                <button
                  onClick={() => {
                    setFrom("");
                    setTo("");
                    setCategoryF("");
                    setRecruiterF("");
                    setSourceF("");
                    setStageF("");
                  }}
                  className="mt-4 text-sm font-medium text-indigo-600 hover:underline"
                >
                  Reset filters
                </button>
              )}
            </section>

            <section className="rounded-2xl border border-white bg-white/90 p-5 text-xs text-slate-500 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">How the numbers work</h2>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Joining rate: joined candidates divided by all candidates in the selection.</li>
                <li>Avg days to hire: from the date a candidate was added to the date joining was confirmed.</li>
                <li>Offer acceptance: accepted offers divided by accepted, declined and expired offers.</li>
                <li>The date range filters on the date a record was created or posted.</li>
                <li>You only see records your role allows.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}