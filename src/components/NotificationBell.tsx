"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Notice = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationBell() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, title, body, link, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems(data ?? []);
  }, [supabase]);

  const refreshReminders = useCallback(async () => {
    await supabase.rpc("generate_my_reminders");
    await supabase.rpc("generate_my_reminders");
    await supabase.rpc("generate_posting_reminders");
        await supabase.rpc("generate_joining_reminders");
    await load();
    await load();
  }, [supabase, load]);

  useEffect(() => {
    refreshReminders();
    const quick = setInterval(load, 60000);
    const slow = setInterval(refreshReminders, 15 * 60000);
    return () => {
      clearInterval(quick);
      clearInterval(slow);
    };
  }, [load, refreshReminders]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const unread = items.filter((n) => !n.is_read).length;

  async function markRead(id: string) {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }

  async function markAllRead() {
    setItems((list) => list.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
  }

  function openItem(n: Notice) {
    markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 max-w-[90vw] rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-indigo-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {items.length === 0 && <li className="p-4 text-sm text-slate-500">You are all caught up.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => openItem(n)}
                  className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${n.is_read ? "" : "bg-indigo-50/50"}`}
                >
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-600" />}
                    {n.title}
                  </p>
                  {n.body && <p className="mt-0.5 text-xs text-slate-600">{n.body}</p>}
                  <p className="mt-1 text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}