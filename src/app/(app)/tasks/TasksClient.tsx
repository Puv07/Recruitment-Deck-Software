"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/nav";

type Task = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  created_by: string;
  centre_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  is_escalated: boolean;
  created_at: string;
};
type Person = { id: string; full_name: string | null; email: string | null };
type Centre = { id: string; name: string };
type Comment = {
  id: string;
  author_id: string;
  kind: string;
  body: string;
  created_at: string;
};

const PRIORITIES = ["Critical", "High", "Medium", "Low"];
const STATUSES = [
  "New",
  "In Progress",
  "Waiting for Approval",
  "Blocked",
  "Completed",
  "Cancelled",
];
const CATEGORIES = [
  "General",
  "Recruitment follow-up",
  "Missing employee documents",
  "Interview feedback",
  "Joining confirmation",
  "Compliance renewal",
  "Attendance correction",
  "Pending approval",
];

const PRIORITY_STYLE: Record<string, string> = {
  Critical: "bg-red-50 text-red-700",
  High: "bg-orange-50 text-orange-700",
  Medium: "bg-yellow-50 text-yellow-700",
  Low: "bg-slate-100 text-slate-600",
};
const STATUS_STYLE: Record<string, string> = {
  New: "bg-blue-50 text-blue-700",
  "In Progress": "bg-indigo-50 text-indigo-700",
  "Waiting for Approval": "bg-purple-50 text-purple-700",
  Blocked: "bg-red-50 text-red-700",
  Completed: "bg-green-50 text-green-700",
  Cancelled: "bg-slate-100 text-slate-500",
};

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";

function Badge({ text, style }: { text: string; style: string }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {text}
    </span>
  );
}

