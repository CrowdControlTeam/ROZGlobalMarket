"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sidebar } from "./Sidebar";
import { marketViewTitle } from "@/lib/market-labels";

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("market");
  const tNav = useTranslations("nav");

  const links: { href: string; label: string; enabled: boolean }[] = [
    { href: "/market", label: t("title"), enabled: true },
    { href: "/market/sale", label: marketViewTitle(t, "SALE"), enabled: true },
    { href: "/market/buy", label: marketViewTitle(t, "BUY"), enabled: true },
    { href: "/market/trade", label: marketViewTitle(t, "TRADE"), enabled: true },
    { href: "/market/gifts", label: t("gifts.title"), enabled: true },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={tNav("openMenu")}
        className="flex flex-col gap-1 p-1"
      >
        <span className="block h-0.5 w-5 bg-ro-gold" />
        <span className="block h-0.5 w-5 bg-ro-gold" />
        <span className="block h-0.5 w-5 bg-ro-gold" />
      </button>

      <Sidebar side="left" open={open} onClose={() => setOpen(false)} title={t("title")}>
        <nav className="flex flex-col gap-1">
          {links.map((link) =>
            link.enabled ? (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 font-medium hover:bg-ro-gold/20"
              >
                {link.label}
              </Link>
            ) : (
              <span
                key={link.label}
                className="cursor-not-allowed rounded-md px-3 py-2 text-ro-text-muted"
              >
                {link.label} <span className="text-xs italic">{tNav("comingSoon")}</span>
              </span>
            ),
          )}
        </nav>
      </Sidebar>
    </>
  );
}
