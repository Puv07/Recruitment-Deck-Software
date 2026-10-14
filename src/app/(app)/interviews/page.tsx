import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InterviewsClient from "./InterviewsClient";
import type { Role } from "@/lib/nav";

export default async function InterviewsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [meRes, ivRes, candRes, peopleRes] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("interviews").select("*").order("scheduled_at", { ascending: true }).limit(1000),
    supabase.from("candidates").select("id, full_name, status").order("full_name").limit(1000),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  return (
    <InterviewsClient
      userId={user.id}
      role={(meRes.data?.role ?? "hr_executive") as Role}
      interviews={ivRes.data ?? []}
      candidates={candRes.data ?? []}
      people={peopleRes.data ?? []}
      loadError={ivRes.error?.message ?? ""}
    />
  );
}