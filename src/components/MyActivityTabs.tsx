"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const TABS = [
  { href: "/market/activity/listings", key: "listings" },
  { href: "/market/activity/pending", key: "pending" },
  { href: "/market/activity/gifts", key: "gifts" },
] as const;

export function MyActivityTabs({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname();
  const t = useTranslations("myActivity.tabs");

  return (
    <div className="mb-6 flex gap-1 border-b-2 border-ro-panel-border">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-0.5 flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              active
                ? "border-ro-accent text-ro-text"
                : "border-transparent text-ro-text-muted hover:text-ro-text"
            }`}
          >
            {t(tab.key)}
            {/* Nº de ofertas entrantes por confirmar, junto a "Pendientes". */}
            {tab.key === "pending" && pendingCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ro-red px-1 text-[10px] font-bold leading-none text-white">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
