import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import type { Role } from "@/lib/nav";

async function ShellLoader({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  return (
    <AppShell
      fullName={profile?.full_name ?? user.email ?? ""}
      email={user.email ?? ""}
      role={(profile?.role ?? "hr_executive") as Role}
    >
      {children}
    </AppShell>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
          Loading...
        </div>
      }
    >
      <ShellLoader>{children}</ShellLoader>
    </Suspense>
  );
}