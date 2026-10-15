"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { POSTING_PLATFORMS } from "@/lib/options";

type Posting = {
  id: string;
  title: string;
  vacancy_id: string | null;
  category_id: string | null;
  platform: string;
  posting_url: string | null;
  posted_on: string;
  expires_on: string | null;
  status: string;
  applications_received: number;
  cost: number | null;
  owner_id: string | null;
  notes: string | null;
};
type VacLite = { id: string; title: string; category_id: string | null };
type Named = { id: string; name: string };
type CandLite = { id: string; vacancy_id: string | null };
type Person = { id: string; full_name: string | null; email: string | null };
type EventRow = { id: string; author_id: string; body: string; created_at: string };
type Msg = { ok: boolean; text: string } | null;

const STATUSES = ["Draft", "Live", "Paused", "Closed"];

const STATUS_STYLE: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  Live: "bg-green-50 text-green-700",
  Paused: "bg-yellow-50 text-yellow-700",
  Closed: "bg-slate-100 text-slate-500",
  Expired: "bg-red-50 text-red-700",
};

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";

const DUP_MSG = "This posting (same title, platform and posted date) already exists.";

function safeUrl(u: string | null): string | null {
  if (!u) return null;
  try {
    const parsed = new URL(u.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

const numOrNull = (v: string) => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const intOr0 = (v: string) => Math.max(0, parseInt(v || "0", 10) || 0);
const money = (n: number | null) => (n == null ? "-" : n.toLocaleString("en-IN"));

export default function PostingsClient({
  userId,
  postings,
  vacancies,
  categories,
  candidates,
  people,
  loadError,
}: {
  userId: string;
  postings: Posting[];
  vacancies: VacLite[];
  categories: Named[];
  candidates: CandLite[];
  people: Person[];
  loadError: string;
}) {
  const router = useRouter();

  const [today, setToday] = useState("");
  const [soon, setSoon] = useState("");
  const [q, setQ] = useState("");
  const [categoryF, setCategoryF] = useState("");
  const [platformF, setPlatformF] = useState("");
  const [statusF, setStatusF] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const t = new Date();
    const s = new Date();
    s.setDate(s.getDate() + 7);
    setToday(t.toLocaleDateString("en-CA"));
    setSoon(s.toLocaleDateString("en-CA"));
  }, []);

  const effective = (p: Posting) =>
    today && p.status === "Live" && p.expires_on && p.expires_on < today ? "Expired" : p.status;

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "-";
  const personName = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Unknown";
  };
  const candidatesFor = (p: Posting) =>
    p.vacancy_id ? candidates.filter((c) => c.vacancy_id === p.vacancy_id).length : null;

  const stats = {
    live: postings.filter((p) => effective(p) === "Live").length,
    soon: postings.filter(
      (p) => effective(p) === "Live" && !!p.expires_on && !!today && p.expires_on >= today && p.expires_on <= soon
    ).length,
    expired: postings.filter((p) => effective(p) === "Expired").length,
    applications: postings.reduce((s, p) => s + p.applications_received, 0),
  };

  const rows = postings.filter((p) => {
    if (categoryF && p.category_id !== categoryF) return false;
    if (platformF && p.platform !== platformF) return false;
    if (statusF && effective(p) !== statusF) return false;
    if (q && !p.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const platforms = Array.from(new Set([...POSTING_PLATFORMS, ...postings.map((p) => p.platform)]));
  const selected = postings.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Job Postings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track where each vacancy is advertised. This is a manual tracker: it does not publish to job sites.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Add posting
        </button>
      </div>

      {loadError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load postings: {loadError}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Live postings", stats.live, "text-slate-900"],
          ["Expiring in 7 days", stats.soon, stats.soon > 0 ? "text-yellow-600" : "text-slate-900"],
          ["Expired, needs action", stats.expired, stats.expired > 0 ? "text-red-600" : "text-slate-900"],
          ["Applications received", stats.applications, "text-slate-900"],
        ].map(([label, value, tone]) => (
          <div key={label as string} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search postings"
            className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <select value={categoryF} onChange={(e) => setCategoryF(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All role categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={platformF} onChange={(e) => setPlatformF(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All platforms</option>
          {platforms.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {[...STATUSES, "Expired"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {postings.length === 0 ? "No postings yet. Click Add posting to record the first one." : "No postings match these filters."}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Posting</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Platform</th>
                <th className="px-4 py-2 font-medium">Posted</th>
                <th className="px-4 py-2 font-medium">Expires</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Applications</th>
                <th className="px-4 py-2 text-right font-medium">Candidates in system</th>
                <th className="px-4 py-2 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => {
                const st = effective(p);
                const n = candidatesFor(p);
                return (
                  <tr key={p.id} onClick={() => setSelectedId(p.id)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{p.title}</td>
                    <td className="px-4 py-3 text-slate-600">{categoryName(p.category_id)}</td>
                    <td className="px-4 py-3 text-slate-600">{p.platform}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{p.posted_on}</td>
                    <td className={`whitespace-nowrap px-4 py-3 ${st === "Expired" ? "font-medium text-red-600" : "text-slate-600"}`}>
                      {p.expires_on ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[st]}`}>{st}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{p.applications_received}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{n === null ? "-" : n}</td>
                    <td className="px-4 py-3 text-slate-600">{personName(p.owner_id)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Candidates in system counts everyone linked to the same vacancy (all platforms together), and only people you are allowed to see.
      </p>

      {showAdd && (
        <AddPostingModal
          userId={userId}
          vacancies={vacancies}
          categories={categories}
          platforms={platforms}
          people={people}
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}
      {selected && (
        <PostingDrawer
          key={selected.id}
          posting={selected}
          effectiveStatus={effective(selected)}
          candidateCount={candidatesFor(selected)}
          platforms={platforms}
          people={people}
          personName={personName}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function AddPostingModal({
  userId,
  vacancies,
  categories,
  platforms,
  people,
  onClose,
  onDone,
}: {
  userId: string;
  vacancies: VacLite[];
  categories: Named[];
  platforms: string[];
  people: Person[];
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [vacancyId, setVacancyId] = useState("");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [platform, setPlatform] = useState(platforms[0] ?? "Other");
  const [url, setUrl] = useState("");
  const [postedOn, setPostedOn] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [expiresOn, setExpiresOn] = useState("");
  const [status, setStatus] = useState("Live");
  const [applications, setApplications] = useState("0");
  const [cost, setCost] = useState("");
  const [ownerId, setOwnerId] = useState(userId);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function pickVacancy(id: string) {
    setVacancyId(id);
    const v = vacancies.find((x) => x.id === id);
    if (v) {
      if (!title.trim()) setTitle(v.title);
      if (v.category_id) setCategoryId(v.category_id);
    }
  }

  async function save() {
    setError("");
    if (url.trim() && !safeUrl(url)) {
      setError("The link must start with http:// or https://");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("job_postings")
      .insert({
        title: title.trim(),
        vacancy_id: vacancyId || null,
        category_id: categoryId || null,
        platform,
        posting_url: url.trim() ? safeUrl(url) : null,
        posted_on: postedOn,
        expires_on: expiresOn || null,
        status,
        applications_received: intOr0(applications),
        cost: numOrNull(cost),
        owner_id: ownerId || null,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();
    if (error || !data) {
      setError(
        error?.code === "23505"
          ? DUP_MSG
          : error?.code === "23514"
          ? "The expiry date cannot be before the posted date."
          : error?.message ?? "Could not save the posting."
      );
      setSaving(false);
      return;
    }
    await supabase.from("job_posting_events").insert({ posting_id: data.id, body: `Posting created on ${platform} (${status})` });
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Add job posting</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">Linked vacancy (optional)</label>
        <select value={vacancyId} onChange={(e) => pickVacancy(e.target.value)} className={inputCls}>
          <option value="">None</option>
          {vacancies.map((v) => (
            <option key={v.id} value={v.id}>{v.title}</option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-medium text-slate-700">Posting title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Role category</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls}>
              {platforms.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Posted on</label>
            <input type="date" value={postedOn} onChange={(e) => setPostedOn(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Expires on</label>
            <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Owner</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputCls}>
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Applications so far</label>
            <input type="number" min={0} value={applications} onChange={(e) => setApplications(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Cost (optional)</label>
            <input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} />
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">Posting link (optional)</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className={inputCls} />

        <label className="mt-4 block text-sm font-medium text-slate-700">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !title.trim() || !postedOn}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add posting"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PostingDrawer({
  posting,
  effectiveStatus,
  candidateCount,
  platforms,
  people,
  personName,
  onClose,
}: {
  posting: Posting;
  effectiveStatus: string;
  candidateCount: number | null;
  platforms: string[];
  people: Person[];
  personName: (id: string | null) => string;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const p = posting;

  const [events, setEvents] = useState<EventRow[]>([]);
  const [msg, setMsg] = useState<Msg>(null);
  const [saving, setSaving] = useState(false);

  const [platform, setPlatform] = useState(p.platform);
  const [url, setUrl] = useState(p.posting_url ?? "");
  const [postedOn, setPostedOn] = useState(p.posted_on);
  const [expiresOn, setExpiresOn] = useState(p.expires_on ?? "");
  const [status, setStatus] = useState(p.status);
  const [applications, setApplications] = useState(String(p.applications_received));
  const [cost, setCost] = useState(p.cost == null ? "" : String(p.cost));
  const [ownerId, setOwnerId] = useState(p.owner_id ?? "");
  const [notes, setNotes] = useState(p.notes ?? "");

  async function loadEvents() {
    const { data } = await supabase
      .from("job_posting_events")
      .select("id, author_id, body, created_at")
      .eq("posting_id", p.id)
      .order("created_at", { ascending: false });
    setEvents(data ?? []);
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);

  async function save() {
    setMsg(null);
    if (url.trim() && !safeUrl(url)) {
      setMsg({ ok: false, text: "The link must start with http:// or https://" });
      return;
    }
    setSaving(true);
    const next = {
      platform,
      posting_url: url.trim() ? safeUrl(url) : null,
      posted_on: postedOn,
      expires_on: expiresOn || null,
      status,
      applications_received: intOr0(applications),
      cost: numOrNull(cost),
      owner_id: ownerId || null,
      notes: notes.trim() || null,
    };

    const changes: string[] = [];
    const diff = (label: string, a: string | number | null, b: string | number | null) => {
      if ((a ?? "") !== (b ?? "")) changes.push(`${label}: ${a ?? "none"} to ${b ?? "none"}`);
    };
    diff("Platform", p.platform, next.platform);
    diff("Posted on", p.posted_on, next.posted_on);
    diff("Expires on", p.expires_on, next.expires_on);
    diff("Status", p.status, next.status);
    diff("Applications", p.applications_received, next.applications_received);
    diff("Cost", p.cost, next.cost);
    diff("Owner", personName(p.owner_id), personName(next.owner_id));
    if ((p.posting_url ?? "") !== (next.posting_url ?? "")) changes.push("Link updated");
    if ((p.notes ?? "") !== (next.notes ?? "")) changes.push("Notes updated");

    if (changes.length === 0) {
      setMsg({ ok: false, text: "Nothing has changed." });
      setSaving(false);
      return;
    }

    const { data, error } = await supabase.from("job_postings").update(next).eq("id", p.id).select("id");
    if (error || !data || data.length === 0) {
      setMsg({
        ok: false,
        text:
          error?.code === "23505"
            ? DUP_MSG
            : error?.code === "23514"
            ? "The expiry date cannot be before the posted date."
            : error?.message ?? "You do not have permission to change this posting.",
      });
      setSaving(false);
      return;
    }
    await supabase.from("job_posting_events").insert({ posting_id: p.id, body: changes.join("; ") });
    await loadEvents();
    router.refresh();
    setMsg({ ok: true, text: "Saved." });
    setSaving(false);
  }

  const link = safeUrl(p.posting_url);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{p.title}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {effectiveStatus === "Expired" ? "Expired - renew the posting or set it to Closed" : `Status: ${effectiveStatus}`}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
          >
            Open posting <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {candidateCount !== null && (
          <p className="mt-2 text-sm text-slate-600">{candidateCount} candidate(s) in your database are linked to this vacancy.</p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls}>
              {platforms.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Posted on</label>
            <input type="date" value={postedOn} onChange={(e) => setPostedOn(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Expires on</label>
            <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Applications received</label>
            <input type="number" min={0} value={applications} onChange={(e) => setApplications(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Cost</label>
            <input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} />
          </div>
        </div>
        {p.cost != null && p.applications_received > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            Cost per application: {money(Math.round((p.cost / p.applications_received) * 100) / 100)}
          </p>
        )}

        <label className="mt-3 block text-xs font-medium text-slate-500">Owner</label>
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputCls}>
          <option value="">Unassigned</option>
          {people.map((x) => (
            <option key={x.id} value={x.id}>{x.full_name || x.email}</option>
          ))}
        </select>

        <label className="mt-3 block text-xs font-medium text-slate-500">Posting link</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className={inputCls} />

        <label className="mt-3 block text-xs font-medium text-slate-500">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />

        {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
        <button
          onClick={save}
          disabled={saving}
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
                {personName(e.author_id)} - <span suppressHydrationWarning>{new Date(e.created_at).toLocaleString()}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}