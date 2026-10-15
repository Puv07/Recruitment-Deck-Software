"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, LogOut, Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NAV_ITEMS, ROLE_LABELS, type Role } from "@/lib/nav";
import NotificationBell from "./NotificationBell";

type Props = {
  fullName: string;
  email: string;
  role: Role;
  children: React.ReactNode;
};

export default function AppShell({ fullName, email, role, children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const current = items.find((i) => isActive(i.href));

  async function signOut() {
    await createClient().auth.signOut();
    window.location.href = "/login";
  }

  function renderSidebar(showLabels: boolean) {
    return (
      <>
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            S
          </div>
          {showLabels && (
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">SPARRC</p>
              <p className="text-xs text-slate-500">HR Command Centre</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {showLabels && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {!item.ready && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                        Soon
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3">
          {showLabels && (
            <div className="mb-2 px-1">
              <p className="truncate text-sm font-medium text-slate-900">{fullName}</p>
              <p className="truncate text-xs text-slate-500">{ROLE_LABELS[role]}</p>
            </div>
          )}
          <button
            onClick={signOut}
            title="Sign out"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {showLabels && "Sign out"}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      {/* Desktop sidebar */}
      <aside
        className={`hidden flex-col border-r border-slate-200 bg-white transition-all md:flex ${
          collapsed ? "w-[68px]" : "w-64"
        }`}
      >
        {renderSidebar(!collapsed)}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 flex h-full w-64 flex-col bg-white">
            {renderSidebar(true)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:block"
            aria-label="Collapse sidebar"
          >
            {collapsed ? (
              <ChevronsRight className="h-5 w-5" />
            ) : (
              <ChevronsLeft className="h-5 w-5" />
            )}
          </button>
          <h2 className="flex-1 truncate text-base font-semibold text-slate-900">
            {current?.label ?? "SPARRC HR"}
          </h2>
          <NotificationBell />
          <span className="hidden rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 sm:inline">
            {ROLE_LABELS[role]}
          </span>
          <span className="hidden text-xs text-slate-500 lg:inline">{email}</span>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}