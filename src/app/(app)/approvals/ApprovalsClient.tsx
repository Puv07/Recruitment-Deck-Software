"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/nav";

type Vac = {
  id: string;
  title: string;
  centre_id: string;
  positions: number;
  priority: string;
  salary_range: string | null;
  created_by: string | null;
  updated_at: string;
};
type Off = {
  id: string;
  candidate_name: string;
  vacancy_title: string | null;
  proposed_compensation: number | null;
  expected_joining_date: string | null;
  created_by: string | null;
  updated_at: string;
};
type Man = {
  id: string;
  centre_id: string;
  designation: string;
  additional_requested: number;
  justification: string | null;
  created_by: string | null;
  updated_at: string;
};
type Decision = {
  id: string;
  subject_type: string;
  subject_label: string;
  decision: string;
  comment: string | null;
  decided_by: string;
  decided_at: string;
};
type Named = { id: string; name: string };
type Person = { id: string; full_name: string | null; email: string | null };

type Kind = "vacancy" | "offer" | "manpower";
type Item = {
  key: string;
  type: Kind;
  id: string;
  typeLabel: string;
  title: string;
  lines: string[];
  requester: string | null;
  updated: string;
};

const DECISION_STYLE: Record<string, string> = {
  Approved: "bg-green-50 text-green-700",
  Rejected: "bg-red-50 text-red-700",
  Returned: "bg-yellow-50 text-yellow-700",
};

const inputCls =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";

export default function ApprovalsClient({
  role,
  vacancies,
  offers,
  manpower,
  decisions,
  centres,
  people,
}: {
  role: Role;
  vacancies: Vac[];
  offers: Off[];
  manpower: Man[];
  decisions: Decision[];
  centres: Named[];
  people: Person[];
}) {
  const router = useRouter();
  const canDecide = ["super_admin", "hr_head"].includes(role);

  const [tab, setTab] = useState<"pending" | "decided">("pending");
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const centreName = (id: string) => centres.find((c) => c.id === id)?.name ?? "-";
  const personName = (id: string | null) => {
    if (!id) return null;
    const p = people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Unknown";
  };

  const items: Item[] = [
    ...vacancies.map((v) => ({
      key: `vacancy:${v.id}`,
      type: "vacancy" as Kind,
      id: v.id,
      typeLabel: "Vacancy approval",
      title: v.title,
      lines: [
        `${centreName(v.centre_id)} - ${v.positions} ${v.positions === 1 ? "position" : "positions"} - ${v.priority} priority`,
        ...(v.salary_range ? [`Salary range: ${v.salary_range}`] : []),
      ],
      requester: personName(v.created_by),
      updated: v.updated_at,
    })),
    ...offers.map((o) => ({
      key: `offer:${o.id}`,
      type: "offer" as Kind,
      id: o.id,
      typeLabel: "Offer approval",
      title: o.candidate_name,
      lines: [
        o.vacancy_title ?? "No vacancy linked",
        `Proposed compensation: ${o.proposed_compensation == null ? "-" : o.proposed_compensation.toLocaleString("en-IN")}`,
        `Expected joining: ${o.expected_joining_date ?? "-"}`,
      ],
      requester: personName(o.created_by),
      updated: o.updated_at,
    })),
    ...manpower.map((m) => ({
      key: `manpower:${m.id}`,
      type: "manpower" as Kind,
      id: m.id,
      typeLabel: "Additional positions",
      title: m.designation,
      lines: [
        `${centreName(m.centre_id)} - ${m.additional_requested} additional ${m.additional_requested === 1 ? "position" : "positions"} requested`,
        ...(m.justification ? [`Justification: ${m.justification}`] : []),
      ],
      requester: personName(m.created_by),
      updated: m.updated_at,
    })),
  ].sort((a, b) => a.updated.localeCompare(b.updated));

  async function decide(item: Item, decision: "Approved" | "Rejected" | "Returned") {
    const comment = (comments[item.key] ?? "").trim();
    setErrors((e) => ({ ...e, [item.key]: "" }));

    if (decision !== "Approved" && !comment) {
      setErrors((e) => ({ ...e, [item.key]: "Please write a comment to reject or return this request." }));
      return;
    }
    const verb = decision === "Approved" ? "Approve" : decision === "Rejected" ? "Reject" : "Return for correction";
    if (!window.confirm(`${verb}: ${item.title}?`)) return;

    setBusy(item.key);
    const { error } = await createClient().rpc("decide_approval", {
      p_type: item.type,
      p_id: item.id,
      p_decision: decision,
      p_comment: comment || null,
    });
    setBusy(null);
    if (error) {
      setErrors((e) => ({ ...e, [item.key]: error.message }));
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Approvals</h1>
      <p className="mt-1 text-sm text-slate-500">
        Requests waiting for a decision. Approving a request never sends anything to a candidate.
      </p>

      <div className="mt-6 flex rounded-lg border border-slate-200 bg-white p-0.5 sm:w-fit">
        {(
          [
            ["pending", `Pending (${items.length})`],
            ["decided", "Decision log"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              tab === key ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!canDecide && (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          Only HR Head or Super Admin can decide approvals. You can see requests that your role has access to.
        </p>
      )}

      {tab === "pending" ? (
        <div className="mt-4 space-y-4">
          {items.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              Nothing is waiting for approval. To submit a request, set its approval status to Pending Approval in
              Recruitment, Offers, or Manpower Planner.
            </p>
          )}
          {items.map((item) => (
            <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    {item.typeLabel}
                  </span>
                  <h2 className="mt-2 text-base font-semibold text-slate-900">{item.title}</h2>
                </div>
                <p className="text-xs text-slate-400">
                  Requested by {item.requester ?? "unknown"} - {item.updated.slice(0, 10)}
                </p>
              </div>
              <ul className="mt-2 space-y-0.5 text-sm text-slate-600">
                {item.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>

              {canDecide ? (
                <>
                  <textarea
                    value={comments[item.key] ?? ""}
                    onChange={(e) => setComments((c) => ({ ...c, [item.key]: e.target.value }))}
                    rows={2}
                    placeholder="Comment (required to reject or return)"
                    className={inputCls}
                  />
                  {errors[item.key] && <p className="mt-2 text-sm text-red-600">{errors[item.key]}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => decide(item, "Approved")}
                      disabled={busy === item.key}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decide(item, "Returned")}
                      disabled={busy === item.key}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Return for correction
                    </button>
                    <button
                      onClick={() => decide(item, "Rejected")}
                      disabled={busy === item.key}
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-xs text-slate-500">Waiting for HR Head or Super Admin.</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {decisions.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No decisions recorded yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Request</th>
                  <th className="px-4 py-2 font-medium">Decision</th>
                  <th className="px-4 py-2 font-medium">Decided by</th>
                  <th className="px-4 py-2 font-medium">Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {decisions.map((d) => (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      <span suppressHydrationWarning>{new Date(d.decided_at).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{d.subject_label}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DECISION_STYLE[d.decision]}`}>
                        {d.decision}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{personName(d.decided_by) ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{d.comment ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}