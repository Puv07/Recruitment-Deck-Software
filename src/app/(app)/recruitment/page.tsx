import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RecruitmentClient from "./RecruitmentClient";
import type { Role } from "@/lib/nav";

export default async function RecruitmentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [meRes, vacRes, candRes, centresRes, deptRes, peopleRes] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("vacancies").select("*").order("created_at", { ascending: false }),
    supabase.from("candidates").select("id, vacancy_id, status").limit(2000),
    supabase.from("centres").select("id, name").order("name"),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  return (
    <RecruitmentClient
      role={(meRes.data?.role ?? "hr_executive") as Role}
      vacancies={vacRes.data ?? []}
      candidates={candRes.data ?? []}
      centres={centresRes.data ?? []}
      departments={deptRes.data ?? []}
      people={peopleRes.data ?? []}
      loadError={vacRes.error?.message ?? ""}
    />
  );
}