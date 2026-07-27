"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Settings, LogOut, Package } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { buttonClass } from "@/lib/ui";
import { signOutAction } from "@/lib/auth-actions";

type FullUser = {
  discordId: string;
  username: string;
  avatarUrl: string | null;
  guildRoles: string[];
  createdAt: Date;
  isAdmin: boolean;
};

export function UserMenu({ user }: { user: FullUser }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav.account");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-ro-text-light hover:bg-white/5"
      >
        {user.avatarUrl && (
          <Image
            src={user.avatarUrl}
            alt={user.username}
            width={28}
            height={28}
            className="rounded-full border border-ro-panel-border"
          />
        )}
        <span className="hidden text-sm sm:inline">{user.username}</span>
      </button>

      <Sidebar side="right" open={open} onClose={() => setOpen(false)} title={t("title")}>
        <div className="flex flex-col items-center gap-3 text-center">
          {user.avatarUrl && (
            <Image
              src={user.avatarUrl}
              alt={user.username}
              width={72}
              height={72}
              className="rounded-full border-2 border-ro-panel-border"
            />
          )}
          <p className="font-heading text-xs">{user.username}</p>
        </div>

        <dl className="mt-6 flex flex-col gap-3 text-sm">
          <div className="flex justify-between border-b border-ro-panel-border/30 pb-2">
            <dt className="text-ro-text-muted">{t("discordId")}</dt>
            <dd className="font-mono text-xs">{user.discordId}</dd>
          </div>
          <div className="flex justify-between border-b border-ro-panel-border/30 pb-2">
            <dt className="text-ro-text-muted">{t("memberSince")}</dt>
            <dd>{user.createdAt.toLocaleDateString()}</dd>
          </div>
          <div className="pb-2">
            <dt className="mb-1 text-ro-text-muted">{t("roles")}</dt>
            <dd>
              {user.guildRoles.length > 0 ? (
                <ul className="flex flex-wrap gap-1">
                  {user.guildRoles.map((r) => (
                    <li
                      key={r}
                      className="rounded bg-ro-panel-border/10 px-2 py-0.5 font-mono text-xs"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-ro-text-muted">{t("noRoles")}</span>
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/my/listings"
            onClick={() => setOpen(false)}
            className={`w-full ${buttonClass("outline")}`}
          >
            <Package size={16} />
            {t("myActivity")}
          </Link>

          {user.isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className={`w-full ${buttonClass("discord")}`}
            >
              <Settings size={16} />
              {t("settings")}
            </Link>
          )}

          <form action={signOutAction}>
            <button type="submit" className={`w-full ${buttonClass("danger")}`}>
              <LogOut size={16} />
              {t("signOut")}
            </button>
          </form>
        </div>
      </Sidebar>
    </>
  );
}
