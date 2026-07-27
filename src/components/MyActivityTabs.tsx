"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const TABS = [
  { href: "/my/listings", key: "listings" },
  { href: "/my/gifts", key: "gifts" },
] as const;

export function MyActivityTabs() {
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
            className={`-mb-0.5 border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              active
                ? "border-ro-gold text-ro-gold"
                : "border-transparent text-ro-text-light/70 hover:text-ro-gold"
            }`}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </div>
  );
}
