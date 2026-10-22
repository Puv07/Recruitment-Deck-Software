"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  TASK_CATEGORIES,
  TASK_CATEGORY_FOR,
  classify,
  cleanSubject,
  suggestDue,
  suggestPriority,
} from "@/lib/email-rules";

type Email = {
  id: string;
  sender: string;
  subject: string;
  received_at: string | null;
  body: string;
  category: string;
  status: string;
  task_id: string | null;
  imported_by: string | null;
  imported_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};
type Person = { id: string; full_name: string | null; email: string | null };
type Named = { id: string; name: string };
type TaskLite = { id: string; title: string; status: string; due_date: string | null; assigned_to: string | null };
type Msg = { ok: boolean; text: string } | null;

const PRIORITIES = ["Critical", "High", "Medium", "Low"];

const STATUS_STYLE: Record<string, string> = {
  New: "bg-blue-50 text-blue-700",
  "Task created": "bg-green-50 text-green-700",
  Linked: "bg-indigo-50 text-indigo-700",
  Dismissed: "bg-slate-100 text-slate-500",
};

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-";

export default function EmailClient({
  userId,
  emails,
  people,
  centres,
  tasks,
  loadError,
}: {
  userId: string;
  emails: Email[];
  people: Person[];
  centres: Named[];
  tasks: TaskLite[];
  loadError: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<"new" | "reviewed" | "all">("new");
  const [q, setQ] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const personName = (id: string | null) => {
    if (!id) return "Unknown";
    const p = people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Unknown";
  };

  const count = (s: string) => emails.filter((e) => e.status === s).length;

  const rows = emails.filter((e) => {
    if (view === "new" && e.status !== "New") return false;
    if (view === "reviewed" && e.status === "New") return false;
    if (q) {
      const hay = `${e.sender} ${e.subject}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const selected = emails.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Email to Tasks</h1>
          <p className="mt-1 text-sm text-slate-500">Turn HR emails into tasks you review and approve. Nothing is sent from here.</p>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Import email
        </button>
      </div>

      <p className="mt-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-900">
        Manual mode: emails are added by pasting them in. This app is not connected to your mailbox yet, so new emails will not
        appear on their own.
      </p>

      {loadError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load emails: {loadError}</p>}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Waiting for review", count("New")],
          ["Tasks created", count("Task created")],
          ["Linked to a task", count("Linked")],
          ["Dismissed", count("Dismissed")],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {(
            [
              ["new", "Waiting for review"],
              ["reviewed", "Reviewed"],
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
            placeholder="Search sender or subject"
            className="w-64 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {emails.length === 0 ? "No emails yet. Click Import email and paste one in." : "No emails match this view."}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Received</th>
                <th className="px-4 py-2 font-medium">From</th>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 font-medium">Suggested category</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((e) => (
                <tr key={e.id} onClick={() => setSelectedId(e.id)} className="cursor-pointer hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    <span suppressHydrationWarning>{fmt(e.received_at ?? e.imported_at)}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{e.sender}</td>
                  <td className="max-w-md truncate px-4 py-3 font-medium text-slate-900">{e.subject}</td>
                  <td className="px-4 py-3 text-slate-600">{e.category}</td>
                  <td className="px-4 py-3">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[e.status]}`}>
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false);
            router.refresh();
          }}
        />
      )}
      {selected && (
        <ReviewDrawer
          key={selected.id}
          email={selected}
          userId={userId}
          people={people}
          centres={centres}
          tasks={tasks}
          personName={personName}
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

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [received, setReceived] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    const guess = classify(subject, body);
    const { error } = await supabase.from("email_messages").insert({
      sender: sender.trim(),
      subject: subject.trim(),
      received_at: received ? new Date(received).toISOString() : null,
      body: body.trim(),
      category: guess.category,
    });
    if (error) {
      setError(
        error.code === "23505"
          ? "This email has already been imported."
          : error.code === "23514"
          ? "Check the lengths: the sender and subject must not be empty, and the text can be up to 20,000 characters."
          : error.message
      );
      setSaving(false);
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Import an email</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Copy the email from Gmail and paste its text here. Paste only what is needed, and leave out attachments and
          sensitive documents. The text is stored as plain text and never acted on automatically.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">From</label>
            <input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="name@example.com" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Date received (optional)</label>
            <input type="datetime-local" value={received} onChange={(e) => setReceived(e.target.value)} className={inputCls} />
          </div>
        </div>
        <label className="mt-3 block text-sm font-medium text-slate-700">Subject</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
        <label className="mt-3 block text-sm font-medium text-slate-700">Email text</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className={inputCls} />
        <p className="mt-1 text-xs text-slate-400">{body.length.toLocaleString()} / 20,000 characters</p>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || sender.trim().length < 3 || !subject.trim() || !body.trim() || body.length > 20000}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Import email"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewDrawer({
  email,
  userId,
  people,
  centres,
  tasks,
  personName,
  onClose,
  onDone,
}: {
  email: Email;
  userId: string;
  people: Person[];
  centres: Named[];
  tasks: TaskLite[];
  personName: (id: string | null) => string;
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const isNew = email.status === "New";
  const guess = useMemo(() => classify(email.subject, email.body), [email]);
  const prio = useMemo(() => suggestPriority(email.subject, email.body), [email]);

  const [title, setTitle] = useState(cleanSubject(email.subject));
  const [description, setDescription] = useState(`From ${email.sender}\n\n${email.body.slice(0, 1500)}`);
  const [category, setCategory] = useState(TASK_CATEGORY_FOR[email.category] ?? "General");
  const [priority, setPriority] = useState(prio.priority);
  const [assignee, setAssignee] = useState(userId);
  const [centreId, setCentreId] = useState("");
  const [due, setDue] = useState(suggestDue(prio.priority));
  const [linkTaskId, setLinkTaskId] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const linkedTask = tasks.find((t) => t.id === email.task_id);

  async function createTask() {
    setMsg(null);
    if (!title.trim()) {
      setMsg({ ok: false, text: "Please enter a task title." });
      return;
    }
    const who = assignee ? personName(assignee) : "nobody (unassigned)";
    if (!window.confirm(`Create this task and assign it to ${who}?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("create_task_from_email", {
      p_email_id: email.id,
      p_title: title.trim(),
      p_description: description.trim(),
      p_category: category,
      p_priority: priority,
      p_assigned_to: assignee || null,
      p_centre_id: centreId || null,
      p_due_date: due || null,
    });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    onDone();
  }

  async function linkTask() {
    setMsg(null);
    if (!linkTaskId) return;
    if (!window.confirm("Link this email to the selected task? No new task will be created.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("link_email_to_task", { p_email_id: email.id, p_task_id: linkTaskId });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    onDone();
  }

  async function dismiss() {
    setMsg(null);
    if (!window.confirm("Dismiss this email? It will not become a task.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("dismiss_email", { p_email_id: email.id, p_note: note.trim() || null });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="h-full w-full max-w-5xl overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Review email</h2>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[email.status]}`}>
              {email.status}
            </span>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <section>
            <h3 className="text-sm font-semibold text-slate-900">Original email</h3>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-slate-500">From</dt>
                <dd className="break-all text-slate-900">{email.sender}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-slate-500">Subject</dt>
                <dd className="text-slate-900">{email.subject}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-slate-500">Received</dt>
                <dd className="text-slate-900" suppressHydrationWarning>
                  {fmt(email.received_at)}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-slate-500">Imported</dt>
                <dd className="text-slate-900" suppressHydrationWarning>
                  {personName(email.imported_by)} - {fmt(email.imported_at)}
                </dd>
              </div>
            </dl>
            <pre className="mt-3 max-h-[28rem] overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-sans text-sm text-slate-800">
              {email.body}
            </pre>
            <p className="mt-2 text-xs text-slate-400">Shown as plain text. Links and code in the email do nothing here.</p>
          </section>

          <section>
            {isNew ? (
              <>
                <h3 className="text-sm font-semibold text-slate-900">Proposed task</h3>
                <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                  Suggested category: <strong>{guess.category}</strong>
                  {guess.matched.length > 0 && ` (matched: ${guess.matched.slice(0, 5).join(", ")})`}. Suggested priority:{" "}
                  <strong>{prio.priority}</strong> ({prio.reason}). These are simple keyword guesses, so please check them.
                </p>

                <label className="mt-3 block text-xs font-medium text-slate-500">Task title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />

                <label className="mt-3 block text-xs font-medium text-slate-500">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className={inputCls} />

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500">Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                      {TASK_CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500">Priority</label>
                    <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
                      {PRIORITIES.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500">Assign to</label>
                    <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputCls}>
                      <option value="">Unassigned</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500">Due date (suggested)</label>
                    <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <label className="mt-3 block text-xs font-medium text-slate-500">Centre</label>
                <select value={centreId} onChange={(e) => setCentreId(e.target.value)} className={inputCls}>
                  <option value="">None</option>
                  {centres.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}

                <button
                  onClick={createTask}
                  disabled={busy}
                  className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy ? "Working..." : "Approve and create task"}
                </button>

                <div className="mt-6 rounded-xl border border-slate-200 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Or link to an existing task</h4>
                  <select value={linkTaskId} onChange={(e) => setLinkTaskId(e.target.value)} className={inputCls}>
                    <option value="">Select an open task</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.status})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={linkTask}
                    disabled={busy || !linkTaskId}
                    className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Link email to task
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Or dismiss it</h4>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" className={inputCls} />
                  <button
                    onClick={dismiss}
                    disabled={busy}
                    className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Dismiss email
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-slate-900">Outcome</h3>
                <div className="mt-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[email.status]}`}>{email.status}</span>
                  </p>
                  {email.task_id && (
                    <p className="mt-3">
                      {email.status === "Task created" ? "Task created: " : "Linked to: "}
                      <strong>{linkedTask?.title ?? "a task (completed, cancelled or not visible to you)"}</strong>
                      <br />
                      <Link href="/tasks" className="font-medium text-indigo-600 hover:underline">
                        Open the Task Command Centre
                      </Link>
                    </p>
                  )}
                  {email.review_note && <p className="mt-3">Note: {email.review_note}</p>}
                  <p className="mt-3 text-xs text-slate-500" suppressHydrationWarning>
                    Reviewed by {personName(email.reviewed_by)} on {fmt(email.reviewed_at)}
                  </p>
                </div>
                <p className="mt-3 text-xs text-slate-400">A reviewed email cannot be changed, so it can never create a second task.</p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}