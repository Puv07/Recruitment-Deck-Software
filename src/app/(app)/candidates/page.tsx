import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CandidatesClient from "./CandidatesClient";
import type { Role } from "@/lib/nav";

export default async function CandidatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [meRes, candRes, vacRes, centresRes, peopleRes] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("candidates").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("vacancies").select("id, title").order("title"),
    supabase.from("centres").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  return (
    <CandidatesClient
      userId={user.id}
      role={(meRes.data?.role ?? "hr_executive") as Role}
      candidates={candRes.data ?? []}
      vacancies={vacRes.data ?? []}
      centres={centresRes.data ?? []}
      people={peopleRes.data ?? []}
      loadError={candRes.error?.message ?? ""}
    />
  );
}