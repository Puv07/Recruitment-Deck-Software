import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RecruitmentHome from "./RecruitmentHome";

const ALLOWED = ["super_admin", "hr_head", "recruitment_lead", "hr_executive"];

export default async function RecruitmentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meRes = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = meRes.data?.role ?? "hr_executive";
  if (!ALLOWED.includes(role)) redirect("/");

  const [catRes, vacRes, candRes] = await Promise.all([
    supabase
      .from("job_categories")
      .select("id, name, slug, sort_order")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase.from("vacancies").select("id, category_id, positions, approval_status"),
    supabase.from("candidates").select("id, vacancy_id, status").limit(5000),
  ]);

  return (
    <RecruitmentHome
      canManage={["super_admin", "hr_head"].includes(role)}
      categories={catRes.data ?? []}
      vacancies={vacRes.data ?? []}
      candidates={candRes.data ?? []}
      loadError={catRes.error?.message ?? vacRes.error?.message ?? ""}
    />
  );
}