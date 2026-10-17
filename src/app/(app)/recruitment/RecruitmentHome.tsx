"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Apple,
  Briefcase,
  ClipboardList,
  Dumbbell,
  GraduationCap,
  HeartHandshake,
  Plus,
  Stethoscope,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Cat = { id: string; name: string; slug: string; sort_order: number };
type Vac = { id: string; category_id: string | null; positions: number; approval_status: string };
type Cand = { id: string; vacancy_id: string | null; category_id: string | null; status: string };

const ICONS: Record<string, LucideIcon> = {
  physio: Activity,
  "patient-care-executive": HeartHandshake,
  "fitness-advisor": Dumbbell,
  nutritionist: Apple,
  "special-educator": GraduationCap,
  doctor: Stethoscope,
  admin: ClipboardList,
  "human-resources": Users,
};

const TONES = [
  "bg-indigo-50 text-indigo-700",
  "bg-blue-50 text-blue-700",
  "bg-emerald-50 text-emerald-700",
  "bg-amber-50 text-amber-700",
  "bg-rose-50 text-rose-700",
  "bg-violet-50 text-violet-700",
  "bg-cyan-50 text-cyan-700",
  "bg-slate-100 text-slate-700",
];

const CLOSED = ["Joined", "Rejected", "Withdrawn", "Did Not Join"];
const RESERVED = ["all", "uncategorised", "vacancy"];

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";

function summarise(vacs: Vac[], mine: Cand[]) {
  const approved = vacs.filter((v) => v.approval_status === "Approved");
  return {
    openVacancies: approved.length,
    positions: approved.reduce((s, v) => s + v.positions, 0),
    pending: vacs.filter((v) => v.approval_status === "Pending Approval").length,
    active: mine.filter((c) => !CLOSED.includes(c.status)).length,
    joined: mine.filter((c) => c.status === "Joined").length,
  };
}

function CategoryCard({
  href,
  name,
  Icon,
  tone,
  s,
}: {
  href: string;
  name: string;
  Icon: LucideIcon;
  tone: string;
  s: ReturnType<typeof summarise>;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
    >
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-base font-semibold text-slate-900">{name}</h2>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-2xl font-semibold text-slate-900">{s.openVacancies}</p>
          <p className="text-xs text-slate-500">Open vacancies</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-slate-900">{s.positions}</p>
          <p className="text-xs text-slate-500">Approved positions</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-slate-900">{s.active}</p>
          <p className="text-xs text-slate-500">In pipeline</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-slate-900">{s.joined}</p>
          <p className="text-xs text-slate-500">Joined</p>
        </div>
      </div>
      {s.pending > 0 && (
        <p className="mt-3 inline-block rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
          {s.pending} awaiting approval
        </p>
      )}
    </Link>
  );
}

export default function RecruitmentHome({
  canManage,
  categories,
  vacancies,
  candidates,
  loadError,
}: {
  canManage: boolean;
  categories: Cat[];
  vacancies: Vac[];
  candidates: Cand[];
  loadError: string;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);

  const uncatVacs = vacancies.filter((v) => v.category_id === null);
  const uncatIds = new Set(uncatVacs.map((v) => v.id));
  const uncatCands = candidates.filter((c) => !c.category_id && (!c.vacancy_id || uncatIds.has(c.vacancy_id)));

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Recruitment</h1>
          <p className="mt-1 text-sm text-slate-500">Choose a role category to open its candidate pipeline.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/recruitment/all"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            All candidates
          </Link>
          <Link
            href="/recruitment/all/vacancies"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            All vacancies
          </Link>
          {canManage && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Add category
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load recruitment data: {loadError}</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((c, i) => {
          const catVacs = vacancies.filter((v) => v.category_id === c.id);
          const ids = new Set(catVacs.map((v) => v.id));
          const mine = candidates.filter((x) => x.category_id === c.id || (x.vacancy_id && ids.has(x.vacancy_id)));
          return (
            <CategoryCard
              key={c.id}
              href={`/recruitment/${c.slug}`}
              name={c.name}
              Icon={ICONS[c.slug] ?? Briefcase}
              tone={TONES[i % TONES.length]}
              s={summarise(catVacs, mine)}
            />
          );
        })}
        {(uncatVacs.length > 0 || uncatCands.length > 0) && (
          <CategoryCard
            href="/recruitment/uncategorised"
            name="Uncategorised"
            Icon={Briefcase}
            tone="bg-slate-100 text-slate-700"
            s={summarise(uncatVacs, uncatCands)}
          />
        )}
      </div>

      {categories.length === 0 && !loadError && (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No categories yet. {canManage ? "Click Add category to create the first one." : "Ask HR Head or Super Admin to add some."}
        </p>
      )}
      <p className="mt-4 text-xs text-slate-400">
        Counts include only candidates you are allowed to see. A candidate belongs to a category through their role
        category or their vacancy.
      </p>

      {showAdd && (
        <AddCategoryModal
          categories={categories}
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AddCategoryModal({
  categories,
  onClose,
  onDone,
}: {
  categories: Cat[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const clean = name.trim();
    const slug = clean
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug || RESERVED.includes(slug)) {
      setError("Please choose a different name.");
      return;
    }
    setSaving(true);
    setError("");
    const next = Math.max(0, ...categories.map((c) => c.sort_order)) + 10;
    const { error } = await createClient().from("job_categories").insert({ name: clean, slug, sort_order: next });
    if (error) {
      setError(error.code === "23505" ? "A category with this name already exists." : error.message);
      setSaving(false);
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Add category</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">Category name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Occupational Therapist" className={inputCls} />
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
            {saving ? "Saving..." : "Add category"}
          </button>
        </div>
      </div>
    </div>
  );
}