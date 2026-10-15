import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PostingsClient from "./PostingsClient";

const ALLOWED = ["super_admin", "hr_head", "recruitment_lead", "hr_executive"];

export default async function PostingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meRes = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = meRes.data?.role ?? "hr_executive";
  if (!ALLOWED.includes(role)) redirect("/");

  const [postRes, vacRes, catRes, candRes, peopleRes] = await Promise.all([
    supabase.from("job_postings").select("*").order("posted_on", { ascending: false }).limit(2000),
    supabase.from("vacancies").select("id, title, category_id").order("title"),
    supabase.from("job_categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("candidates").select("id, vacancy_id").limit(5000),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  return (
    <PostingsClient
      userId={user.id}
      postings={postRes.data ?? []}
      vacancies={vacRes.data ?? []}
      categories={catRes.data ?? []}
      candidates={candRes.data ?? []}
      people={peopleRes.data ?? []}
      loadError={postRes.error?.message ?? ""}
    />
  );
}