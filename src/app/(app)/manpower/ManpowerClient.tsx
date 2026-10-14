"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/nav";

type Position = {
  id: string;
  centre_id: string;
  department_id: string;
  designation: string;
  approved_headcount: number;
  active_headcount: number;
  open_vacancies: number;
  additional_requested: number;
  additional_status: string;
  urgency: string;
  recruiter_id: string | null;
  hiring_manager_id: string | null;
  requested_joining_date: string | null;
  justification: string | null;
  notes: string | null;
  is_sample: boolean;
};
type Named = { id: string; name: string };
type Person = { id: string; full_name: string | null; email: string | null };
type HistoryRow = { id: string; author_id: string; body: string; created_at: string };

const URGENCIES = ["Critical", "High", "Medium", "Low"];
const ADD_STATUSES = ["None", "Pending", "Approved", "Rejected"];

const URGENCY_STYLE: Record<string, string> = {
  Critical: "bg-red-50 text-red-700",
  High: "bg-orange-50 text-orange-700",
  Medium: "bg-yellow-50 text-yellow-700",
  Low: "bg-slate-100 text-slate-600",
};

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";

const toInt = (v: string) => Math.max(0, parseInt(v || "0", 10) || 0);

export default function ManpowerClient({
  role,
  positions,
  centres,
  departments,
  people,
  loadError,
}: {
  role: Role;
  positions: Position[];
  centres: Named[];
  departments: Named[];
  people: Person[];
  loadError: string;
}) {
  const router = useRouter();
  const canEdit = ["super_admin", "hr_head", "recruitment_lead"].includes(role);
  const canAddCentre = ["super_admin", "hr_head"].includes(role);

  const [centreF, setCentreF] = useState("");
  const [deptF, setDeptF] = useState("");
  const [q, setQ] = useState("");
  const [gapsOnly, setGapsOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showCentre, setShowCentre] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const centreName = (id: string) => centres.find((c) => c.id === id)?.name ?? "-";
  const deptName = (id: string) => departments.find((d) => d.id === id)?.name ?? "-";
  const personName = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Unknown";
  };

  const rows = positions.filter((p) => {
    if (centreF && p.centre_id !== centreF) return false;
    if (deptF && p.department_id !== deptF) return false;
    if (gapsOnly && p.open_vacancies === 0) return false;
    if (q && !p.designation.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const totals = rows.reduce(
    (a, p) => ({
      approved: a.approved + p.approved_headcount,
      active: a.active + p.active_headcount,
      vacancies: a.vacancies + p.open_vacancies,
      pending: a.pending + (p.additional_status === "Pending" ? p.additional_requested : 0),
    }),
    { approved: 0, active: 0, vacancies: 0, pending: 0 }
  );

  const byCentre = centres
    .map((c) => {
      const r = positions.filter((p) => p.centre_id === c.id);
      return {
        id: c.id,
        name: c.name,
        approved: r.reduce((s, p) => s + p.approved_headcount, 0),
        active: r.reduce((s, p) => s + p.active_headcount, 0),
        vacancies: r.reduce((s, p) => s + p.open_vacancies, 0),
      };
    })
    .filter((c) => c.approved > 0 || c.active > 0);

  const selected = positions.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Manpower Planner</h1>
          <p className="mt-1 text-sm text-slate-500">
            Approved headcount, active staff and open vacancies by centre.
          </p>
        </div>
        <div className="flex gap-2">
          {canAddCentre && (
            <button
              onClick={() => setShowCentre(true)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Add centre
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Add position
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Could not load positions: {loadError}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Approved headcount" value={totals.approved} />
        <Card label="Active headcount" value={totals.active} />
        <Card label="Open vacancies" value={totals.vacancies} tone={totals.vacancies > 0 ? "warn" : undefined} />
        <Card label="Additional requests pending" value={totals.pending} hint="Tracked separately from approved headcount" />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Active headcount is entered by hand for now. It will be calculated automatically once the Employee Directory is built.
      </p>

      {byCentre.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {byCentre.map((c) => (
            <button
              key={c.id}
              onClick={() => setCentreF(centreF === c.id ? "" : c.id)}
              className={`rounded-xl border bg-white p-4 text-left shadow-sm hover:border-indigo-300 ${
                centreF === c.id ? "border-indigo-500" : "border-slate-200"
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">{c.name}</p>
              <p className="mt-2 text-xs text-slate-500">
                Approved {c.approved} - Active {c.active}
              </p>
              <p className={`mt-1 text-sm font-medium ${c.vacancies > 0 ? "text-red-600" : "text-green-600"}`}>
                {c.vacancies > 0 ? `${c.vacancies} open vacancies` : "Fully staffed"}
              </p>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
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
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search designation"
            className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={gapsOnly} onChange={(e) => setGapsOnly(e.target.checked)} />
          Only show gaps
        </label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {positions.length === 0
              ? "No positions yet. Click Add position to start."
              : "No positions match these filters."}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Centre</th>
                <th className="px-4 py-2 font-medium">Department</th>
                <th className="px-4 py-2 font-medium">Designation</th>
                <th className="px-4 py-2 text-right font-medium">Approved</th>
                <th className="px-4 py-2 text-right font-medium">Active</th>
                <th className="px-4 py-2 text-right font-medium">Vacancies</th>
                <th className="px-4 py-2 text-right font-medium">Extra requested</th>
                <th className="px-4 py-2 font-medium">Urgency</th>
                <th className="px-4 py-2 font-medium">Recruiter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <tr key={p.id} onClick={() => setSelectedId(p.id)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">
                    {centreName(p.centre_id)}
                    {p.is_sample && (
                      <span className="ml-2 rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">Sample</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{deptName(p.department_id)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{p.designation}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{p.approved_headcount}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{p.active_headcount}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.open_vacancies > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                      {p.open_vacancies > 0 ? `${p.open_vacancies} open` : "Full"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {p.additional_requested > 0 ? `${p.additional_requested} (${p.additional_status})` : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_STYLE[p.urgency]}`}>{p.urgency}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{personName(p.recruiter_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <AddPositionModal
          centres={centres}
          departments={departments}
          people={people}
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}
      {showCentre && (
        <AddCentreModal
          onClose={() => setShowCentre(false)}
          onDone={() => {
            setShowCentre(false);
            router.refresh();
          }}
        />
      )}
      {selected && (
        <PositionDrawer
          key={selected.id}
          position={selected}
          people={people}
          canEdit={canEdit}
          centreName={centreName}
          deptName={deptName}
          personName={personName}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function Card({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: "warn" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${tone === "warn" ? "text-red-600" : "text-slate-900"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function PersonSelect({
  value,
  onChange,
  people,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  people: Person[];
  disabled?: boolean;
}) {
  return (
    <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">Unassigned</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.full_name || p.email}
        </option>
      ))}
    </select>
  );
}

function AddPositionModal({
  centres,
  departments,
  people,
  onClose,
  onDone,
}: {
  centres: Named[];
  departments: Named[];
  people: Person[];
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [centreId, setCentreId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [designation, setDesignation] = useState("");
  const [approved, setApproved] = useState("0");
  const [active, setActive] = useState("0");
  const [urgency, setUrgency] = useState("Medium");
  const [recruiterId, setRecruiterId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    const { data, error } = await supabase
      .from("manpower_positions")
      .insert({
        centre_id: centreId,
        department_id: deptId,
        designation: designation.trim(),
        approved_headcount: toInt(approved),
        active_headcount: toInt(active),
        urgency,
        recruiter_id: recruiterId || null,
      })
      .select("id")
      .single();
    if (error || !data) {
      setError(
        error?.code === "23505"
          ? "This centre already has that designation in that department. Open the existing row and edit it instead."
          : error?.message ?? "Could not save."
      );
      setSaving(false);
      return;
    }
    await supabase
      .from("manpower_history")
      .insert({ position_id: data.id, body: `Position created (approved ${toInt(approved)}, active ${toInt(active)})` });
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Add position</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Centre</label>
            <select value={centreId} onChange={(e) => setCentreId(e.target.value)} className={inputCls}>
              <option value="">Select</option>
              {centres.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Department</label>
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className={inputCls}>
              <option value="">Select</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">Designation</label>
        <input value={designation} onChange={(e) => setDesignation(e.target.value)} className={inputCls} />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Approved headcount</label>
            <input type="number" min={0} value={approved} onChange={(e) => setApproved(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Active headcount</label>
            <input type="number" min={0} value={active} onChange={(e) => setActive(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Hiring urgency</label>
            <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className={inputCls}>
              {URGENCIES.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Recruiter</label>
            <PersonSelect value={recruiterId} onChange={setRecruiterId} people={people} />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !centreId || !deptId || !designation.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add position"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddCentreModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    const { error } = await supabase
      .from("centres")
      .insert({ name: name.trim(), city: city.trim() || null, state: state.trim() || null });
    if (error) {
      setError(error.code === "23505" ? "A centre with this name already exists." : error.message);
      setSaving(false);
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Add centre</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">Centre name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">State</label>
            <input value={state} onChange={(e) => setState(e.target.value)} className={inputCls} />
          </div>
        </div>
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
            {saving ? "Saving..." : "Add centre"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PositionDrawer({
  position,
  people,
  canEdit,
  centreName,
  deptName,
  personName,
  onClose,
}: {
  position: Position;
  people: Person[];
  canEdit: boolean;
  centreName: (id: string) => string;
  deptName: (id: string) => string;
  personName: (id: string | null) => string;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [approved, setApproved] = useState(String(position.approved_headcount));
  const [active, setActive] = useState(String(position.active_headcount));
  const [additional, setAdditional] = useState(String(position.additional_requested));
  const [addStatus, setAddStatus] = useState(position.additional_status);
  const [urgency, setUrgency] = useState(position.urgency);
  const [recruiterId, setRecruiterId] = useState(position.recruiter_id ?? "");
  const [managerId, setManagerId] = useState(position.hiring_manager_id ?? "");
  const [joinDate, setJoinDate] = useState(position.requested_joining_date ?? "");
  const [justification, setJustification] = useState(position.justification ?? "");
  const [notes, setNotes] = useState(position.notes ?? "");

  async function loadHistory() {
    const { data } = await supabase
      .from("manpower_history")
      .select("id, author_id, body, created_at")
      .eq("position_id", position.id)
      .order("created_at", { ascending: false });
    setHistory(data ?? []);
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.id]);

  async function save() {
    setSaving(true);
    setMsg("");
    const next = {
      approved_headcount: toInt(approved),
      active_headcount: toInt(active),
      additional_requested: toInt(additional),
      additional_status: addStatus,
      urgency,
      recruiter_id: recruiterId || null,
      hiring_manager_id: managerId || null,
      requested_joining_date: joinDate || null,
      justification: justification.trim() || null,
      notes: notes.trim() || null,
    };

    const changes: string[] = [];
    const diff = (label: string, a: unknown, b: unknown) => {
      if ((a ?? "") !== (b ?? "")) changes.push(`${label}: ${a ?? "none"} to ${b ?? "none"}`);
    };
    diff("Approved headcount", position.approved_headcount, next.approved_headcount);
    diff("Active headcount", position.active_headcount, next.active_headcount);
    diff("Additional requested", position.additional_requested, next.additional_requested);
    diff("Additional status", position.additional_status, next.additional_status);
    diff("Urgency", position.urgency, next.urgency);
    diff("Recruiter", personName(position.recruiter_id), personName(next.recruiter_id));
    diff("Hiring manager", personName(position.hiring_manager_id), personName(next.hiring_manager_id));
    diff("Requested joining date", position.requested_joining_date, next.requested_joining_date);
    if ((position.justification ?? "") !== (next.justification ?? "")) changes.push("Justification updated");
    if ((position.notes ?? "") !== (next.notes ?? "")) changes.push("Notes updated");

    if (changes.length === 0) {
      setMsg("Nothing has changed.");
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("manpower_positions")
      .update(next)
      .eq("id", position.id)
      .select("id");
    if (error || !data || data.length === 0) {
      setMsg(error?.message ?? "You do not have permission to change this position.");
      setSaving(false);
      return;
    }
    await supabase
      .from("manpower_history")
      .insert({ position_id: position.id, body: changes.join("; ") });
    await loadHistory();
    router.refresh();
    setMsg("Saved.");
    setSaving(false);
  }

  const vacancies = Math.max(toInt(approved) - toInt(active), 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{position.designation}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {centreName(position.centre_id)} - {deptName(position.department_id)}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Approved headcount</label>
            <input type="number" min={0} disabled={!canEdit} value={approved} onChange={(e) => setApproved(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Active headcount</label>
            <input type="number" min={0} disabled={!canEdit} value={active} onChange={(e) => setActive(e.target.value)} className={inputCls} />
          </div>
        </div>
        <p className={`mt-2 text-sm font-medium ${vacancies > 0 ? "text-red-600" : "text-green-600"}`}>
          Open vacancies: {vacancies}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Additional positions requested</label>
            <input type="number" min={0} disabled={!canEdit} value={additional} onChange={(e) => setAdditional(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Request status</label>
            <select disabled={!canEdit} value={addStatus} onChange={(e) => setAddStatus(e.target.value)} className={inputCls}>
              {ADD_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Hiring urgency</label>
            <select disabled={!canEdit} value={urgency} onChange={(e) => setUrgency(e.target.value)} className={inputCls}>
              {URGENCIES.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Requested joining date</label>
            <input type="date" disabled={!canEdit} value={joinDate} onChange={(e) => setJoinDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Recruiter</label>
            <PersonSelect disabled={!canEdit} value={recruiterId} onChange={setRecruiterId} people={people} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Hiring manager</label>
            <PersonSelect disabled={!canEdit} value={managerId} onChange={setManagerId} people={people} />
          </div>
        </div>

        <label className="mt-4 block text-xs font-medium text-slate-500">Hiring justification</label>
        <textarea disabled={!canEdit} value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} className={inputCls} />
        <label className="mt-3 block text-xs font-medium text-slate-500">Notes</label>
        <textarea disabled={!canEdit} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />

        {!canEdit && (
          <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
            Your role has read-only access to manpower records.
          </p>
        )}
        {msg && <p className={`mt-3 text-sm ${msg === "Saved." ? "text-green-600" : "text-red-600"}`}>{msg}</p>}

        {canEdit && (
          <button
            onClick={save}
            disabled={saving}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        )}

        <h3 className="mt-6 text-sm font-semibold text-slate-900">Change history</h3>
        <ul className="mt-3 space-y-2">
          {history.length === 0 && <li className="text-sm text-slate-500">No changes recorded yet.</li>}
          {history.map((h) => (
            <li key={h.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <p>{h.body}</p>
              <p className="mt-1 text-xs text-slate-400">
                {personName(h.author_id)} - {new Date(h.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}