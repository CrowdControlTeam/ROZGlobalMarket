"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { buttonClass } from "@/lib/ui";

// El tipo preseleccionado depende del filtro de tipo activo en el mercado
// unificado: con ?type=BUY/TRADE/GIFT se preselecciona ese tipo; en cualquier
// otro caso (mercado sin tipo, o ?type=SALE) el formulario arranca en Venta.
export function CreatePublicationButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("nav");

  let href = "/market/new";
  if (pathname === "/market") {
    const type = searchParams.get("type");
    if (type === "BUY" || type === "TRADE" || type === "GIFT") {
      href = `/market/new?type=${type}`;
    }
  }

  return (
    <Link href={href} className={buttonClass("primary")}>
      <Plus size={18} />
      <span className="hidden sm:inline">{t("newPublication")}</span>
    </Link>
  );
}
