"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/nav";

type Vacancy = {
  id: string;
  title: string;
  centre_id: string;
  department_id: string | null;
  category_id: string | null;
  positions: number;
  employment_type: string;
  qualifications: string | null;
  experience: string | null;
  salary_range: string | null;
  description: string | null;
  hiring_manager_id: string | null;
  recruiter_id: string | null;
  priority: string;
  target_joining_date: string | null;
  approval_status: string;
};
type CandLite = { id: string; vacancy_id: string | null; status: string };
type Named = { id: string; name: string };
type Person = { id: string; full_name: string | null; email: string | null };

const PRIORITIES = ["Critical", "High", "Medium", "Low"];
const TYPES = ["Full-time", "Part-time", "Contract", "Internship"];
const APPROVALS = ["Draft", "Pending Approval", "Approved", "Rejected", "Closed"];
const STAGES = [
  "New",
  "Contacted",
  "Screening",
  "Interview Scheduled",
  "Interview Completed",
  "Selected",
  "Offer Released",
  "Offer Accepted",
  "Joined",
  "On Hold",
  "Rejected",
  "Withdrawn",
  "Did Not Join",
];

const APPROVAL_STYLE: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  "Pending Approval": "bg-yellow-50 text-yellow-700",
  Approved: "bg-green-50 text-green-700",
  Rejected: "bg-red-50 text-red-700",
  Closed: "bg-slate-100 text-slate-500",
};
const PRIORITY_STYLE: Record<string, string> = {
  Critical: "bg-red-50 text-red-700",
  High: "bg-orange-50 text-orange-700",
  Medium: "bg-yellow-50 text-yellow-700",
  Low: "bg-slate-100 text-slate-600",
};

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";

