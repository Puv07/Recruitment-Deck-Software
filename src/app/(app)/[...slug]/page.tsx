"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";

export default function ComingSoonPage() {
  const pathname = usePathname();
  const item = NAV_ITEMS.find((i) => i.href !== "/" && pathname.startsWith(i.href));

  return (
    <div className="mx-auto max-w-xl p-8 text-center">
      <h1 className="text-xl font-semibold text-slate-900">
        {item?.label ?? "This module"}
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        This module is coming soon. We&apos;ll build it in a later step.
      </p>
    </div>
  );
}