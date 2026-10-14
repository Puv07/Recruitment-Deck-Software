"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/nav";

type Employee = {
  id: string;
  employee_code: string;
  full_name: string;
  work_email: string | null;
  phone: string | null;
  centre_id: string | null;
  department_id: string | null;
  designation: string | null;
  reports_to: string | null;
  date_of_joining: string | null;
  employment_type: string;
  status: string;
  qualifications: string | null;
  onboarding_status: string;
};
type Pending = {
  id: string;
  candidate_name: string;
  joined_on: string;
  centre_id: string | null;
  department_id: string | null;
  designation: string;
};
type Named = { id: string; name: string };
type EventRow = { id: string; author_id: string; body: string; created_at: string };

const TYPES = ["Full-time", "Part-time", "Contract", "Intern"];
const STATUSES = ["Active", "On Notice", "Inactive", "Exited"];

const STATUS_STYLE: Record<string, string> = {
  Active: "bg-green-50 text-green-700",
  "On Notice": "bg-yellow-50 text-yellow-700",
  Inactive: "bg-slate-100 text-slate-600",
  Exited: "bg-slate-100 text-slate-500",
};

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";

const DUP_MSG = "That employee ID or work email is already in use.";

type FormValues = {
  code: string;
  name: string;
  email: string;
  phone: string;
  centreId: string;
  deptId: string;
  designation: string;
  doj: string;
  type: string;
  reportsTo: string;
  qualifications: string;
};

