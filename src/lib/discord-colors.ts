// Color del borde lateral de los embeds de Discord, según el tipo de
// transacción del mercado. Esquema acordado con el usuario (icono
// Buy/Sell/Trade/Gift del juego): verde = petición de compra, amarillo =
// venta, azul = trade, rojo = regalo. Mismos nombres que ListingType donde
// aplica (SALE/TRADE/BUY) — GIFT es aparte, no forma parte de ese enum.
//
// GIFT queda de referencia — los regalos no se anuncian por webhook público
// (ver spec 2.6/2.7), solo quedan en el historial.
//
// MESSAGE es aparte de las cuatro anteriores: no es una transacción, es una
// consulta libre desde un nombre clicable (ver src/lib/contact-messages.ts)
// — blurple de Discord, para no reutilizar ninguno de los cuatro colores ya
// asociados a un tipo concreto.
export const DISCORD_EMBED_COLOR = {
  SALE: 0xf2b90c,
  BUY: 0x57c84d,
  TRADE: 0x3b82f6,
  GIFT: 0xe0245e,
  MESSAGE: 0x5865f2,
} as const;
