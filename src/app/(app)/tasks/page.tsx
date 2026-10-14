import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TasksClient from "./TasksClient";
import type { Role } from "@/lib/nav";

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [meRes, tasksRes, peopleRes, centresRes] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase.from("centres").select("id, name").order("name"),
  ]);

  return (
    <TasksClient
      userId={user.id}
      role={(meRes.data?.role ?? "hr_executive") as Role}
      tasks={tasksRes.data ?? []}
      people={peopleRes.data ?? []}
      centres={centresRes.data ?? []}
      loadError={tasksRes.error?.message ?? ""}
    />
  );
}