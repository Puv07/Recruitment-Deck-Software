"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Phone, Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import StageFeedback from "./StageFeedback";
import {
  ASSESSMENT_MAX,
  CALL_OUTCOMES,
  CALL_RESPONSES,
  MARITAL,
  QUALIFICATION_HINTS,
  SCORE_CRITERIA,
  SCORE_TOTAL_MAX,
  SOURCES,
  currentScoresByCandidate,
  functionalBand,
  hrBand,
  hrSubtotal,
  profileStrength,
  scoreOptions,
  type ScoreKey,
  type ScoreValues,
} from "@/lib/options";

/* ---------- types ---------- */

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
  expected_salary_max: number | null;
  notice_period: string | null;
  source: string | null;
  referred_by: string | null;
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
  spouse_occupation: string | null;
  languages_known: string | null;
  field_of_experience: string | null;
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
type TabKey = "overview" | "feedback" | "scores" | "calls" | "history" | "profile";

/* ---------- constants and helpers ---------- */

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

const BLANK_SCORES: Record<ScoreKey, string> = {
  technical_score: "",
  communication_score: "",
  attitude_score: "",
  commitment_score: "",
  grooming_score: "",
  flexibility_score: "",
};

const BAND_STYLE: Record<string, string> = {
  A: "bg-green-50 text-green-700",
  B: "bg-indigo-50 text-indigo-700",
  C: "bg-yellow-50 text-yellow-700",
  D: "bg-red-50 text-red-700",
};

const AVATARS = [
  "bg-blue-100 text-blue-700",
  "bg-pink-100 text-pink-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-cyan-100 text-cyan-700",
];

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50";

const num = (v: string) => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const digits = (s: string | null) => (s ?? "").replace(/\D/g, "").slice(-10);
const todayStr = () => new Date().toLocaleDateString("en-CA");
const money = (n: number | null) => (n == null ? null : n.toLocaleString("en-IN"));
const fmtDate = (d: string | null) => {
  if (!d) return null;
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
};
const telHref = (s: string) => `tel:${s.replace(/[^\d+]/g, "")}`;
const mailHref = (s: string) => `mailto:${s.replace(/[^\w.+\-@]/g, "")}`;

function avatarCls(name: string) {
  let h = 0;
  for (const ch of name) h += ch.charCodeAt(0);
  return AVATARS[h % AVATARS.length];
}
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function ageOf(dob: string | null): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = new Date();
  let a = t.getFullYear() - y;
  if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) a -= 1;
  return a;
}