export default function RecruitmentClient({
  role,
  heading,
  fixedCategory,
  defaultCategoryId,
  categories,
  vacancies,
  candidates,
  centres,
  departments,
  people,
  loadError,
}: {
  role: Role;
  heading: string;
  fixedCategory: boolean;
  defaultCategoryId: string | null;
  categories: Named[];
  vacancies: Vacancy[];
  candidates: CandLite[];
  centres: Named[];
  departments: Named[];
  people: Person[];
  loadError: string;
}) {
  const router = useRouter();
  const canEdit = ["super_admin", "hr_head", "recruitment_lead"].includes(role);
  const canApprove = ["super_admin", "hr_head"].includes(role);

  const [q, setQ] = useState("");
  const [centreF, setCentreF] = useState("");
  const [statusF, setStatusF] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const centreName = (id: string) => centres.find((c) => c.id === id)?.name ?? "-";
  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name ?? "-";
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorised";
  const personName = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Unknown";
  };

  const rows = vacancies.filter((v) => {
    if (centreF && v.centre_id !== centreF) return false;
    if (statusF && v.approval_status !== statusF) return false;
    if (q && !v.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const selected = vacancies.find((v) => v.id === selectedId) ?? null;
  const open = vacancies.filter((v) => v.approval_status === "Approved");

  const vacIds = new Set(vacancies.map((v) => v.id));
  const inView = candidates.filter((c) => c.vacancy_id && vacIds.has(c.vacancy_id));

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <Link
        href="/recruitment"
        className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> All categories
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{heading}</h1>
          <p className="mt-1 text-sm text-slate-500">Vacancies and their approval status.</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> New vacancy
          </button>
        )}
      </div>

      {loadError && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load vacancies: {loadError}</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Approved vacancies</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{open.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Approved positions</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {open.reduce((s, v) => s + v.positions, 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Awaiting approval</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {vacancies.filter((v) => v.approval_status === "Pending Approval").length}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Candidate pipeline ({inView.length})</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STAGES.map((s) => {
            const n = inView.filter((c) => c.status === s).length;
            return (
              <span
                key={s}
                className={`rounded-lg px-3 py-1.5 text-xs ${
                  n > 0 ? "bg-indigo-50 text-indigo-800" : "bg-slate-50 text-slate-400"
                }`}
              >
                <span className="font-semibold">{n}</span> {s}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Only candidates linked to these vacancies are counted, and only ones you are allowed to see.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search vacancies"
            className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <select value={centreF} onChange={(e) => setCentreF(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All centres</option>
          {centres.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All approval statuses</option>
          {APPROVALS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {vacancies.length === 0 ? "No vacancies here yet. Click New vacancy to create one." : "No vacancies match these filters."}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Vacancy</th>
                <th className="px-4 py-2 font-medium">Centre</th>
                <th className="px-4 py-2 text-right font-medium">Positions</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium">Approval</th>
                <th className="px-4 py-2 text-right font-medium">Candidates</th>
                <th className="px-4 py-2 text-right font-medium">Joined</th>
                <th className="px-4 py-2 font-medium">Recruiter</th>
                <th className="px-4 py-2 font-medium">Target joining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((v) => {
                const mine = candidates.filter((c) => c.vacancy_id === v.id);
                return (
                  <tr key={v.id} onClick={() => setSelectedId(v.id)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{v.title}</p>
                      <p className="text-xs text-slate-500">
                        {!fixedCategory && `${categoryName(v.category_id)} - `}
                        {deptName(v.department_id)} - {v.employment_type}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{centreName(v.centre_id)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{v.positions}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[v.priority]}`}>{v.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${APPROVAL_STYLE[v.approval_status]}`}>{v.approval_status}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{mine.length}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{mine.filter((c) => c.status === "Joined").length}</td>
                    <td className="px-4 py-3 text-slate-600">{personName(v.recruiter_id)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{v.target_joining_date ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <VacancyForm
          mode="new"
          categories={categories}
          defaultCategoryId={defaultCategoryId}
          centres={centres}
          departments={departments}
          people={people}
          canApprove={canApprove}
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}
      {selected && (
        <VacancyForm
          key={selected.id}
          mode="edit"
          vacancy={selected}
          categories={categories}
          defaultCategoryId={defaultCategoryId}
          centres={centres}
          departments={departments}
          people={people}
          canEdit={canEdit}
          canApprove={canApprove}
          onClose={() => setSelectedId(null)}
          onDone={() => {
            setSelectedId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function VacancyForm({
  mode,
  vacancy,
  categories,
  defaultCategoryId,
  centres,
  departments,
  people,
  canEdit = true,
  canApprove,
  onClose,
  onDone,
}: {
  mode: "new" | "edit";
  vacancy?: Vacancy;
  categories: Named[];
  defaultCategoryId: string | null;
  centres: Named[];
  departments: Named[];
  people: Person[];
  canEdit?: boolean;
  canApprove: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const v = vacancy;
  const [title, setTitle] = useState(v?.title ?? "");
  const [categoryId, setCategoryId] = useState(v ? v.category_id ?? "" : defaultCategoryId ?? "");
  const [centreId, setCentreId] = useState(v?.centre_id ?? "");
  const [deptId, setDeptId] = useState(v?.department_id ?? "");
  const [positions, setPositions] = useState(String(v?.positions ?? 1));
  const [type, setType] = useState(v?.employment_type ?? "Full-time");
  const [qualifications, setQualifications] = useState(v?.qualifications ?? "");
  const [experience, setExperience] = useState(v?.experience ?? "");
  const [salary, setSalary] = useState(v?.salary_range ?? "");
  const [description, setDescription] = useState(v?.description ?? "");
  const [managerId, setManagerId] = useState(v?.hiring_manager_id ?? "");
  const [recruiterId, setRecruiterId] = useState(v?.recruiter_id ?? "");
  const [priority, setPriority] = useState(v?.priority ?? "Medium");
  const [target, setTarget] = useState(v?.target_joining_date ?? "");
  const [approval, setApproval] = useState(v?.approval_status ?? "Draft");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    const row = {
      title: title.trim(),
      category_id: categoryId || null,
      centre_id: centreId,
      department_id: deptId || null,
      positions: Math.max(1, parseInt(positions || "1", 10) || 1),
      employment_type: type,
      qualifications: qualifications.trim() || null,
      experience: experience.trim() || null,
      salary_range: salary.trim() || null,
      description: description.trim() || null,
      hiring_manager_id: managerId || null,
      recruiter_id: recruiterId || null,
      priority,
      target_joining_date: target || null,
      approval_status: approval,
    };
    const res =
      mode === "new"
        ? await supabase.from("vacancies").insert(row).select("id")
        : await supabase.from("vacancies").update(row).eq("id", v!.id).select("id");
    if (res.error || !res.data || res.data.length === 0) {
      setError(res.error?.message ?? "You do not have permission to change this vacancy.");
      setSaving(false);
      return;
    }
    onDone();
  }

  const dis = !canEdit;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{mode === "new" ? "New vacancy" : "Vacancy details"}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">Job title</label>
        <input disabled={dis} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />

        <label className="mt-4 block text-sm font-medium text-slate-700">Role category</label>
        <select disabled={dis} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
          <option value="">Uncategorised</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Centre</label>
            <select disabled={dis} value={centreId} onChange={(e) => setCentreId(e.target.value)} className={inputCls}>
              <option value="">Select</option>
              {centres.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Department</label>
            <select disabled={dis} value={deptId} onChange={(e) => setDeptId(e.target.value)} className={inputCls}>
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Number of positions</label>
            <input disabled={dis} type="number" min={1} value={positions} onChange={(e) => setPositions(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Employment type</label>
            <select disabled={dis} value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Priority</label>
            <select disabled={dis} value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Target joining date</label>
            <input disabled={dis} type="date" value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Recruiter</label>
            <select disabled={dis} value={recruiterId} onChange={(e) => setRecruiterId(e.target.value)} className={inputCls}>
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Hiring manager</label>
            <select disabled={dis} value={managerId} onChange={(e) => setManagerId(e.target.value)} className={inputCls}>
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">Qualifications</label>
        <input disabled={dis} value={qualifications} onChange={(e) => setQualifications(e.target.value)} className={inputCls} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Experience</label>
            <input disabled={dis} value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="e.g. 2 to 4 years" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Salary range</label>
            <input disabled={dis} value={salary} onChange={(e) => setSalary(e.target.value)} className={inputCls} />
          </div>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">Job description</label>
        <textarea disabled={dis} value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputCls} />

        <label className="mt-4 block text-sm font-medium text-slate-700">Approval status</label>
        <select disabled={dis} value={approval} onChange={(e) => setApproval(e.target.value)} className={inputCls}>
          {APPROVALS.map((a) => (
            <option key={a} disabled={!canApprove && (a === "Approved" || a === "Rejected") && a !== v?.approval_status}>
              {a}
            </option>
          ))}
        </select>
        {!canApprove && (
          <p className="mt-1 text-xs text-slate-500">Only HR Head or Super Admin can mark a vacancy Approved or Rejected.</p>
        )}

        {!canEdit && (
          <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">Your role has read-only access to vacancies.</p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {canEdit ? "Cancel" : "Close"}
          </button>
          {canEdit && (
            <button
              onClick={save}
              disabled={saving || !title.trim() || !centreId}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : mode === "new" ? "Create vacancy" : "Save changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}