export default function TasksClient({
  userId,
  role,
  tasks,
  people,
  centres,
  loadError,
}: {
  userId: string;
  role: Role;
  tasks: Task[];
  people: Person[];
  centres: Centre[];
  loadError: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const canEdit = role !== "leadership";
  const today = new Date().toLocaleDateString("en-CA");

  const [view, setView] = useState<"mine" | "all" | "overdue">("mine");
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [priorityF, setPriorityF] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const nameOf = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Unknown";
  };
  const centreOf = (id: string | null) =>
    centres.find((c) => c.id === id)?.name ?? "-";

  const isOverdue = (t: Task) =>
    !!t.due_date &&
    t.due_date < today &&
    t.status !== "Completed" &&
    t.status !== "Cancelled";

  const filtered = tasks.filter((t) => {
    if (view === "mine" && t.assigned_to !== userId) return false;
    if (view === "overdue" && !isOverdue(t)) return false;
    if (statusF && t.status !== statusF) return false;
    if (priorityF && t.priority !== priorityF) return false;
    if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Task Command Centre</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create, assign and track HR work with a full history.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> New task
          </button>
        )}
      </div>

      {loadError && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Could not load tasks: {loadError}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {(
            [
              ["mine", "My tasks"],
              ["all", "All tasks"],
              ["overdue", "Overdue"],
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
            placeholder="Search tasks"
            className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={priorityF} onChange={(e) => setPriorityF(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {tasks.length === 0
              ? "No tasks yet. Click New task to create the first one."
              : "No tasks match these filters."}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Task</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Assigned to</th>
                <th className="px-4 py-2 font-medium">Centre</th>
                <th className="px-4 py-2 font-medium">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{t.title}</p>
                    <p className="text-xs text-slate-500">{t.category}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge text={t.priority} style={PRIORITY_STYLE[t.priority]} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge text={t.status} style={STATUS_STYLE[t.status]} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{nameOf(t.assigned_to)}</td>
                  <td className="px-4 py-3 text-slate-600">{centreOf(t.centre_id)}</td>
                  <td className={`whitespace-nowrap px-4 py-3 ${isOverdue(t) ? "font-medium text-red-600" : "text-slate-600"}`}>
                    {t.due_date ?? "-"}
                    {isOverdue(t) && " (overdue)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <NewTaskModal
          userId={userId}
          people={people}
          centres={centres}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            router.refresh();
          }}
        />
      )}

      {selected && (
        <TaskDrawer
          key={selected.id}
          task={selected}
          people={people}
          centres={centres}
          canEdit={canEdit}
          nameOf={nameOf}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function NewTaskModal({
  userId,
  people,
  centres,
  onClose,
  onCreated,
}: {
  userId: string;
  people: Person[];
  centres: Centre[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [priority, setPriority] = useState("Medium");
  const [assignedTo, setAssignedTo] = useState(userId);
  const [centreId, setCentreId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        category,
        priority,
        assigned_to: assignedTo || null,
        centre_id: centreId || null,
        due_date: dueDate || null,
      })
      .select("id")
      .single();
    if (error || !data) {
      setError(error?.message ?? "Could not create the task.");
      setSaving(false);
      return;
    }
    await supabase
      .from("task_comments")
      .insert({ task_id: data.id, kind: "activity", body: "Task created" });
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">New task</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />

        <label className="mt-4 block text-sm font-medium text-slate-700">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Assign to</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={inputCls}>
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">Centre</label>
        <select value={centreId} onChange={(e) => setCentreId(e.target.value)} className={inputCls}>
          <option value="">None</option>
          {centres.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create task"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskDrawer({
  task,
  people,
  centres,
  canEdit,
  nameOf,
  onClose,
}: {
  task: Task;
  people: Person[];
  centres: Centre[];
  canEdit: boolean;
  nameOf: (id: string | null) => string;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [msg, setMsg] = useState("");

  async function loadComments() {
    const { data } = await supabase
      .from("task_comments")
      .select("id, author_id, kind, body, created_at")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true });
    setComments(data ?? []);
  }

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  async function updateTask(patch: Record<string, unknown>, note: string) {
    setMsg("");
    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", task.id)
      .select("id");
    if (error || !data || data.length === 0) {
      setMsg(error?.message ?? "You do not have permission to change this task.");
      return;
    }
    await supabase
      .from("task_comments")
      .insert({ task_id: task.id, kind: "activity", body: note });
    await loadComments();
    router.refresh();
  }

  async function addComment() {
    const body = newComment.trim();
    if (!body) return;
    const { error } = await supabase
      .from("task_comments")
      .insert({ task_id: task.id, kind: "comment", body });
    if (error) {
      setMsg(error.message);
      return;
    }
    setNewComment("");
    await loadComments();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{task.title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {task.category} - created by {nameOf(task.created_by)}
        </p>
        {task.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{task.description}</p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Status</label>
            <select
              disabled={!canEdit}
              value={task.status}
              onChange={(e) =>
                updateTask(
                  {
                    status: e.target.value,
                    completed_at: e.target.value === "Completed" ? new Date().toISOString() : null,
                  },
                  `Status changed from ${task.status} to ${e.target.value}`
                )
              }
              className={inputCls}
            >
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Priority</label>
            <select
              disabled={!canEdit}
              value={task.priority}
              onChange={(e) =>
                updateTask(
                  { priority: e.target.value },
                  `Priority changed from ${task.priority} to ${e.target.value}`
                )
              }
              className={inputCls}
            >
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Assigned to</label>
            <select
              disabled={!canEdit}
              value={task.assigned_to ?? ""}
              onChange={(e) =>
                updateTask(
                  { assigned_to: e.target.value || null },
                  `Reassigned from ${nameOf(task.assigned_to)} to ${nameOf(e.target.value || null)}`
                )
              }
              className={inputCls}
            >
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Due date</label>
            <input
              type="date"
              disabled={!canEdit}
              value={task.due_date ?? ""}
              onChange={(e) =>
                updateTask(
                  { due_date: e.target.value || null },
                  `Due date changed from ${task.due_date ?? "none"} to ${e.target.value || "none"}`
                )
              }
              className={inputCls}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Centre: {centres.find((c) => c.id === task.centre_id)?.name ?? "None"}
        </p>
        {!canEdit && (
          <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
            Your role has read-only access to tasks.
          </p>
        )}
        {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}

        <h3 className="mt-6 text-sm font-semibold text-slate-900">Comments and activity</h3>
        <ul className="mt-3 space-y-3">
          {comments.length === 0 && <li className="text-sm text-slate-500">Nothing yet.</li>}
          {comments.map((c) => (
            <li
              key={c.id}
              className={`rounded-lg p-3 text-sm ${
                c.kind === "activity" ? "bg-slate-50 text-slate-600" : "border border-slate-200 text-slate-800"
              }`}
            >
              <p>{c.body}</p>
              <p className="mt-1 text-xs text-slate-400">
                {nameOf(c.author_id)} - {new Date(c.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>

        {canEdit && (
          <div className="mt-4">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={2}
              placeholder="Add a comment"
              className={inputCls}
            />
            <button
              onClick={addComment}
              disabled={!newComment.trim()}
              className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Add comment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}