function strengthStyle(p: number) {
  if (p >= 80) return "bg-green-50 text-green-700";
  if (p >= 60) return "bg-indigo-50 text-indigo-700";
  if (p >= 40) return "bg-yellow-50 text-yellow-700";
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
  languages_known: string;
  father_occupation: string;
  mother_occupation: string;
  spouse_occupation: string;
  category_id: string;
  vacancy_id: string;
  position_applied: string;
  location_applied: string;
  source: string;
  referred_by: string;
  recruiter_id: string;
  followup_date: string;
  qualifications: string;
  field_of_experience: string;
  experience_years: string;
  current_salary: string;
  expected_salary: string;
  expected_salary_max: string;
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
  languages_known: "",
  father_occupation: "",
  mother_occupation: "",
  spouse_occupation: "",
  category_id: "",
  vacancy_id: "",
  position_applied: "",
  location_applied: "",
  source: "",
  referred_by: "",
  recruiter_id: recruiterId,
  followup_date: "",
  qualifications: "",
  field_of_experience: "",
  experience_years: "",
  current_salary: "",
  expected_salary: "",
  expected_salary_max: "",
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
  languages_known: c.languages_known ?? "",
  father_occupation: c.father_occupation ?? "",
  mother_occupation: c.mother_occupation ?? "",
  spouse_occupation: c.spouse_occupation ?? "",
  category_id: c.category_id ?? "",
  vacancy_id: c.vacancy_id ?? "",
  position_applied: c.position_applied ?? "",
  location_applied: c.location_applied ?? "",
  source: c.source ?? "",
  referred_by: c.referred_by ?? "",
  recruiter_id: c.recruiter_id ?? "",
  followup_date: c.followup_date ?? "",
  qualifications: c.qualifications ?? "",
  field_of_experience: c.field_of_experience ?? "",
  experience_years: c.experience_years == null ? "" : String(c.experience_years),
  current_salary: c.current_salary == null ? "" : String(c.current_salary),
  expected_salary: c.expected_salary == null ? "" : String(c.expected_salary),
  expected_salary_max: c.expected_salary_max == null ? "" : String(c.expected_salary_max),
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
  languages_known: t(f.languages_known),
  father_occupation: t(f.father_occupation),
  mother_occupation: t(f.mother_occupation),
  spouse_occupation: t(f.spouse_occupation),
  category_id: f.category_id || null,
  vacancy_id: f.vacancy_id || null,
  position_applied: t(f.position_applied),
  location_applied: t(f.location_applied),
  source: f.source || null,
  referred_by: t(f.referred_by),
  recruiter_id: f.recruiter_id || null,
  followup_date: f.followup_date || null,
  qualifications: t(f.qualifications),
  field_of_experience: t(f.field_of_experience),
  experience_years: num(f.experience_years),
  current_salary: num(f.current_salary),
  expected_salary: num(f.expected_salary),
  expected_salary_max: num(f.expected_salary_max),
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
        <div className="col-span-2">
          <Field label="Languages known">
            <input
              disabled={disabled}
              value={f.languages_known}
              onChange={(e) => update({ languages_known: e.target.value })}
              placeholder="e.g. Telugu, Hindi, English"
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Father's occupation">
          <input disabled={disabled} value={f.father_occupation} onChange={(e) => update({ father_occupation: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Mother's occupation">
          <input disabled={disabled} value={f.mother_occupation} onChange={(e) => update({ mother_occupation: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Spouse's occupation">
          <input disabled={disabled} value={f.spouse_occupation} onChange={(e) => update({ spouse_occupation: e.target.value })} className={inputCls} />
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
        <Field label="Name of the referrer (if any)">
          <input disabled={disabled} value={f.referred_by} onChange={(e) => update({ referred_by: e.target.value })} className={inputCls} />
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
        <Field label="Field of experience">
          <input disabled={disabled} value={f.field_of_experience} onChange={(e) => update({ field_of_experience: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Years of experience (0 for a fresher)">
          <input type="number" min={0} step="0.5" disabled={disabled} value={f.experience_years} onChange={(e) => update({ experience_years: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Current salary">
          <input type="number" min={0} disabled={disabled} value={f.current_salary} onChange={(e) => update({ current_salary: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Expected CTC (from)">
          <input type="number" min={0} disabled={disabled} value={f.expected_salary} onChange={(e) => update({ expected_salary: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Expected CTC (to)">
          <input type="number" min={0} disabled={disabled} value={f.expected_salary_max} onChange={(e) => update({ expected_salary_max: e.target.value })} className={inputCls} />
        </Field>
        <div className="col-span-2">
          <Field label="Notice period / expected joining">
            <input
              disabled={disabled}
              value={f.notice_period}
              onChange={(e) => update({ notice_period: e.target.value })}
              placeholder="e.g. Immediate, 30 days"
              className={inputCls}
            />
          </Field>
        </div>
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

  const searchParams = useSearchParams();
  const openParam = searchParams.get("open");
  useEffect(() => {
    if (openParam) setSelectedId(openParam);
  }, [openParam]);

  const strengthMap = useMemo(() => {
    const cur = currentScoresByCandidate(assessments);
    const m = new Map<string, number | null>();
    cur.forEach((v, id) => m.set(id, profileStrength(v).percent));
    return m;
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

  const scoreBadge = (id: string) => {
    const p = strengthMap.get(id);
    if (p == null) return <span className="text-xs text-slate-400">Not scored</span>;
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${strengthStyle(p)}`} title="Profile strength">
        {Math.round(p)}%
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-full p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Candidates</h1>
          <p className="mt-1 text-sm text-slate-500">One database of everyone you have spoken to. Click a candidate for their stage, contact details and scorecard.</p>
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
                        {scoreBadge(c.id)}
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
                  <th className="px-4 py-2 font-medium">Position</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Location applied</th>
                  <th className="px-4 py-2 font-medium">Stage</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Profile strength</th>
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
                    <td className="px-4 py-3 text-slate-600">{positionOf(c)}</td>
                    <td className="px-4 py-3 text-slate-600">{categoryName(c.category_id)}</td>
                    <td className="px-4 py-3 text-slate-600">{c.location_applied ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className="whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.source ?? "-"}</td>
                    <td className="px-4 py-3">{scoreBadge(c.id)}</td>
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

/* ---------- add candidate (full details at the Applied stage) ---------- */

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
        <p className="mt-1 text-xs text-slate-500">
          Fill in everything you have now. After saving, the personal details are kept under View full profile.
        </p>

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

/* ---------- small display pieces ---------- */

function StageTracker({ status }: { status: string }) {
  const idx = MAIN_STAGES.indexOf(status);
  const side = idx === -1;
  return (
    <div>
      <ol className="flex flex-wrap gap-1.5">
        {MAIN_STAGES.map((s, i) => {
          const current = i === idx;
          const done = !side && i < idx;
          return (
            <li
              key={s}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                current ? "bg-indigo-600 text-white" : done ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {done ? "Done: " : ""}
              {s}
            </li>
          );
        })}
      </ol>
      {side && (
        <p className="mt-2 text-sm text-slate-700">
          Current status:{" "}
          <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-800">{status}</span>
        </p>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value || <span className="text-slate-400">-</span>}</dd>
    </div>
  );
}

/* ---------- candidate panel ---------- */

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

  const [tab, setTab] = useState<TabKey>("overview");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [assessList, setAssessList] = useState<Assessment[]>([]);
  const [assessFb, setAssessFb] = useState<{ score: number; score_max: number } | null>(null);

  const [stageNote, setStageNote] = useState("");
  const [stageMsg, setStageMsg] = useState<Msg>(null);

  const [editing, setEditing] = useState(false);
  const [profileMsg, setProfileMsg] = useState<Msg>(null);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<Form>(fromCandidate(c));
  const update = (patch: Partial<Form>) => setF((p) => ({ ...p, ...patch }));
  const dups = findDuplicates(candidates, c.email ?? "", c.phone ?? "", c.id);

  const [scores, setScores] = useState<Record<ScoreKey, string>>(BLANK_SCORES);
  const [remarks, setRemarks] = useState("");
  const [scoreMsg, setScoreMsg] = useState<Msg>(null);

  const [outcome, setOutcome] = useState(CALL_OUTCOMES[0]);
  const [response, setResponse] = useState("");
  const [summary, setSummary] = useState("");
  const [nextFollowup, setNextFollowup] = useState("");
  const [callMsg, setCallMsg] = useState<Msg>(null);

  async function loadAll() {
    const [h, cl, a, fb] = await Promise.all([
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
      supabase.from("candidate_assessments").select("*").eq("candidate_id", c.id).order("created_at", { ascending: false }),
      supabase
        .from("candidate_stage_feedback")
        .select("score, score_max, created_at")
        .eq("candidate_id", c.id)
        .eq("stage", "Assessment")
        .not("score", "is", null)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    setHistory(h.data ?? []);
    setCalls(cl.data ?? []);
    setAssessList((a.data ?? []) as Assessment[]);
    const first = fb.data?.[0];
    setAssessFb(first && first.score_max ? { score: Number(first.score), score_max: Number(first.score_max) } : null);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  // The latest recorded value for each criterion, with who scored it and when
  const current = useMemo(() => {
    const out: Partial<Record<ScoreKey, { value: number; by: string; at: string }>> = {};
    for (const a of assessList) {
      for (const crit of SCORE_CRITERIA) {
        const v = a[crit.key];
        if (!out[crit.key] && typeof v === "number") out[crit.key] = { value: v, by: a.assessor_id, at: a.created_at };
      }
    }
    return out;
  }, [assessList]);

  const values: ScoreValues = {};
  for (const crit of SCORE_CRITERIA) values[crit.key] = current[crit.key]?.value ?? null;
  const strength = profileStrength(values);
  const hr = hrSubtotal(values);
  const fBand = functionalBand(values.technical_score);
  const hBand = hr.complete ? hrBand(hr.total) : null;

  async function changeStage(next: string) {
    if (next === c.status) return;
    setStageMsg(null);
    const { data, error } = await supabase.from("candidates").update({ status: next }).eq("id", c.id).select("id");
    if (error || !data || data.length === 0) {
      setStageMsg({ ok: false, text: error?.message ?? "You do not have permission to change this candidate." });
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
    setEditing(false);
    setSaving(false);
  }

  async function saveAssessment() {
    setScoreMsg(null);
    const row: Record<string, unknown> = { candidate_id: c.id, remarks: remarks.trim() || null };
    let count = 0;
    for (const crit of SCORE_CRITERIA) {
      const v = scores[crit.key];
      row[crit.key] = v === "" ? null : Number(v);
      if (v !== "") count += 1;
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
    setScores(BLANK_SCORES);
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

  const scoreRow = (crit: (typeof SCORE_CRITERIA)[number]) => {
    const cur = current[crit.key];
    return (
      <div key={crit.key}>
        <div className="flex justify-between text-xs text-slate-600">
          <span>{crit.label}</span>
          <span>{cur ? `${cur.value} / ${crit.max}` : "Not scored"}</span>
        </div>
        <div className="mt-1 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${cur ? Math.min(100, (cur.value / crit.max) * 100) : 0}%` }} />
        </div>
        {cur && (
          <p className="mt-0.5 text-[11px] text-slate-400">
            {personName(cur.by)} - <span suppressHydrationWarning>{new Date(cur.at).toLocaleDateString()}</span>
          </p>
        )}
      </div>
    );
  };

  const scoreSelect = (crit: (typeof SCORE_CRITERIA)[number]) => (
    <div key={crit.key}>
      <label className="block text-xs font-medium text-slate-700">
        {crit.label} (out of {crit.max})
      </label>
      <p className="text-xs text-slate-400">{crit.hint}</p>
      <select
        value={scores[crit.key]}
        onChange={(e) => setScores((s) => ({ ...s, [crit.key]: e.target.value }))}
        className={inputCls}
      >
        <option value="">Not scored</option>
        {scoreOptions(crit.max).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "feedback", label: "Stage feedback" },
    { key: "scores", label: "Scores" },
    { key: "calls", label: `Calls (${calls.length})` },
    { key: "history", label: "Stage history" },
    { key: "profile", label: "Full profile" },
  ];

  const age = ageOf(c.date_of_birth);
  const ctc =
    c.expected_salary != null && c.expected_salary_max != null
      ? `${money(c.expected_salary)} - ${money(c.expected_salary_max)}`
      : money(c.expected_salary ?? c.expected_salary_max);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarCls(c.full_name)}`}>
              {initials(c.full_name)}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{c.full_name}</h2>
              <p className="text-xs text-slate-500">{c.position_applied || "No position recorded"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("profile")}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View full profile
            </button>
            <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {dups.length > 0 && (
          <p className="mt-3 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
            Possible duplicate of: {dups.map((d) => d.full_name).join(", ")}
          </p>
        )}

        <div className="mt-4 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium sm:text-sm ${
                tab === tb.key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">Recruitment stage</p>
              <div className="mt-2">
                <StageTracker status={c.status} />
              </div>
              <label className="mt-4 block text-xs font-medium text-slate-500">Change stage</label>
              <select
                value={c.status}
                disabled={c.status === "Joined"}
                onChange={(e) => changeStage(e.target.value)}
                className={inputCls}
              >
                {ALL_STAGES.map((s) => (
                  <option key={s} disabled={["Joined", "Offer Released", "Offer Accepted"].includes(s) && s !== c.status}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                value={stageNote}
                onChange={(e) => setStageNote(e.target.value)}
                placeholder="Optional note for the next stage change"
                className={inputCls}
              />
              {stageMsg && <p className={`mt-2 text-sm ${stageMsg.ok ? "text-green-600" : "text-red-600"}`}>{stageMsg.text}</p>}
              <p className="mt-2 text-xs text-slate-500">
                Offer stages and Joined are managed in Offers &amp; Joining, or by dragging on the Recruitment board. Record
                the decision after each stage in the Stage feedback tab.
              </p>
            </div>

            {c.status === "Assessment" && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
                <p>This candidate is at the Assessment stage.</p>
                <button onClick={() => setTab("feedback")} className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                  Record the assessment score
                </button>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Contact and qualification</h3>
              <div className="mt-3 space-y-2 text-sm">
                <p className="flex items-center gap-2 text-slate-800">
                  <Phone className="h-4 w-4 text-slate-400" />
                  {c.phone ? (
                    <a href={telHref(c.phone)} className="text-indigo-700 hover:underline">
                      {c.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400">No number recorded</span>
                  )}
                </p>
                <p className="flex items-center gap-2 text-slate-800">
                  <Mail className="h-4 w-4 text-slate-400" />
                  {c.email ? (
                    <a href={mailHref(c.email)} className="break-all text-indigo-700 hover:underline">
                      {c.email}
                    </a>
                  ) : (
                    <span className="text-slate-400">No email recorded</span>
                  )}
                </p>
                <div className="pt-1">
                  <p className="text-xs text-slate-500">Qualification</p>
                  <p className="text-slate-900">{c.qualifications || <span className="text-slate-400">Not recorded</span>}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Profile strength</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {strength.percent === null ? "Not scored" : `${Math.round(strength.percent)}%`}
                </p>
                <p className="text-[11px] text-slate-400">
                  {strength.scored === 0 ? "No scores yet" : `${strength.points} points, ${strength.scored} of ${strength.total} scored`}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Assessment score</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {assessFb ? `${Math.round((assessFb.score / assessFb.score_max) * 100)}%` : "Not recorded"}
                </p>
                <p className="text-[11px] text-slate-400">{assessFb ? `${assessFb.score} / ${assessFb.score_max}` : `Out of ${ASSESSMENT_MAX}`}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Next follow-up</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{fmtDate(c.followup_date) ?? "None"}</p>
                <p className="text-[11px] text-slate-400">{personName(c.recruiter_id)}</p>
              </div>
            </div>
          </div>
        )}

        {tab === "feedback" && (
          <StageFeedback
            candidate={c}
            personName={personName}
            onChanged={() => {
              loadAll();
              router.refresh();
            }}
          />
        )}

        {tab === "scores" && (
          <div className="mt-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Total points</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {strength.points} <span className="text-sm font-normal text-slate-500">/ {SCORE_TOTAL_MAX}</span>
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Profile strength</p>
                <p className="mt-1">
                  {strength.percent === null ? (
                    <span className="text-xl font-semibold text-slate-900">-</span>
                  ) : (
                    <span className={`rounded-full px-2.5 py-0.5 text-lg font-semibold ${strengthStyle(strength.percent)}`}>
                      {Math.round(strength.percent)}%
                    </span>
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Criteria scored</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {strength.scored} <span className="text-sm font-normal text-slate-500">of {strength.total}</span>
                </p>
              </div>
            </div>
            {!strength.complete && strength.scored > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Profile strength is based on the {strength.scored} criteria scored so far. It updates as the rest are added.
              </p>
            )}

            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Functional evaluation</h3>
                {fBand && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BAND_STYLE[fBand.grade]}`}>
                    Form guide: {fBand.grade} - {fBand.label}
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-3">{SCORE_CRITERIA.filter((x) => x.group === "functional").map(scoreRow)}</div>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  HR evaluation ({hr.total} / {hr.max})
                </h3>
                {hBand && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BAND_STYLE[hBand.grade]}`}>
                    Form guide: {hBand.grade} - {hBand.label}
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-3">{SCORE_CRITERIA.filter((x) => x.group === "hr").map(scoreRow)}</div>
              {!hr.complete && <p className="mt-3 text-xs text-slate-400">The HR grade appears once all five criteria are scored.</p>}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Grades follow the evaluation form and are a guide only. Decisions are recorded in the Stage feedback tab.
            </p>

            <h3 className="mt-6 text-sm font-semibold text-slate-900">New assessment</h3>
            <p className="mt-1 text-xs text-slate-500">
              Scale: Excellent, Good, Fair, Poor, as on the evaluation form. Leave a score blank if it was not assessed. The
              technical interviewer and HR can each add their own.
            </p>

            <p className="mt-4 text-xs font-semibold uppercase text-slate-500">Functional evaluation</p>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SCORE_CRITERIA.filter((x) => x.group === "functional").map(scoreSelect)}
            </div>
            <p className="mt-4 text-xs font-semibold uppercase text-slate-500">HR evaluation</p>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">{SCORE_CRITERIA.filter((x) => x.group === "hr").map(scoreSelect)}</div>

            <label className="mt-4 block text-xs font-medium text-slate-700">Remarks</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={inputCls} />
            {scoreMsg && <p className={`mt-2 text-sm ${scoreMsg.ok ? "text-green-600" : "text-red-600"}`}>{scoreMsg.text}</p>}
            <button onClick={saveAssessment} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Save assessment
            </button>
            <p className="mt-2 text-xs text-slate-400">Assessments are kept as a record and cannot be edited or deleted. Add a new one to update scores.</p>

            <h3 className="mt-6 text-sm font-semibold text-slate-900">Assessment history</h3>
            <ul className="mt-3 space-y-2">
              {assessList.length === 0 && <li className="text-sm text-slate-500">None yet.</li>}
              {assessList.map((a) => {
                const scored = SCORE_CRITERIA.filter((crit) => typeof a[crit.key] === "number");
                const pts = scored.reduce((s, crit) => s + (a[crit.key] as number), 0);
                const mx = scored.reduce((s, crit) => s + crit.max, 0);
                return (
                  <li key={a.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">
                      {pts} of {mx} points ({mx > 0 ? Math.round((pts / mx) * 100) : 0}%)
                    </p>
                    <p className="mt-1 text-xs text-slate-600">{scored.map((crit) => `${crit.label} ${a[crit.key]}/${crit.max}`).join(" - ")}</p>
                    {a.remarks && <p className="mt-1">{a.remarks}</p>}
                    <p className="mt-1 text-xs text-slate-400">
                      {personName(a.assessor_id)} - <span suppressHydrationWarning>{new Date(a.created_at).toLocaleString()}</span>
                    </p>
                  </li>
                );
              })}
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

        {tab === "profile" && (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Full profile</h3>
              {!editing ? (
                <button
                  onClick={() => {
                    setF(fromCandidate(c));
                    setProfileMsg(null);
                    setEditing(true);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Edit
                </button>
              ) : (
                <button
                  onClick={() => {
                    setEditing(false);
                    setProfileMsg(null);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
            </div>

            {!editing ? (
              <>
                <SectionTitle>Personal details</SectionTitle>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  <Detail label="Date of birth" value={fmtDate(c.date_of_birth)} />
                  <span suppressHydrationWarning>
                    <Detail label="Age" value={age === null ? null : `${age} years`} />
                  </span>
                  <Detail label="Hometown" value={c.hometown} />
                  <Detail label="Marital status" value={c.marital_status} />
                  <div className="col-span-2">
                    <Detail label="Languages known" value={c.languages_known} />
                  </div>
                  <Detail label="Father's occupation" value={c.father_occupation} />
                  <Detail label="Mother's occupation" value={c.mother_occupation} />
                  <Detail label="Spouse's occupation" value={c.spouse_occupation} />
                </dl>

                <SectionTitle>Application</SectionTitle>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  <Detail label="Role category" value={categories.find((x) => x.id === c.category_id)?.name} />
                  <Detail label="Vacancy" value={vacancies.find((v) => v.id === c.vacancy_id)?.title} />
                  <Detail label="Position applied for" value={c.position_applied} />
                  <Detail label="Location applied for" value={c.location_applied} />
                  <Detail label="Source of application" value={c.source} />
                  <Detail label="Referred by" value={c.referred_by} />
                  <Detail label="Recruiter" value={personName(c.recruiter_id)} />
                  <Detail label="Follow-up date" value={fmtDate(c.followup_date)} />
                </dl>

                <SectionTitle>Background</SectionTitle>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  <Detail label="Qualification" value={c.qualifications} />
                  <Detail label="Field of experience" value={c.field_of_experience} />
                  <Detail
                    label="Years of experience"
                    value={c.experience_years == null ? null : c.experience_years === 0 ? "Fresher" : `${c.experience_years} years`}
                  />
                  <Detail label="Current salary" value={money(c.current_salary)} />
                  <Detail label="Expected CTC" value={ctc} />
                  <Detail label="Notice period / expected joining" value={c.notice_period} />
                  <div className="col-span-2">
                    <Detail label="Notes" value={c.notes} />
                  </div>
                </dl>
              </>
            ) : (
              <>
                <CandidateFields f={f} update={update} categories={categories} vacancies={vacancies} people={people} />
                {profileMsg && <p className={`mt-3 text-sm ${profileMsg.ok ? "text-green-600" : "text-red-600"}`}>{profileMsg.text}</p>}
                <button
                  onClick={saveProfile}
                  disabled={saving || !f.full_name.trim()}
                  className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save details"}
                </button>
              </>
            )}
            {!editing && profileMsg?.ok && <p className="mt-3 text-sm text-green-600">{profileMsg.text}</p>}
          </div>
        )}
      </div>
    </div>
  );
}