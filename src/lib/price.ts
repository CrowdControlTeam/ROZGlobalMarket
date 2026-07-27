// Formato de precio, en un solo sitio para poder cambiarlo fácilmente.
// "es-ES": separador de miles con "." — el juego no maneja decimales, así
// que no hace falta separador de decimales (maximumFractionDigits: 0).
const PRICE_LOCALE = "es-ES";

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(PRICE_LOCALE, { maximumFractionDigits: 0 }).format(value);
}

export function formatPrice(price: number): string {
  return `${formatNumber(price)} z`;
}

// Aviso visual por rango de precio: normal hasta 1M, y a partir de ahí un
// color por cada orden de magnitud (x10). Con "!" (important de Tailwind v4)
// porque se usa dentro de inputs cuya clase base ya fija un color de texto
// (text-ro-text), que si no gana por orden de aparición en la hoja generada.
const PRICE_COLOR_TIERS = [
  { threshold: 1_000_000_000, className: "text-purple-700!" },
  { threshold: 100_000_000, className: "text-red-700!" },
  { threshold: 10_000_000, className: "text-blue-700!" },
  { threshold: 1_000_000, className: "text-green-700!" },
] as const;

export function priceColorClass(price: number): string {
  for (const tier of PRICE_COLOR_TIERS) {
    if (price >= tier.threshold) return tier.className;
  }
  return "text-ro-gold-dark!";
}
