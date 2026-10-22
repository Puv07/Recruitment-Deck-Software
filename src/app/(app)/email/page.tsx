import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EmailClient from "./EmailClient";

const ALLOWED = ["super_admin", "hr_head", "recruitment_lead", "hr_executive", "hr_operations"];

export default async function EmailPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meRes = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(meRes.data?.role ?? "")) redirect("/");

  const [emailRes, peopleRes, centresRes, tasksRes] = await Promise.all([
    supabase.from("email_messages").select("*").order("imported_at", { ascending: false }).limit(300),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase.from("centres").select("id, name").order("name"),
    supabase
      .from("tasks")
      .select("id, title, status, due_date, assigned_to")
      .not("status", "in", "(Completed,Cancelled)")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  return (
    <EmailClient
      userId={user.id}
      emails={emailRes.data ?? []}
      people={peopleRes.data ?? []}
      centres={centresRes.data ?? []}
      tasks={tasksRes.data ?? []}
      loadError={emailRes.error?.message ?? ""}
    />
  );
}