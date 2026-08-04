import {
  ItemCategory,
  EquipSlot,
  ItemOptionGroup,
  WeaponType,
  ListingType,
  DealStatus,
} from "@prisma/client";
import type { MarketSort } from "@/lib/market-sort";

// Traductor ya escopado al namespace "market" (useTranslations("market") en
// cliente, getTranslations("market") en servidor) — cada helper de aquí
// abajo solo conoce la clave relativa (p.ej. "catalog.category.WEAPON"),
// nunca el namespace completo. Ver messages/es.json para las claves reales.
type T = (key: string) => string;

export function categoryLabel(t: T, category: ItemCategory): string {
  return t(`catalog.category.${category}`);
}

export function slotLabel(t: T, slot: EquipSlot): string {
  return t(`catalog.slot.${slot}`);
}

export function weaponTypeLabel(t: T, weaponType: WeaponType): string {
  return t(`catalog.weaponType.${weaponType}`);
}

export function optionGroupLabel(t: T, group: ItemOptionGroup): string {
  return t(`catalog.optionGroup.${group}`);
}

export function listingTypeLabel(t: T, type: ListingType): string {
  return t(`listing.type.${type}`);
}

// Título de la vista filtrada por tipo — tanto la entrada del menú como el
// <h1> de /market cuando llega `?type=` usan este mismo texto (plural, a
// diferencia de listingTypeLabel que es singular para badges/desplegables),
// para que no puedan divergir entre los dos sitios sin querer.
export function marketViewTitle(t: T, type: ListingType): string {
  return t(`listing.viewTitle.${type}`);
}

// Quien publica se llama distinto según el tipo — en BUY esa persona
// compra, no vende (ver comentario de Listing.posterId en schema.prisma).
export function posterLabel(t: T, type: ListingType): string {
  return t(`listing.poster.${type}`);
}

// COMPLETED = "cerrado con éxito" en todos los tipos — el texto mostrado cambia
// según qué significa cerrarse en cada uno (ver soldStatus.{type} en i18n).
export function listingStatusLabel(t: T, status: string, type: ListingType): string {
  if (status === "COMPLETED") return t(`listing.soldStatus.${type}`);
  return t(`listing.status.${status}`);
}

export function offerStatusLabel(t: T, status: DealStatus): string {
  return t(`listing.offerStatus.${status}`);
}

export function sortLabel(t: T, sort: MarketSort): string {
  return t(`sort.${sort}`);
}

// Badge de tipo en las cards/detalle. Usa los tokens de color por tipo del
// rediseño (--ro-type-*, ver globals.css): Venta ámbar, Compra verde,
// Intercambio azul, Regalo rojo — los mismos colores que el
// SegmentedTypeSelector, para que badge y selector sean consistentes. Solo
// Se muestra siempre en las cards (también con un tipo filtrado), como
// referencia visual constante. Solo estilo, no texto — el label viene de
// listingTypeLabel.
export const LISTING_TYPE_BADGE_CLASS: Record<ListingType, string> = {
  SALE: "border-ro-type-sale/50 bg-ro-type-sale/10 text-ro-type-sale",
  TRADE: "border-ro-type-trade/50 bg-ro-type-trade/10 text-ro-type-trade",
  BUY: "border-ro-type-buy/50 bg-ro-type-buy/10 text-ro-type-buy",
  GIFT: "border-ro-type-gift/50 bg-ro-type-gift/10 text-ro-type-gift",
};

// SALE/TRADE/GIFT muestran el roll exacto de una instancia real ("+20");
// BUY muestra el mínimo que pide el comprador ("20+", sin usar el símbolo
// ≥ para no depender de que todo el mundo lo entienda) — ver comentario de
// ListingOption en schema.prisma sobre el doble sentido de `value` según
// el tipo. Solo el número: cada sitio decide cómo pegarlo al label (badge
// de mercado, campo del webhook, etc.). No es texto en idioma natural, así
// que no pasa por i18n aunque lo use también código que envía a Discord.
export function formatOptionAmount(value: number, isMinimum: boolean): string {
  return isMinimum ? `${value}+` : `+${value}`;
}