export default function EmployeesClient({
  role,
  employees,
  pending,
  centres,
  departments,
  loadError,
}: {
  role: Role;
  employees: Employee[];
  pending: Pending[];
  centres: Named[];
  departments: Named[];
  loadError: string;
}) {
  const router = useRouter();
  const canEdit = ["super_admin", "hr_head", "hr_operations"].includes(role);

  const [q, setQ] = useState("");
  const [centreF, setCentreF] = useState("");
  const [deptF, setDeptF] = useState("");
  const [statusF, setStatusF] = useState("Active");
  const [showAdd, setShowAdd] = useState(false);
  const [fromJoining, setFromJoining] = useState<Pending | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const centreName = (id: string | null) => centres.find((c) => c.id === id)?.name ?? "-";
  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name ?? "-";
  const empName = (id: string | null) => employees.find((e) => e.id === id)?.full_name ?? "-";

  const rows = employees.filter((e) => {
    if (statusF && e.status !== statusF) return false;
    if (centreF && e.centre_id !== centreF) return false;
    if (deptF && e.department_id !== deptF) return false;
    if (q) {
      const hay = `${e.full_name} ${e.employee_code} ${e.work_email ?? ""} ${e.designation ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const selected = employees.find((e) => e.id === selectedId) ?? null;
  const count = (s: string) => employees.filter((e) => e.status === s).length;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Employee Directory</h1>
          <p className="mt-1 text-sm text-slate-500">Employee master records. Records are never deleted, only moved to Inactive or Exited.</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Add employee
          </button>
        )}
      </div>

      {loadError && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load employees: {loadError}</p>
      )}

      {canEdit && pending.length > 0 && (
        <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm font-semibold text-indigo-900">
            {pending.length} confirmed {pending.length === 1 ? "joiner needs" : "joiners need"} an employee record
          </p>
          <ul className="mt-3 space-y-2">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm">
                <span>
                  <span className="font-medium text-slate-900">{p.candidate_name}</span>
                  <span className="text-slate-500"> - joined {p.joined_on}</span>
                </span>
                <button
                  onClick={() => setFromJoining(p)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  Create employee record
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Active", count("Active")],
          ["On notice", count("On Notice")],
          ["Inactive or exited", count("Inactive") + count("Exited")],
          ["Joiners without a record", pending.length],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, ID, email"
            className="w-64 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <select value={centreF} onChange={(e) => setCentreF(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All centres</option>
          {centres.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={deptF} onChange={(e) => setDeptF(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {employees.length === 0
              ? "No employees yet. Add one, or create a record from a confirmed joiner."
              : "No employees match these filters."}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">ID</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Designation</th>
                <th className="px-4 py-2 font-medium">Centre</th>
                <th className="px-4 py-2 font-medium">Department</th>
                <th className="px-4 py-2 font-medium">Joined</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Onboarding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((e) => (
                <tr key={e.id} onClick={() => setSelectedId(e.id)} className="cursor-pointer hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{e.employee_code}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{e.full_name}</p>
                    <p className="text-xs text-slate-500">{e.work_email ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.designation ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{centreName(e.centre_id)}</td>
                  <td className="px-4 py-3 text-slate-600">{deptName(e.department_id)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{e.date_of_joining ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[e.status]}`}>{e.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.onboarding_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <EmployeeFormModal
          mode="manual"
          employees={employees}
          centres={centres}
          departments={departments}
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}
      {fromJoining && (
        <EmployeeFormModal
          mode="joining"
          pending={fromJoining}
          employees={employees}
          centres={centres}
          departments={departments}
          onClose={() => setFromJoining(null)}
          onDone={() => {
            setFromJoining(null);
            router.refresh();
          }}
        />
      )}
      {selected && (
        <EmployeeDrawer
          key={selected.id}
          employee={selected}
          employees={employees}
          centres={centres}
          departments={departments}
          canEdit={canEdit}
          centreName={centreName}
          deptName={deptName}
          empName={empName}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function EmployeeFormModal({
  mode,
  pending,
  employees,
  centres,
  departments,
  onClose,
  onDone,
}: {
  mode: "manual" | "joining";
  pending?: Pending;
  employees: Employee[];
  centres: Named[];
  departments: Named[];
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [v, setV] = useState<FormValues>({
    code: "",
    name: pending?.candidate_name ?? "",
    email: "",
    phone: "",
    centreId: pending?.centre_id ?? "",
    deptId: pending?.department_id ?? "",
    designation: pending?.designation ?? "",
    doj: pending?.joined_on ?? "",
    type: "Full-time",
    reportsTo: "",
    qualifications: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof FormValues, val: string) => setV((p) => ({ ...p, [k]: val }));

  async function save() {
    setSaving(true);
    setError("");

    if (mode === "joining" && pending) {
      const { error } = await supabase.rpc("create_employee_from_joining", {
        p_joining_id: pending.id,
        p_employee_code: v.code.trim(),
        p_centre_id: v.centreId || null,
        p_department_id: v.deptId || null,
        p_designation: v.designation.trim(),
        p_employment_type: v.type,
        p_work_email: v.email.trim(),
        p_phone: v.phone.trim(),
      });
      if (error) {
        setError(error.code === "23505" ? DUP_MSG : error.message);
        setSaving(false);
        return;
      }
      onDone();
      return;
    }

    const { data, error } = await supabase
      .from("employees")
      .insert({
        employee_code: v.code.trim(),
        full_name: v.name.trim(),
        work_email: v.email.trim() || null,
        phone: v.phone.trim() || null,
        centre_id: v.centreId || null,
        department_id: v.deptId || null,
        designation: v.designation.trim() || null,
        date_of_joining: v.doj || null,
        employment_type: v.type,
        reports_to: v.reportsTo || null,
        qualifications: v.qualifications.trim() || null,
      })
      .select("id")
      .single();
    if (error || !data) {
      setError(error?.code === "23505" ? DUP_MSG : error?.message ?? "Could not save the employee.");
      setSaving(false);
      return;
    }
    await supabase.from("employee_events").insert({ employee_id: data.id, body: "Employee record created manually" });
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === "joining" ? "Create employee record" : "Add employee"}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {mode === "joining" && (
          <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
            Name and joining date come from the confirmed joining record and cannot be edited here.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Employee ID</label>
            <input value={v.code} onChange={(e) => set("code", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Full name</label>
            <input disabled={mode === "joining"} value={v.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Work email</label>
            <input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Phone</label>
            <input value={v.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Centre</label>
            <select value={v.centreId} onChange={(e) => set("centreId", e.target.value)} className={inputCls}>
              <option value="">None</option>
              {centres.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Department</label>
            <select value={v.deptId} onChange={(e) => set("deptId", e.target.value)} className={inputCls}>
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Designation</label>
            <input value={v.designation} onChange={(e) => set("designation", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Employment type</label>
            <select value={v.type} onChange={(e) => set("type", e.target.value)} className={inputCls}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Date of joining</label>
            <input type="date" disabled={mode === "joining"} value={v.doj} onChange={(e) => set("doj", e.target.value)} className={inputCls} />
          </div>
          {mode === "manual" && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Reporting manager</label>
              <select value={v.reportsTo} onChange={(e) => set("reportsTo", e.target.value)} className={inputCls}>
                <option value="">None</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>
                ))}
              </select>
            </div>
          )}
        </div>
        {mode === "manual" && (
          <>
            <label className="mt-3 block text-sm font-medium text-slate-700">Qualifications</label>
            <input value={v.qualifications} onChange={(e) => set("qualifications", e.target.value)} className={inputCls} />
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !v.code.trim() || !v.name.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : mode === "joining" ? "Create record" : "Add employee"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmployeeDrawer({
  employee,
  employees,
  centres,
  departments,
  canEdit,
  centreName,
  deptName,
  empName,
  onClose,
}: {
  employee: Employee;
  employees: Employee[];
  centres: Named[];
  departments: Named[];
  canEdit: boolean;
  centreName: (id: string | null) => string;
  deptName: (id: string | null) => string;
  empName: (id: string | null) => string;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const e = employee;

  const [events, setEvents] = useState<EventRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(e.full_name);
  const [email, setEmail] = useState(e.work_email ?? "");
  const [phone, setPhone] = useState(e.phone ?? "");
  const [centreId, setCentreId] = useState(e.centre_id ?? "");
  const [deptId, setDeptId] = useState(e.department_id ?? "");
  const [designation, setDesignation] = useState(e.designation ?? "");
  const [reportsTo, setReportsTo] = useState(e.reports_to ?? "");
  const [doj, setDoj] = useState(e.date_of_joining ?? "");
  const [type, setType] = useState(e.employment_type);
  const [status, setStatus] = useState(e.status);
  const [qualifications, setQualifications] = useState(e.qualifications ?? "");

  async function loadEvents() {
    const { data } = await supabase
      .from("employee_events")
      .select("id, author_id, body, created_at")
      .eq("employee_id", e.id)
      .order("created_at", { ascending: false });
    setEvents(data ?? []);
    const ids = Array.from(new Set((data ?? []).map((x) => x.author_id)));
    if (ids.length > 0) {
      const { data: people } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map: Record<string, string> = {};
      (people ?? []).forEach((p) => (map[p.id] = p.full_name || p.email || "Unknown"));
      setAuthors(map);
    }
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.id]);

  async function save() {
    setSaving(true);
    setMsg(null);
    const next = {
      full_name: name.trim(),
      work_email: email.trim() || null,
      phone: phone.trim() || null,
      centre_id: centreId || null,
      department_id: deptId || null,
      designation: designation.trim() || null,
      reports_to: reportsTo || null,
      date_of_joining: doj || null,
      employment_type: type,
      status,
      qualifications: qualifications.trim() || null,
    };

    const changes: string[] = [];
    const diff = (label: string, a: string | null, b: string | null) => {
      if ((a ?? "") !== (b ?? "")) changes.push(`${label}: ${a || "none"} to ${b || "none"}`);
    };
    diff("Name", e.full_name, next.full_name);
    diff("Work email", e.work_email, next.work_email);
    diff("Phone", e.phone, next.phone);
    diff("Centre", centreName(e.centre_id), centreName(next.centre_id));
    diff("Department", deptName(e.department_id), deptName(next.department_id));
    diff("Designation", e.designation, next.designation);
    diff("Reporting manager", empName(e.reports_to), empName(next.reports_to));
    diff("Date of joining", e.date_of_joining, next.date_of_joining);
    diff("Employment type", e.employment_type, next.employment_type);
    diff("Status", e.status, next.status);
    if ((e.qualifications ?? "") !== (next.qualifications ?? "")) changes.push("Qualifications updated");

    if (changes.length === 0) {
      setMsg({ ok: false, text: "Nothing has changed." });
      setSaving(false);
      return;
    }

    const { data, error } = await supabase.from("employees").update(next).eq("id", e.id).select("id");
    if (error || !data || data.length === 0) {
      setMsg({
        ok: false,
        text: error?.code === "23505" ? DUP_MSG : error?.message ?? "You do not have permission to change this record.",
      });
      setSaving(false);
      return;
    }
    await supabase.from("employee_events").insert({ employee_id: e.id, body: changes.join("; ") });
    await loadEvents();
    router.refresh();
    setMsg({ ok: true, text: "Saved." });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{e.full_name}</h2>
            <p className="mt-1 text-xs text-slate-500">
              Employee ID {e.employee_code} - onboarding {e.onboarding_status}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500">Full name</label>
            <input disabled={!canEdit} value={name} onChange={(ev) => setName(ev.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Work email</label>
            <input disabled={!canEdit} value={email} onChange={(ev) => setEmail(ev.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Phone</label>
            <input disabled={!canEdit} value={phone} onChange={(ev) => setPhone(ev.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Centre</label>
            <select disabled={!canEdit} value={centreId} onChange={(ev) => setCentreId(ev.target.value)} className={inputCls}>
              <option value="">None</option>
              {centres.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Department</label>
            <select disabled={!canEdit} value={deptId} onChange={(ev) => setDeptId(ev.target.value)} className={inputCls}>
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Designation</label>
            <input disabled={!canEdit} value={designation} onChange={(ev) => setDesignation(ev.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Reporting manager</label>
            <select disabled={!canEdit} value={reportsTo} onChange={(ev) => setReportsTo(ev.target.value)} className={inputCls}>
              <option value="">None</option>
              {employees
                .filter((x) => x.id !== e.id)
                .map((x) => (
                  <option key={x.id} value={x.id}>{x.full_name} ({x.employee_code})</option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Date of joining</label>
            <input type="date" disabled={!canEdit} value={doj} onChange={(ev) => setDoj(ev.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Employment type</label>
            <select disabled={!canEdit} value={type} onChange={(ev) => setType(ev.target.value)} className={inputCls}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500">Status</label>
            <select disabled={!canEdit} value={status} onChange={(ev) => setStatus(ev.target.value)} className={inputCls}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="mt-3 block text-xs font-medium text-slate-500">Qualifications</label>
        <input disabled={!canEdit} value={qualifications} onChange={(ev) => setQualifications(ev.target.value)} className={inputCls} />

        {!canEdit && (
          <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">Your role can view employee records but not change them.</p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          The employee ID cannot be changed after creation. Compensation, documents, attendance and leave are added in later steps.
        </p>
        {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}

        {canEdit && (
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        )}

        <h3 className="mt-6 text-sm font-semibold text-slate-900">Record history</h3>
        <ul className="mt-3 space-y-2">
          {events.length === 0 && <li className="text-sm text-slate-500">No history yet.</li>}
          {events.map((ev) => (
            <li key={ev.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <p>{ev.body}</p>
              <p className="mt-1 text-xs text-slate-400">
                {authors[ev.author_id] ?? "Unknown"} - {new Date(ev.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}