"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/nav";

type Candidate = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  vacancy_id: string | null;
  preferred_centre_id: string | null;
  qualifications: string | null;
  experience_years: number | null;
  current_salary: number | null;
  expected_salary: number | null;
  notice_period: string | null;
  source: string | null;
  recruiter_id: string | null;
  followup_date: string | null;
  notes: string | null;
  status: string;
};
type VacLite = { id: string; title: string };
type Named = { id: string; name: string };
type Person = { id: string; full_name: string | null; email: string | null };
type HistoryRow = {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  changed_by: string;
  created_at: string;
};

const MAIN_STAGES = [
  "New",
  "Contacted",
  "Screening",
  "Interview Scheduled",
  "Interview Completed",
  "Selected",
  "Offer Released",
  "Offer Accepted",
  "Joined",
];
const OTHER_STAGES = ["On Hold", "Rejected", "Withdrawn", "Did Not Join"];
const ALL_STAGES = [...MAIN_STAGES, ...OTHER_STAGES];
const SOURCES = ["Job portal", "Referral", "Walk-in", "Social media", "Consultancy", "Campus", "Other"];

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";

const num = (v: string) => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const digits = (s: string | null) => (s ?? "").replace(/\D/g, "").slice(-10);

function findDuplicates(list: Candidate[], email: string, phone: string, excludeId?: string) {
  const e = email.trim().toLowerCase();
  const p = digits(phone);
  return list.filter(
    (c) =>
      c.id !== excludeId &&
      ((e && c.email?.toLowerCase() === e) || (p.length >= 8 && digits(c.phone) === p))
  );
}

