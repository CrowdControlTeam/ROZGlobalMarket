"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { buttonClass } from "@/lib/ui";

// El tipo preseleccionado depende de la pantalla activa (norma del punto
// 2 del refactor): desde Comprar/Comerciar se preselecciona ese tipo,
// desde Regalos el Regalo, en cualquier otro sitio (incluida Mercado sin
// filtrar o Vender) el formulario arranca en Venta por defecto.
export function CreatePublicationButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("nav");

  let href = "/market/new";
  if (pathname === "/market/gifts") {
    href = "/market/new?type=GIFT";
  } else if (pathname === "/market") {
    const type = searchParams.get("type");
    if (type === "BUY" || type === "TRADE") {
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
