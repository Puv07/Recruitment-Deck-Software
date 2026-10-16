"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import StageFeedback from "./StageFeedback";
import {
  CALL_OUTCOMES,
  CALL_RESPONSES,
  MARITAL,
  QUALIFICATION_HINTS,
  SCORE_CRITERIA,
  SCORE_LEVELS,
  SCORE_MAX,
  SOURCES,
  type ScoreKey,
} from "@/lib/options";

type Candidate = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  vacancy_id: string | null;
  category_id: string | null;
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
  date_of_birth: string | null;
  hometown: string | null;
  location_applied: string | null;
  position_applied: string | null;
  marital_status: string | null;
  father_occupation: string | null;
  mother_occupation: string | null;
};
type VacLite = { id: string; title: string; category_id: string | null };
type Named = { id: string; name: string };
type Person = { id: string; full_name: string | null; email: string | null };
type AssessLite = { candidate_id: string; created_at: string } & Record<ScoreKey, number | null>;
type Assessment = AssessLite & { id: string; assessor_id: string; remarks: string | null };
type Call = {
  id: string;
  called_by: string;
  called_at: string;
  outcome: string;
  response: string | null;
  summary: string | null;
  next_followup: string | null;
};
type HistoryRow = {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  changed_by: string;
  created_at: string;
};
type Msg = { ok: boolean; text: string } | null;

const MAIN_STAGES = [
     "Applied",
     "HR Screening",
     "Assessment",
     "Technical Interview",
     "Final Interview",
     "Selected",
     "Offer Released",
     "Offer Accepted",
     "Joined",
];
const OTHER_STAGES = ["On Hold", "Rejected", "Withdrawn", "Did Not Join"];
const ALL_STAGES = [...MAIN_STAGES, ...OTHER_STAGES];
const CLOSED = ["Joined", "Rejected", "Withdrawn", "Did Not Join"];

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50";

const num = (v: string) => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const digits = (s: string | null) => (s ?? "").replace(/\D/g, "").slice(-10);
const todayStr = () => new Date().toLocaleDateString("en-CA");

function ageOf(dob: string | null): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = new Date();
  let a = t.getFullYear() - y;
  if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) a -= 1;
  return a;
}

function average(a: Partial<Record<ScoreKey, number | null>>): number | null {
  const vals = SCORE_CRITERIA.map((c) => a[c.key]).filter((v): v is number => typeof v === "number");
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}

function scoreStyle(avg: number) {
  const r = avg / SCORE_MAX;
  if (r >= 0.8) return "bg-green-50 text-green-700";
  if (r >= 0.6) return "bg-indigo-50 text-indigo-700";
  if (r >= 0.4) return "bg-yellow-50 text-yellow-700";
  return "bg-red-50 text-red-700";
}

function findDuplicates(list: Candidate[], email: string, phone: string, excludeId?: string) {
  const e = email.trim().toLowerCase();
  const p = digits(phone);
  return list.filter(
    (c) =>
      c.id !== excludeId &&
      ((e && c.email?.toLowerCase() === e) || (p.length >= 8 && digits(c.phone) === p))
  );
}

/* ---------- shared form ---------- */

type Form = {
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  hometown: string;
  marital_status: string;
  father_occupation: string;
  mother_occupation: string;
  category_id: string;
  vacancy_id: string;
  position_applied: string;
  location_applied: string;
  source: string;
  recruiter_id: string;
  followup_date: string;
  qualifications: string;
  experience_years: string;
  current_salary: string;
  expected_salary: string;
  notice_period: string;
  notes: string;
};

const emptyForm = (recruiterId: string): Form => ({
  full_name: "",
  email: "",
  phone: "",
  date_of_birth: "",
  hometown: "",
  marital_status: "",
  father_occupation: "",
  mother_occupation: "",
  category_id: "",
  vacancy_id: "",
  position_applied: "",
  location_applied: "",
  source: "",
  recruiter_id: recruiterId,
  followup_date: "",
  qualifications: "",
  experience_years: "",
  current_salary: "",
  expected_salary: "",
  notice_period: "",
  notes: "",
});

