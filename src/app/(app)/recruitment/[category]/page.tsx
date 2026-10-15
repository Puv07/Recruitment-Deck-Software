import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RecruitmentClient from "../RecruitmentClient";
import type { Role } from "@/lib/nav";

const ALLOWED = ["super_admin", "hr_head", "recruitment_lead", "hr_executive"];

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meRes = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (meRes.data?.role ?? "hr_executive") as Role;
  if (!ALLOWED.includes(role)) redirect("/");

  const catRes = await supabase
    .from("job_categories")
    .select("id, name, slug")
    .order("sort_order")
    .order("name");
  const categories = catRes.data ?? [];

  let vacQuery = supabase.from("vacancies").select("*").order("created_at", { ascending: false });
  let heading = "All vacancies";
  let defaultCategoryId: string | null = null;
  let fixedCategory = false;

  if (category === "all") {
    // no filter
  } else if (category === "uncategorised") {
    vacQuery = vacQuery.is("category_id", null);
    heading = "Uncategorised vacancies";
  } else {
    const found = categories.find((c) => c.slug === category);
    if (!found) notFound();
    vacQuery = vacQuery.eq("category_id", found.id);
    heading = found.name;
    defaultCategoryId = found.id;
    fixedCategory = true;
  }

  const [vacRes, candRes, centresRes, deptRes, peopleRes] = await Promise.all([
    vacQuery,
    supabase.from("candidates").select("id, vacancy_id, status").limit(5000),
    supabase.from("centres").select("id, name").order("name"),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  return (
    <RecruitmentClient
      role={role}
      heading={heading}
      fixedCategory={fixedCategory}
      defaultCategoryId={defaultCategoryId}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      vacancies={vacRes.data ?? []}
      candidates={candRes.data ?? []}
      centres={centresRes.data ?? []}
      departments={deptRes.data ?? []}
      people={peopleRes.data ?? []}
      loadError={vacRes.error?.message ?? ""}
    />
  );
}