"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/nav";

type Interview = {
  id: string;
  candidate_id: string;
  candidate_name: string;
  round: string;
  interviewer_id: string | null;
  scheduled_at: string;
  mode: string;
  location: string | null;
  status: string;
  rating: number | null;
  feedback: string | null;
  outcome: string;
};
type CandLite = { id: string; full_name: string; status: string };
type Person = { id: string; full_name: string | null; email: string | null };
type EventRow = { id: string; author_id: string; body: string; created_at: string };

const ROUNDS = ["HR Screening", "Assessment", "Technical Interview", "Final Interview"];
const MODES = ["In person", "Video", "Phone"];
const STATUSES = ["Scheduled", "Completed", "Cancelled", "No Show"];
const OUTCOMES = ["Pending", "Recommend", "Do not recommend", "On hold"];
const CLOSED = ["Joined", "Rejected", "Withdrawn", "Did Not Join"];

const STATUS_STYLE: Record<string, string> = {
  Scheduled: "bg-blue-50 text-blue-700",
  Completed: "bg-green-50 text-green-700",
  Cancelled: "bg-slate-100 text-slate-500",
  "No Show": "bg-red-50 text-red-700",
};

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function InterviewsClient({
  userId,
  role,
  interviews,
  candidates,
  people,
  loadError,
}: {
  userId: string;
  role: Role;
  interviews: Interview[];
  candidates: CandLite[];
  people: Person[];
  loadError: string;
}) {
  const router = useRouter();
  const canSchedule = ["super_admin", "hr_head", "recruitment_lead", "hr_executive"].includes(role);

  const [view, setView] = useState<"upcoming" | "past" | "all">("upcoming");
  const [q, setQ] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const personName = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Unknown";
  };

  const rows = interviews
    .filter((i) => {
      if (view === "upcoming" && i.status !== "Scheduled") return false;
      if (view === "past" && i.status === "Scheduled") return false;
      if (mineOnly && i.interviewer_id !== userId) return false;
      if (q && !i.candidate_name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) =>
      view === "past"
        ? b.scheduled_at.localeCompare(a.scheduled_at)
        : a.scheduled_at.localeCompare(b.scheduled_at)
    );

  const needsUpdate = (i: Interview) =>
    now !== null && i.status === "Scheduled" && new Date(i.scheduled_at).getTime() < now;

  const selected = interviews.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Interviews</h1>
          <p className="mt-1 text-sm text-slate-500">Schedule interviews, record feedback and keep a history.</p>
        </div>
        {canSchedule && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Schedule interview
          </button>
        )}
      </div>

      {loadError && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load interviews: {loadError}</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {(
            [
              ["upcoming", "Upcoming"],
              ["past", "Completed / closed"],
              ["all", "All"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === key ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search candidate"
            className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
          Interviews I am conducting
        </label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {interviews.length === 0
              ? "No interviews yet. Click Schedule interview to add one."
              : "No interviews match these filters."}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Candidate</th>
                <th className="px-4 py-2 font-medium">Round</th>
                <th className="px-4 py-2 font-medium">Interviewer</th>
                <th className="px-4 py-2 font-medium">Mode</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((i) => (
                <tr key={i.id} onClick={() => setSelectedId(i.id)} className="cursor-pointer hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-900">
                    <span suppressHydrationWarning>{fmt(i.scheduled_at)}</span>
                    {needsUpdate(i) && (
                      <p className="text-xs font-medium text-red-600">Time has passed - update status</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{i.candidate_name}</td>
                  <td className="px-4 py-3 text-slate-600">{i.round}</td>
                  <td className="px-4 py-3 text-slate-600">{personName(i.interviewer_id)}</td>
                  <td className="px-4 py-3 text-slate-600">{i.mode}</td>
                  <td className="px-4 py-3">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[i.status]}`}>
                      {i.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{i.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <NewInterviewModal
          userId={userId}
          candidates={candidates.filter((c) => !CLOSED.includes(c.status))}
          people={people}
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false);
            router.refresh();
          }}
        />
      )}
      {selected && (
        <InterviewDrawer
          key={selected.id}
          interview={selected}
          candidates={candidates}
          people={people}
          personName={personName}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function NewInterviewModal({
  userId,
  candidates,
  people,
  onClose,
  onDone,
}: {
  userId: string;
  candidates: CandLite[];
  people: Person[];
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [candidateId, setCandidateId] = useState("");
  const [round, setRound] = useState("HR Screening");
  const [interviewerId, setInterviewerId] = useState(userId);
  const [when, setWhen] = useState("");
  const [mode, setMode] = useState("In person");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const cand = candidates.find((c) => c.id === candidateId);
    if (!cand) return;
    setSaving(true);
    setError("");
    const iso = new Date(when).toISOString();
    const { data, error } = await supabase
      .from("interviews")
      .insert({
        candidate_id: cand.id,
        candidate_name: cand.full_name,
        round,
        interviewer_id: interviewerId || null,
        scheduled_at: iso,
        mode,
        location: location.trim() || null,
      })
      .select("id")
      .single();
    if (error || !data) {
      setError(error?.message ?? "Could not schedule the interview.");
      setSaving(false);
      return;
    }
    await supabase
      .from("interview_events")
      .insert({ interview_id: data.id, body: `Interview scheduled for ${fmt(iso)} (${round})` });

    if (["New", "Contacted", "Screening"].includes(cand.status)) {
       const order = ["Applied", "HR Screening", "Assessment", "Technical Interview", "Final Interview"];
       const from = order.indexOf(cand.status);
       const to = order.indexOf(round);
       if (from !== -1 && to !== -1 && from < to) {
         const moved = await supabase
           .from("candidates")
           .update({ status: round })
           .eq("id", cand.id)
           .select("id");
         if (moved.data && moved.data.length > 0) {
           await supabase.from("candidate_stage_history").insert({
             candidate_id: cand.id,
             from_status: cand.status,
             to_status: round,
             note: `${round} scheduled`,
           });
         }
       }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Schedule interview</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">Candidate</label>
        <select value={candidateId} onChange={(e) => setCandidateId(e.target.value)} className={inputCls}>
          <option value="">Select a candidate</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name} ({c.status})
            </option>
          ))}
        </select>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Round</label>
            <select value={round} onChange={(e) => setRound(e.target.value)} className={inputCls}>
              {ROUNDS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Interviewer</label>
            <select value={interviewerId} onChange={(e) => setInterviewerId(e.target.value)} className={inputCls}>
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Date and time</label>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
              {MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">Meeting link or location</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} />

        <p className="mt-3 text-xs text-slate-500">
          This records the interview only. It does not email the candidate. If the candidate is still at New, Contacted or Screening, their stage moves to Interview Scheduled.
        </p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !candidateId || !when}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InterviewDrawer({
  interview,
  candidates,
  people,
  personName,
  onClose,
}: {
  interview: Interview;
  candidates: CandLite[];
  people: Person[];
  personName: (id: string | null) => string;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const iv = interview;

  const [events, setEvents] = useState<EventRow[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [when, setWhen] = useState(toLocalInput(iv.scheduled_at));
  const [mode, setMode] = useState(iv.mode);
  const [location, setLocation] = useState(iv.location ?? "");
  const [interviewerId, setInterviewerId] = useState(iv.interviewer_id ?? "");
  const [status, setStatus] = useState(iv.status);
  const [rating, setRating] = useState(iv.rating == null ? "" : String(iv.rating));
  const [outcome, setOutcome] = useState(iv.outcome);
  const [feedback, setFeedback] = useState(iv.feedback ?? "");

  async function loadEvents() {
    const { data } = await supabase
      .from("interview_events")
      .select("id, author_id, body, created_at")
      .eq("interview_id", iv.id)
      .order("created_at", { ascending: false });
    setEvents(data ?? []);
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iv.id]);

  async function save() {
    setSaving(true);
    setMsg("");
    const newIso = new Date(when).toISOString();
    const next = {
      scheduled_at: newIso,
      mode,
      location: location.trim() || null,
      interviewer_id: interviewerId || null,
      status,
      rating: rating ? Number(rating) : null,
      outcome,
      feedback: feedback.trim() || null,
    };

    const changes: string[] = [];
    if (new Date(iv.scheduled_at).getTime() !== new Date(newIso).getTime())
      changes.push(`Rescheduled from ${fmt(iv.scheduled_at)} to ${fmt(newIso)}`);
    if (iv.status !== next.status) changes.push(`Status: ${iv.status} to ${next.status}`);
    if (iv.mode !== next.mode) changes.push(`Mode: ${iv.mode} to ${next.mode}`);
    if ((iv.location ?? "") !== (next.location ?? "")) changes.push("Location or link updated");
    if ((iv.interviewer_id ?? "") !== (next.interviewer_id ?? ""))
      changes.push(`Interviewer: ${personName(iv.interviewer_id)} to ${personName(next.interviewer_id)}`);
    if ((iv.rating ?? null) !== next.rating) changes.push(`Rating: ${iv.rating ?? "none"} to ${next.rating ?? "none"}`);
    if (iv.outcome !== next.outcome) changes.push(`Outcome: ${iv.outcome} to ${next.outcome}`);
    if ((iv.feedback ?? "") !== (next.feedback ?? "")) changes.push("Feedback updated");

    if (changes.length === 0) {
      setMsg("Nothing has changed.");
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("interviews")
      .update(next)
      .eq("id", iv.id)
      .select("id");
    if (error || !data || data.length === 0) {
      setMsg(error?.message ?? "You do not have permission to change this interview.");
      setSaving(false);
      return;
    }
    await supabase.from("interview_events").insert({ interview_id: iv.id, body: changes.join("; ") });


    await loadEvents();
    router.refresh();
    setMsg("Saved.");
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{iv.candidate_name}</h2>
            <p className="mt-1 text-xs text-slate-500">{iv.round}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Date and time</label>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
              {MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Interviewer</label>
            <select value={interviewerId} onChange={(e) => setInterviewerId(e.target.value)} className={inputCls}>
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="mt-3 block text-xs font-medium text-slate-500">Meeting link or location</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Rating (1 to 5)</label>
            <select value={rating} onChange={(e) => setRating(e.target.value)} className={inputCls}>
              <option value="">Not rated</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Interviewer recommendation</label>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={inputCls}>
              {OUTCOMES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="mt-3 block text-xs font-medium text-slate-500">Feedback</label>
        <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} className={inputCls} />

        <p className="mt-2 text-xs text-slate-500">
          The recommendation is not a hiring decision. Use the Candidates page to select or reject.
        </p>
        {msg && <p className={`mt-3 text-sm ${msg === "Saved." ? "text-green-600" : "text-red-600"}`}>{msg}</p>}

        <button
          onClick={save}
          disabled={saving || !when}
          className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>

        <h3 className="mt-6 text-sm font-semibold text-slate-900">History</h3>
        <ul className="mt-3 space-y-2">
          {events.length === 0 && <li className="text-sm text-slate-500">No history yet.</li>}
          {events.map((e) => (
            <li key={e.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <p>{e.body}</p>
              <p className="mt-1 text-xs text-slate-400">
                {personName(e.author_id)} - {new Date(e.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}