const fromCandidate = (c: Candidate): Form => ({
  full_name: c.full_name,
  email: c.email ?? "",
  phone: c.phone ?? "",
  date_of_birth: c.date_of_birth ?? "",
  hometown: c.hometown ?? "",
  marital_status: c.marital_status ?? "",
  father_occupation: c.father_occupation ?? "",
  mother_occupation: c.mother_occupation ?? "",
  category_id: c.category_id ?? "",
  vacancy_id: c.vacancy_id ?? "",
  position_applied: c.position_applied ?? "",
  location_applied: c.location_applied ?? "",
  source: c.source ?? "",
  recruiter_id: c.recruiter_id ?? "",
  followup_date: c.followup_date ?? "",
  qualifications: c.qualifications ?? "",
  experience_years: c.experience_years == null ? "" : String(c.experience_years),
  current_salary: c.current_salary == null ? "" : String(c.current_salary),
  expected_salary: c.expected_salary == null ? "" : String(c.expected_salary),
  notice_period: c.notice_period ?? "",
  notes: c.notes ?? "",
});

const t = (s: string) => s.trim() || null;
const toRow = (f: Form) => ({
  full_name: f.full_name.trim(),
  email: t(f.email),
  phone: t(f.phone),
  date_of_birth: f.date_of_birth || null,
  hometown: t(f.hometown),
  marital_status: f.marital_status || null,
  father_occupation: t(f.father_occupation),
  mother_occupation: t(f.mother_occupation),
  category_id: f.category_id || null,
  vacancy_id: f.vacancy_id || null,
  position_applied: t(f.position_applied),
  location_applied: t(f.location_applied),
  source: f.source || null,
  recruiter_id: f.recruiter_id || null,
  followup_date: f.followup_date || null,
  qualifications: t(f.qualifications),
  experience_years: num(f.experience_years),
  current_salary: num(f.current_salary),
  expected_salary: num(f.expected_salary),
  notice_period: t(f.notice_period),
  notes: t(f.notes),
});

function dobError(dob: string): string {
  if (!dob) return "";
  const a = ageOf(dob);
  if (dob > todayStr() || a === null || a < 14 || a > 80) return "Please check the date of birth.";
  return "";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-5 border-b border-slate-100 pb-1 text-sm font-semibold text-slate-900">{children}</h3>;
}

