import { ItemCategory } from "@prisma/client";
import { searchDbItems } from "@/lib/db-items";
import { ItemsBrowser } from "./ItemsBrowser";

function firstValue(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function isCategory(v: string | undefined): v is ItemCategory {
  return !!v && (Object.values(ItemCategory) as string[]).includes(v);
}

// Grid de items de la DB. La búsqueda/filtro/página viven en la URL (server-
// rendered); el detalle se abre en un modal (client) que pide el tooltip.
export default async function DbItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const q = firstValue(raw.q)?.trim() || undefined;
  const categoryParam = firstValue(raw.category);
  const category = isCategory(categoryParam) ? categoryParam : undefined;
  const page = Math.max(1, Number(firstValue(raw.page)) || 1);

  const result = await searchDbItems({ q, categories: category ? [category] : undefined, page });

  return <ItemsBrowser {...result} query={q ?? ""} category={category ?? ""} />;
}