export default function CandidatesClient({
  userId,
  candidates,
  vacancies,
  centres,
  people,
  loadError,
}: {
  userId: string;
  role: Role;
  candidates: Candidate[];
  vacancies: VacLite[];
  centres: Named[];
  people: Person[];
  loadError: string;
}) {
  const router = useRouter();
  const today = new Date().toLocaleDateString("en-CA");

  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [vacancyF, setVacancyF] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const vacancyTitle = (id: string | null) => vacancies.find((v) => v.id === id)?.title ?? "-";
  const personName = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Unknown";
  };

  const filtered = candidates.filter((c) => {
    if (statusF && c.status !== statusF) return false;
    if (vacancyF && c.vacancy_id !== vacancyF) return false;
    if (q) {
      const s = q.toLowerCase();
      const hay = `${c.full_name} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const selected = candidates.find((c) => c.id === selectedId) ?? null;
  const followupDue = (c: Candidate) =>
    !!c.followup_date && c.followup_date <= today && !["Joined", "Rejected", "Withdrawn", "Did Not Join"].includes(c.status);

  return (
    <div className="mx-auto max-w-full p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Candidates</h1>
          <p className="mt-1 text-sm text-slate-500">Track applicants from first contact to joining.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Add candidate
        </button>
      </div>

      {loadError && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load candidates: {loadError}</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {(["board", "list"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === k ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {k === "board" ? "Pipeline" : "List"}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone"
            className="w-64 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <select value={vacancyF} onChange={(e) => setVacancyF(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All vacancies</option>
          {vacancies.map((v) => (
            <option key={v.id} value={v.id}>{v.title}</option>
          ))}
        </select>
        {view === "list" && (
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">All stages</option>
            {ALL_STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {view === "board" ? (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-3">
          {ALL_STAGES.map((stage) => {
            const items = filtered.filter((c) => c.status === stage);
            return (
              <div key={stage} className="w-60 shrink-0 rounded-xl bg-slate-100 p-2">
                <p className="px-2 py-1 text-xs font-semibold uppercase text-slate-500">
                  {stage} ({items.length})
                </p>
                <div className="space-y-2">
                  {items.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-indigo-300"
                    >
                      <p className="text-sm font-medium text-slate-900">{c.full_name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{vacancyTitle(c.vacancy_id)}</p>
                      {c.followup_date && (
                        <p className={`mt-1 text-xs ${followupDue(c) ? "font-medium text-red-600" : "text-slate-400"}`}>
                          Follow-up {c.followup_date}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              {candidates.length === 0 ? "No candidates yet. Click Add candidate to start." : "No candidates match these filters."}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Vacancy</th>
                  <th className="px-4 py-2 font-medium">Stage</th>
                  <th className="px-4 py-2 font-medium">Phone</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Recruiter</th>
                  <th className="px-4 py-2 font-medium">Follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} onClick={() => setSelectedId(c.id)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.full_name}</td>
                    <td className="px-4 py-3 text-slate-600">{vacancyTitle(c.vacancy_id)}</td>
                    <td className="px-4 py-3">
                      <span className="whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.phone ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.source ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{personName(c.recruiter_id)}</td>
                    <td className={`whitespace-nowrap px-4 py-3 ${followupDue(c) ? "font-medium text-red-600" : "text-slate-600"}`}>
                      {c.followup_date ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showAdd && (
        <AddCandidateModal
          userId={userId}
          candidates={candidates}
          vacancies={vacancies}
          centres={centres}
          people={people}
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}
      {selected && (
        <CandidateDrawer
          key={selected.id}
          candidate={selected}
          candidates={candidates}
          vacancies={vacancies}
          people={people}
          personName={personName}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function AddCandidateModal({
  userId,
  candidates,
  vacancies,
  centres,
  people,
  onClose,
  onDone,
}: {
  userId: string;
  candidates: Candidate[];
  vacancies: VacLite[];
  centres: Named[];
  people: Person[];
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vacancyId, setVacancyId] = useState("");
  const [centreId, setCentreId] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [experience, setExperience] = useState("");
  const [expected, setExpected] = useState("");
  const [notice, setNotice] = useState("");
  const [source, setSource] = useState("");
  const [recruiterId, setRecruiterId] = useState(userId);
  const [followup, setFollowup] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const dups = findDuplicates(candidates, email, phone);

  async function save() {
    setSaving(true);
    setError("");
    const { data, error } = await supabase
      .from("candidates")
      .insert({
        full_name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        vacancy_id: vacancyId || null,
        preferred_centre_id: centreId || null,
        qualifications: qualifications.trim() || null,
        experience_years: num(experience),
        expected_salary: num(expected),
        notice_period: notice.trim() || null,
        source: source || null,
        recruiter_id: recruiterId || null,
        followup_date: followup || null,
        status: "New",
      })
      .select("id")
      .single();
    if (error || !data) {
      setError(error?.message ?? "Could not save the candidate.");
      setSaving(false);
      return;
    }
    await supabase
      .from("candidate_stage_history")
      .insert({ candidate_id: data.id, from_status: null, to_status: "New", note: "Candidate added" });
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Add candidate</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">Full name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
          </div>
        </div>

        {dups.length > 0 && (
          <p className="mt-3 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
            Possible duplicate: {dups.map((d) => `${d.full_name} (${d.status})`).join(", ")}. You can still save, but check first. You can only be warned about candidates you are allowed to see.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Applied vacancy</label>
            <select value={vacancyId} onChange={(e) => setVacancyId(e.target.value)} className={inputCls}>
              <option value="">None</option>
              {vacancies.map((v) => (
                <option key={v.id} value={v.id}>{v.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Preferred centre</label>
            <select value={centreId} onChange={(e) => setCentreId(e.target.value)} className={inputCls}>
              <option value="">None</option>
              {centres.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Experience (years)</label>
            <input type="number" min={0} step="0.5" value={experience} onChange={(e) => setExperience(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Expected salary</label>
            <input type="number" min={0} value={expected} onChange={(e) => setExpected(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Notice period</label>
            <input value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="e.g. 30 days" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Source</label>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={inputCls}>
              <option value="">Select</option>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Recruiter</label>
            <select value={recruiterId} onChange={(e) => setRecruiterId(e.target.value)} className={inputCls}>
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Follow-up date</label>
            <input type="date" value={followup} onChange={(e) => setFollowup(e.target.value)} className={inputCls} />
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">Qualifications</label>
        <input value={qualifications} onChange={(e) => setQualifications(e.target.value)} className={inputCls} />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add candidate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CandidateDrawer({
  candidate,
  candidates,
  vacancies,
  people,
  personName,
  onClose,
}: {
  candidate: Candidate;
  candidates: Candidate[];
  vacancies: VacLite[];
  people: Person[];
  personName: (id: string | null) => string;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const c = candidate;

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [stageNote, setStageNote] = useState("");
  const [email, setEmail] = useState(c.email ?? "");
  const [phone, setPhone] = useState(c.phone ?? "");
  const [vacancyId, setVacancyId] = useState(c.vacancy_id ?? "");
  const [recruiterId, setRecruiterId] = useState(c.recruiter_id ?? "");
  const [followup, setFollowup] = useState(c.followup_date ?? "");
  const [expected, setExpected] = useState(c.expected_salary == null ? "" : String(c.expected_salary));
  const [notice, setNotice] = useState(c.notice_period ?? "");
  const [notes, setNotes] = useState(c.notes ?? "");

  const dups = findDuplicates(candidates, c.email ?? "", c.phone ?? "", c.id);

  async function loadHistory() {
    const { data } = await supabase
      .from("candidate_stage_history")
      .select("id, from_status, to_status, note, changed_by, created_at")
      .eq("candidate_id", c.id)
      .order("created_at", { ascending: false });
    setHistory(data ?? []);
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  async function changeStage(next: string) {
    if (next === c.status) return;
    setMsg("");
    const { data, error } = await supabase
      .from("candidates")
      .update({ status: next })
      .eq("id", c.id)
      .select("id");
    if (error || !data || data.length === 0) {
      setMsg(error?.message ?? "You do not have permission to change this candidate.");
      return;
    }
    await supabase.from("candidate_stage_history").insert({
      candidate_id: c.id,
      from_status: c.status,
      to_status: next,
      note: stageNote.trim() || null,
    });
    setStageNote("");
    await loadHistory();
    router.refresh();
  }

  async function saveDetails() {
    setSaving(true);
    setMsg("");
    const { data, error } = await supabase
      .from("candidates")
      .update({
        email: email.trim() || null,
        phone: phone.trim() || null,
        vacancy_id: vacancyId || null,
        recruiter_id: recruiterId || null,
        followup_date: followup || null,
        expected_salary: num(expected),
        notice_period: notice.trim() || null,
        notes: notes.trim() || null,
      })
      .eq("id", c.id)
      .select("id");
    if (error || !data || data.length === 0) {
      setMsg(error?.message ?? "You do not have permission to change this candidate.");
      setSaving(false);
      return;
    }
    router.refresh();
    setMsg("Saved.");
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{c.full_name}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {c.qualifications ?? "No qualifications recorded"}
              {c.experience_years != null ? ` - ${c.experience_years} yrs` : ""}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {dups.length > 0 && (
          <p className="mt-3 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
            Possible duplicate of: {dups.map((d) => d.full_name).join(", ")}
          </p>
        )}

        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <label className="block text-xs font-medium text-slate-500">Stage</label>
          <select value={c.status} onChange={(e) => changeStage(e.target.value)} className={inputCls}>
            {ALL_STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            value={stageNote}
            onChange={(e) => setStageNote(e.target.value)}
            placeholder="Optional note for the next stage change"
            className={inputCls}
          />
          <p className="mt-2 text-xs text-slate-500">
            An accepted offer does not mark someone as Joined. Joined is set only when you confirm it.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Vacancy</label>
            <select value={vacancyId} onChange={(e) => setVacancyId(e.target.value)} className={inputCls}>
              <option value="">None</option>
              {vacancies.map((v) => (
                <option key={v.id} value={v.id}>{v.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Recruiter</label>
            <select value={recruiterId} onChange={(e) => setRecruiterId(e.target.value)} className={inputCls}>
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Follow-up date</label>
            <input type="date" value={followup} onChange={(e) => setFollowup(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Expected salary</label>
            <input type="number" min={0} value={expected} onChange={(e) => setExpected(e.target.value)} className={inputCls} />
          </div>
        </div>
        <label className="mt-3 block text-xs font-medium text-slate-500">Notice period</label>
        <input value={notice} onChange={(e) => setNotice(e.target.value)} className={inputCls} />
        <label className="mt-3 block text-xs font-medium text-slate-500">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} />
        <p className="mt-2 text-xs text-slate-500">
          Source: {c.source ?? "-"} - Recruiter: {personName(c.recruiter_id)}
        </p>

        {msg && <p className={`mt-3 text-sm ${msg === "Saved." ? "text-green-600" : "text-red-600"}`}>{msg}</p>}
        <button
          onClick={saveDetails}
          disabled={saving}
          className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save details"}
        </button>

        <h3 className="mt-6 text-sm font-semibold text-slate-900">Stage history</h3>
        <ul className="mt-3 space-y-2">
          {history.length === 0 && <li className="text-sm text-slate-500">No history yet.</li>}
          {history.map((h) => (
            <li key={h.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <p>
                {h.from_status ? `${h.from_status} to ${h.to_status}` : h.to_status}
              </p>
              {h.note && <p className="mt-1 text-slate-600">{h.note}</p>}
              <p className="mt-1 text-xs text-slate-400">
                {personName(h.changed_by)} - {new Date(h.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}