function CandidateFields({
  f,
  update,
  categories,
  vacancies,
  people,
  disabled,
}: {
  f: Form;
  update: (patch: Partial<Form>) => void;
  categories: Named[];
  vacancies: VacLite[];
  people: Person[];
  disabled?: boolean;
}) {
  const age = ageOf(f.date_of_birth);
  const vacOptions = f.category_id ? vacancies.filter((v) => v.category_id === f.category_id) : vacancies;

  function pickVacancy(id: string) {
    const v = vacancies.find((x) => x.id === id);
    const patch: Partial<Form> = { vacancy_id: id };
    if (v) {
      if (!f.position_applied.trim()) patch.position_applied = v.title;
      if (!f.category_id && v.category_id) patch.category_id = v.category_id;
    }
    update(patch);
  }

  return (
    <>
      <SectionTitle>Personal details</SectionTitle>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Full name">
            <input disabled={disabled} value={f.full_name} onChange={(e) => update({ full_name: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field label="Date of birth">
          <input
            type="date"
            disabled={disabled}
            max={todayStr()}
            value={f.date_of_birth}
            onChange={(e) => update({ date_of_birth: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Age (calculated)">
          <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700" suppressHydrationWarning>
            {age === null ? "Enter a date of birth" : `${age} years`}
          </p>
        </Field>
        <Field label="Phone">
          <input disabled={disabled} value={f.phone} onChange={(e) => update({ phone: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Email">
          <input type="email" disabled={disabled} value={f.email} onChange={(e) => update({ email: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Hometown">
          <input disabled={disabled} value={f.hometown} onChange={(e) => update({ hometown: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Marital status">
          <select disabled={disabled} value={f.marital_status} onChange={(e) => update({ marital_status: e.target.value })} className={inputCls}>
            <option value="">Not stated</option>
            {MARITAL.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Father's occupation">
          <input disabled={disabled} value={f.father_occupation} onChange={(e) => update({ father_occupation: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Mother's occupation">
          <input disabled={disabled} value={f.mother_occupation} onChange={(e) => update({ mother_occupation: e.target.value })} className={inputCls} />
        </Field>
      </div>

      <SectionTitle>Application</SectionTitle>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Role category">
          <select disabled={disabled} value={f.category_id} onChange={(e) => update({ category_id: e.target.value, vacancy_id: "" })} className={inputCls}>
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Vacancy">
          <select disabled={disabled} value={f.vacancy_id} onChange={(e) => pickVacancy(e.target.value)} className={inputCls}>
            <option value="">None</option>
            {vacOptions.map((v) => (
              <option key={v.id} value={v.id}>{v.title}</option>
            ))}
          </select>
        </Field>
        <Field label="Position applied for">
          <input disabled={disabled} value={f.position_applied} onChange={(e) => update({ position_applied: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Location applied for">
          <input disabled={disabled} value={f.location_applied} onChange={(e) => update({ location_applied: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Source of application">
          <select disabled={disabled} value={f.source} onChange={(e) => update({ source: e.target.value })} className={inputCls}>
            <option value="">Select</option>
            {SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Recruiter">
          <select disabled={disabled} value={f.recruiter_id} onChange={(e) => update({ recruiter_id: e.target.value })} className={inputCls}>
            <option value="">Unassigned</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
            ))}
          </select>
        </Field>
        <Field label="Follow-up date">
          <input type="date" disabled={disabled} value={f.followup_date} onChange={(e) => update({ followup_date: e.target.value })} className={inputCls} />
        </Field>
      </div>

      <SectionTitle>Background</SectionTitle>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Qualification">
          <input
            disabled={disabled}
            list="qualification-hints"
            value={f.qualifications}
            onChange={(e) => update({ qualifications: e.target.value })}
            className={inputCls}
          />
          <datalist id="qualification-hints">
            {QUALIFICATION_HINTS.map((q) => (
              <option key={q} value={q} />
            ))}
          </datalist>
        </Field>
        <Field label="Experience (years)">
          <input type="number" min={0} step="0.5" disabled={disabled} value={f.experience_years} onChange={(e) => update({ experience_years: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Current salary">
          <input type="number" min={0} disabled={disabled} value={f.current_salary} onChange={(e) => update({ current_salary: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Expected salary">
          <input type="number" min={0} disabled={disabled} value={f.expected_salary} onChange={(e) => update({ expected_salary: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Notice period">
          <input disabled={disabled} value={f.notice_period} onChange={(e) => update({ notice_period: e.target.value })} placeholder="e.g. 30 days" className={inputCls} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Notes">
          <textarea disabled={disabled} value={f.notes} onChange={(e) => update({ notes: e.target.value })} rows={3} className={inputCls} />
        </Field>
      </div>
    </>
  );
}

/* ---------- main page ---------- */

export default function CandidatesClient({
  userId,
  candidates,
  vacancies,
  categories,
  people,
  assessments,
  loadError,
}: {
  userId: string;
  candidates: Candidate[];
  vacancies: VacLite[];
  categories: Named[];
  people: Person[];
  assessments: AssessLite[];
  loadError: string;
}) {
  const router = useRouter();
  const today = todayStr();

  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [categoryF, setCategoryF] = useState("");
  const [sourceF, setSourceF] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const latestScore = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const a of assessments) {
      if (!map.has(a.candidate_id)) map.set(a.candidate_id, average(a)); // list is newest first
    }
    return map;
  }, [assessments]);

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "-";
  const vacancyTitle = (id: string | null) => vacancies.find((v) => v.id === id)?.title ?? "-";
  const personName = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Unknown";
  };
  const positionOf = (c: Candidate) => c.position_applied || vacancyTitle(c.vacancy_id);

  const filtered = candidates.filter((c) => {
    if (statusF && c.status !== statusF) return false;
    if (categoryF && c.category_id !== categoryF) return false;
    if (sourceF && c.source !== sourceF) return false;
    if (q) {
      const hay = `${c.full_name} ${c.email ?? ""} ${c.phone ?? ""} ${c.hometown ?? ""} ${c.position_applied ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const selected = candidates.find((c) => c.id === selectedId) ?? null;
  const followupDue = (c: Candidate) => !!c.followup_date && c.followup_date <= today && !CLOSED.includes(c.status);

  function ScoreBadge({ id }: { id: string }) {
    const s = latestScore.get(id);
    if (s == null) return <span className="text-xs text-slate-400">Not scored</span>;
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${scoreStyle(s)}`}>
        {s.toFixed(1)} / {SCORE_MAX}
      </span>
    );
  }

  return (
    <div className="mx-auto max-w-full p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Candidates</h1>
          <p className="mt-1 text-sm text-slate-500">One database of everyone you have spoken to, with calls, scores and pipeline stage.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Add candidate
        </button>
      </div>

      {loadError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load candidates: {loadError}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {(["board", "list"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === k ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
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
            placeholder="Search name, phone, hometown"
            className="w-64 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <select value={categoryF} onChange={(e) => setCategoryF(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All role categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={sourceF} onChange={(e) => setSourceF(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s}>{s}</option>
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
              <div key={stage} className="w-64 shrink-0 rounded-xl bg-slate-100 p-2">
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
                      <p className="mt-0.5 truncate text-xs text-slate-500">{positionOf(c)}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <ScoreBadge id={c.id} />
                        {c.followup_date && (
                          <span className={`text-xs ${followupDue(c) ? "font-medium text-red-600" : "text-slate-400"}`}>
                            {c.followup_date}
                          </span>
                        )}
                      </div>
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
                  <th className="px-4 py-2 font-medium">Age</th>
                  <th className="px-4 py-2 font-medium">Position</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Location applied</th>
                  <th className="px-4 py-2 font-medium">Hometown</th>
                  <th className="px-4 py-2 font-medium">Stage</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Score</th>
                  <th className="px-4 py-2 font-medium">Follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} onClick={() => setSelectedId(c.id)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{c.full_name}</p>
                      <p className="text-xs text-slate-500">{c.phone ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600" suppressHydrationWarning>
                      {ageOf(c.date_of_birth) ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{positionOf(c)}</td>
                    <td className="px-4 py-3 text-slate-600">{categoryName(c.category_id)}</td>
                    <td className="px-4 py-3 text-slate-600">{c.location_applied ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.hometown ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className="whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.source ?? "-"}</td>
                    <td className="px-4 py-3">
                      <ScoreBadge id={c.id} />
                    </td>
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
          categories={categories}
          vacancies={vacancies}
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
          categories={categories}
          vacancies={vacancies}
          people={people}
          personName={personName}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

/* ---------- add candidate ---------- */

function AddCandidateModal({
  userId,
  candidates,
  categories,
  vacancies,
  people,
  onClose,
  onDone,
}: {
  userId: string;
  candidates: Candidate[];
  categories: Named[];
  vacancies: VacLite[];
  people: Person[];
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [f, setF] = useState<Form>(emptyForm(userId));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<Form>) => setF((p) => ({ ...p, ...patch }));
  const dups = findDuplicates(candidates, f.email, f.phone);

  async function save() {
    const dErr = dobError(f.date_of_birth);
    if (dErr) {
      setError(dErr);
      return;
    }
    setSaving(true);
    setError("");
    const { data, error } = await supabase
      .from("candidates")
      .insert({ ...toRow(f), status: "Applied" })
      .select("id")
      .single();
    if (error || !data) {
      setError(error?.message ?? "Could not save the candidate.");
      setSaving(false);
      return;
    }
    await supabase
      .from("candidate_stage_history")
      .insert({ candidate_id: data.id, from_status: null, to_status: "Applied", note: "Candidate added" });
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Add candidate</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <CandidateFields f={f} update={update} categories={categories} vacancies={vacancies} people={people} />

        {dups.length > 0 && (
          <p className="mt-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
            Possible duplicate: {dups.map((d) => `${d.full_name} (${d.status})`).join(", ")}. You can still save, but check first. You are only warned about candidates you are allowed to see.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !f.full_name.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add candidate"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- candidate drawer ---------- */

function CandidateDrawer({
  candidate,
  candidates,
  categories,
  vacancies,
  people,
  personName,
  onClose,
}: {
  candidate: Candidate;
  candidates: Candidate[];
  categories: Named[];
  vacancies: VacLite[];
  people: Person[];
  personName: (id: string | null) => string;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const c = candidate;

  const [tab, setTab] =    useState<"profile" | "feedback" | "scores" | "calls" | "history">("profile");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [assessList, setAssessList] = useState<Assessment[]>([]);

  const [profileMsg, setProfileMsg] = useState<Msg>(null);
  const [saving, setSaving] = useState(false);
  const [stageNote, setStageNote] = useState("");
  const [f, setF] = useState<Form>(fromCandidate(c));
  const update = (patch: Partial<Form>) => setF((p) => ({ ...p, ...patch }));
  const dups = findDuplicates(candidates, c.email ?? "", c.phone ?? "", c.id);

  const [scores, setScores] = useState<Record<ScoreKey, string>>({
    communication_score: "",
    flexibility_score: "",
    commitment_score: "",
    grooming_score: "",
    attitude_score: "",
    technical_score: "",
  });
  const [remarks, setRemarks] = useState("");
  const [scoreMsg, setScoreMsg] = useState<Msg>(null);

  const [outcome, setOutcome] = useState(CALL_OUTCOMES[0]);
  const [response, setResponse] = useState("");
  const [summary, setSummary] = useState("");
  const [nextFollowup, setNextFollowup] = useState("");
  const [callMsg, setCallMsg] = useState<Msg>(null);

  async function loadAll() {
    const [h, cl, a] = await Promise.all([
      supabase
        .from("candidate_stage_history")
        .select("id, from_status, to_status, note, changed_by, created_at")
        .eq("candidate_id", c.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("candidate_calls")
        .select("id, called_by, called_at, outcome, response, summary, next_followup")
        .eq("candidate_id", c.id)
        .order("called_at", { ascending: false }),
      supabase
        .from("candidate_assessments")
        .select("*")
        .eq("candidate_id", c.id)
        .order("created_at", { ascending: false }),
    ]);
    setHistory(h.data ?? []);
    setCalls(cl.data ?? []);
    setAssessList(a.data ?? []);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  async function changeStage(next: string) {
    if (next === c.status) return;
    setProfileMsg(null);
    const { data, error } = await supabase.from("candidates").update({ status: next }).eq("id", c.id).select("id");
    if (error || !data || data.length === 0) {
      setProfileMsg({ ok: false, text: error?.message ?? "You do not have permission to change this candidate." });
      return;
    }
    await supabase.from("candidate_stage_history").insert({
      candidate_id: c.id,
      from_status: c.status,
      to_status: next,
      note: stageNote.trim() || null,
    });
    setStageNote("");
    await loadAll();
    router.refresh();
  }

  async function saveProfile() {
    const dErr = dobError(f.date_of_birth);
    if (dErr) {
      setProfileMsg({ ok: false, text: dErr });
      return;
    }
    setSaving(true);
    setProfileMsg(null);
    const { data, error } = await supabase.from("candidates").update(toRow(f)).eq("id", c.id).select("id");
    if (error || !data || data.length === 0) {
      setProfileMsg({ ok: false, text: error?.message ?? "You do not have permission to change this candidate." });
      setSaving(false);
      return;
    }
    router.refresh();
    setProfileMsg({ ok: true, text: "Saved." });
    setSaving(false);
  }

  async function saveAssessment() {
    setScoreMsg(null);
    const row: Record<string, unknown> = { candidate_id: c.id, remarks: remarks.trim() || null };
    let count = 0;
    for (const crit of SCORE_CRITERIA) {
      const v = scores[crit.key];
      row[crit.key] = v ? Number(v) : null;
      if (v) count += 1;
    }
    if (count === 0) {
      setScoreMsg({ ok: false, text: "Give at least one score." });
      return;
    }
    const { error } = await supabase.from("candidate_assessments").insert(row);
    if (error) {
      setScoreMsg({ ok: false, text: error.message });
      return;
    }
    setScores({
      communication_score: "",
      flexibility_score: "",
      commitment_score: "",
      grooming_score: "",
      attitude_score: "",
      technical_score: "",
    });
    setRemarks("");
    await loadAll();
    router.refresh();
    setScoreMsg({ ok: true, text: "Assessment saved." });
  }

  async function saveCall() {
    setCallMsg(null);
    const { error } = await supabase.from("candidate_calls").insert({
      candidate_id: c.id,
      outcome,
      response: response || null,
      summary: summary.trim() || null,
      next_followup: nextFollowup || null,
    });
    if (error) {
      setCallMsg({ ok: false, text: error.message });
      return;
    }
    if (nextFollowup) {
      await supabase.from("candidates").update({ followup_date: nextFollowup }).eq("id", c.id);
      update({ followup_date: nextFollowup });
    }
    setResponse("");
    setSummary("");
    setNextFollowup("");
    await loadAll();
    router.refresh();
    setCallMsg({ ok: true, text: "Call logged." });
  }

  const latest = assessList[0];
  const age = ageOf(c.date_of_birth);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{c.full_name}</h2>
            <p className="mt-1 text-xs text-slate-500" suppressHydrationWarning>
              {age !== null ? `${age} years - ` : ""}
              {c.position_applied || "No position recorded"}
              {c.hometown ? ` - ${c.hometown}` : ""}
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

        <div className="mt-4 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {(
            [
              ["profile", "Profile"],
              ["feedback", "Stage feedback"],
              ["scores", "Scores"],
              ["calls", `Calls (${calls.length})`],
              ["history", "Stage history"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium sm:text-sm ${
                tab === key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="mt-4">
            <div className="rounded-xl bg-slate-50 p-4">
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
                An accepted offer does not mark someone as Joined. Joined is set only when joining is confirmed in Offers &amp; Joining.
              </p>
            </div>

            <CandidateFields f={f} update={update} categories={categories} vacancies={vacancies} people={people} />

            {profileMsg && <p className={`mt-3 text-sm ${profileMsg.ok ? "text-green-600" : "text-red-600"}`}>{profileMsg.text}</p>}
            <button
              onClick={saveProfile}
              disabled={saving || !f.full_name.trim()}
              className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save details"}
            </button>
          </div>
        )}

                   {tab === "feedback" && (
             <StageFeedback candidate={c} personName={personName} onChanged={() => router.refresh()} />
           )}
        {tab === "scores" && (
          <div className="mt-4">
            {latest ? (
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Latest assessment - average {average(latest)?.toFixed(1)} / {SCORE_MAX}
                </p>
                <div className="mt-3 space-y-2">
                  {SCORE_CRITERIA.map((crit) => {
                    const v = latest[crit.key];
                    return (
                      <div key={crit.key}>
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>{crit.label}</span>
                          <span>{v == null ? "Not scored" : `${v} / ${SCORE_MAX}`}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-indigo-500"
                            style={{ width: `${v == null ? 0 : Math.min(100, (v / SCORE_MAX) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No assessments yet.</p>
            )}

            <h3 className="mt-6 text-sm font-semibold text-slate-900">New assessment</h3>
            <p className="mt-1 text-xs text-slate-500">
              Scale: {SCORE_LEVELS.map((l, i) => `${i + 1} ${l}`).join(", ")}. Leave a score blank if it was not assessed.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {SCORE_CRITERIA.map((crit) => (
                <div key={crit.key}>
                  <label className="block text-xs font-medium text-slate-700">{crit.label}</label>
                  <p className="text-xs text-slate-400">{crit.hint}</p>
                  <select
                    value={scores[crit.key]}
                    onChange={(e) => setScores((s) => ({ ...s, [crit.key]: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">Not scored</option>
                    {SCORE_LEVELS.map((label, i) => (
                      <option key={label} value={i + 1}>
                        {i + 1} - {label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <label className="mt-3 block text-xs font-medium text-slate-700">Remarks</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={inputCls} />
            {scoreMsg && <p className={`mt-2 text-sm ${scoreMsg.ok ? "text-green-600" : "text-red-600"}`}>{scoreMsg.text}</p>}
            <button
              onClick={saveAssessment}
              className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Save assessment
            </button>
            <p className="mt-2 text-xs text-slate-400">Assessments are kept as a record and cannot be edited or deleted. Add a new one to update scores.</p>

            <h3 className="mt-6 text-sm font-semibold text-slate-900">Assessment history</h3>
            <ul className="mt-3 space-y-2">
              {assessList.length === 0 && <li className="text-sm text-slate-500">None yet.</li>}
              {assessList.map((a) => (
                <li key={a.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">Average {average(a)?.toFixed(1)} / {SCORE_MAX}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {SCORE_CRITERIA.filter((crit) => a[crit.key] != null)
                      .map((crit) => `${crit.label} ${a[crit.key]}`)
                      .join(" - ")}
                  </p>
                  {a.remarks && <p className="mt-1">{a.remarks}</p>}
                  <p className="mt-1 text-xs text-slate-400">
                    {personName(a.assessor_id)} - <span suppressHydrationWarning>{new Date(a.created_at).toLocaleString()}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "calls" && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-900">Log a call</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500">Outcome</label>
                <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={inputCls}>
                  {CALL_OUTCOMES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Candidate response</label>
                <select value={response} onChange={(e) => setResponse(e.target.value)} className={inputCls}>
                  <option value="">Not recorded</option>
                  {CALL_RESPONSES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="mt-3 block text-xs font-medium text-slate-500">Feedback and summary of the call</label>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className={inputCls} />
            <label className="mt-3 block text-xs font-medium text-slate-500">Next follow-up date (optional)</label>
            <input type="date" value={nextFollowup} onChange={(e) => setNextFollowup(e.target.value)} className={inputCls} />
            {callMsg && <p className={`mt-2 text-sm ${callMsg.ok ? "text-green-600" : "text-red-600"}`}>{callMsg.text}</p>}
            <button onClick={saveCall} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Save call
            </button>
            <p className="mt-2 text-xs text-slate-400">The call is recorded with your name and the current time. Calls cannot be edited or deleted.</p>

            <h3 className="mt-6 text-sm font-semibold text-slate-900">Call history</h3>
            <ul className="mt-3 space-y-2">
              {calls.length === 0 && <li className="text-sm text-slate-500">No calls logged yet.</li>}
              {calls.map((cl) => (
                <li key={cl.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">
                    {cl.outcome}
                    {cl.response ? ` - ${cl.response}` : ""}
                  </p>
                  {cl.summary && <p className="mt-1 whitespace-pre-wrap">{cl.summary}</p>}
                  {cl.next_followup && <p className="mt-1 text-xs text-slate-500">Next follow-up {cl.next_followup}</p>}
                  <p className="mt-1 text-xs text-slate-400">
                    {personName(cl.called_by)} - <span suppressHydrationWarning>{new Date(cl.called_at).toLocaleString()}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "history" && (
          <ul className="mt-4 space-y-2">
            {history.length === 0 && <li className="text-sm text-slate-500">No history yet.</li>}
            {history.map((h) => (
              <li key={h.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                <p>{h.from_status ? `${h.from_status} to ${h.to_status}` : h.to_status}</p>
                {h.note && <p className="mt-1 text-slate-600">{h.note}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {personName(h.changed_by)} - <span suppressHydrationWarning>{new Date(h.created_at).toLocaleString()}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}