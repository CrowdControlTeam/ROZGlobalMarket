"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { ItemOptionGroup, type EquipSlot, type Item } from "@prisma/client";
import { itemFitsSlot } from "@/lib/bis-constants";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { sendListingCreatedWebhook } from "@/lib/discord-webhook";
import { sendDirectMessage } from "@/lib/discord-bot";
import { getAppUrl } from "@/lib/app-url";
import { DISCORD_EMBED_COLOR } from "@/lib/discord-colors";
import { formatPrice } from "@/lib/price";
import {
  getItemOptionGroup,
  loadMagicalWeaponTypes,
  isOptionsFeatureAvailable,
  parseOptionsFromFormData,
  validateOptions,
} from "@/lib/item-options";
import { isRefineEligible, loadMaxRefineLevel } from "@/lib/refine";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { formatOptionAmount } from "@/lib/market-labels";
import { MAX_LISTING_NOTES_LENGTH, parseListingNotes } from "@/lib/listing-notes-constants";
import { loadMarketConfig } from "@/lib/market-config";
import { searchCatalog } from "@/lib/item-catalog";
import { listingStatusOnClose, availableFrom, isSoldOut } from "@/lib/deals";
import { listingCardState } from "@/lib/listing-card";

export async function searchItems(query: string, slot?: EquipSlot) {
  await requireSession();
  // Búsqueda en memoria (catálogo empaquetado, ver src/lib/item-catalog.ts) en
  // vez de pegar a la BD en cada tecla. `slot` (lo usa el picker de BiS) acota a
  // los items que encajan en ese slot de equipo, para no dejar elegir uno que
  // luego el servidor rechazaría.
  const items = searchCatalog(query, 20, slot ? (item) => itemFitsSlot(item, slot) : undefined);
  if (items.length === 0) return [];

  const [magicalTypes, optionsAvailable] = await Promise.all([
    loadMagicalWeaponTypes(),
    isOptionsFeatureAvailable(),
  ]);
  return items.map((item) => ({
    ...item,
    optionGroup: optionsAvailable ? getItemOptionGroup(item, magicalTypes) : null,
  }));
}

// Para que el filtro de mercado (client component, sin acceso directo a
// Prisma) pueda saber si debe mostrar la sección de options en absoluto —
// mismo patrón que getMagicalWeaponTypes/getMaxRefineLevel.
export async function getOptionsFeatureAvailable() {
  await requireSession();
  return isOptionsFeatureAvailable();
}

// Para que el filtro de mercado pueda resolver el ItemOptionGroup en
// cliente (necesita saber qué tipos de arma cuentan como mágicos) sin
// duplicar la tabla ahí.
export async function getMagicalWeaponTypes() {
  await requireSession();
  const magicalTypes = await loadMagicalWeaponTypes();
  return Array.from(magicalTypes);
}

export async function getMaxRefineLevel() {
  await requireSession();
  return loadMaxRefineLevel();
}

// Todas mis publicaciones (los 3 tipos, cualquier estado) para la pantalla
// "Mi actividad" — a diferencia de getListings (mercado general), no
// filtra por status: "ACTIVE" ni por búsqueda/orden, es mi historial
// completo. Sin paginación: el volumen de publicaciones de una sola
// persona es bajo, mismo criterio que getMyGifts.
export async function getMyListings() {
  const session = await requireSession();

  const listings = await prisma.listing.findMany({
    where: { posterId: session.user.discordId },
    orderBy: { createdAt: "desc" },
    include: {
      // select en item (no fila completa): la card solo usa nombre/icono/slots.
      item: { select: { id: true, name: true, iconUrl: true, slotCount: true } },
      options: { include: { def: true }, orderBy: { slotIndex: "asc" } },
      // Deals vivos (PENDING/ACCEPTED): >0 ⇒ no editable, gate del kebab "Editar"
      // (misma regla que la card del mercado y updateListing).
      _count: { select: { deals: { where: { status: { in: ["PENDING", "ACCEPTED"] } } } } },
    },
  });

  // Vendido por listing derivado de los Deal ACCEPTED (ya no hay quantitySold).
  const soldByListing = await prisma.deal.groupBy({
    by: ["listingId"],
    where: { listingId: { in: listings.map((l) => l.id) }, status: "ACCEPTED" },
    _sum: { quantity: true },
  });
  const soldMap = new Map(soldByListing.map((g) => [g.listingId, g._sum.quantity ?? 0]));
  return listings.map((l) => ({
    ...l,
    sold: soldMap.get(l.id) ?? 0,
    hasLiveDeals: l._count.deals > 0,
  }));
}

// Para la página de gestión (/market/activity/pending): todo lo que tengo
// pendiente de resolver, sin entrar listing por listing.
//   - entrantes: Deal PENDING sobre MIS listings (reservas/ofertas/reclamaciones
//     por confirmar) — los acepto/rechazo.
//   - salientes: MIS Deal PENDING (donde soy la contraparte) — puedo cancelarlos.
export async function getMyPendingDeals() {
  const session = await requireSession();
  const me = session.user.discordId;

  const [incoming, outgoing] = await Promise.all([
    prisma.deal.findMany({
      where: { status: "PENDING", listing: { posterId: me } },
      orderBy: { createdAt: "asc" },
      include: {
        listing: { include: { item: { select: { id: true, name: true, iconUrl: true, slotCount: true } } } },
        user: true,
        offeredItem: { select: { id: true, name: true, iconUrl: true, slotCount: true } },
      },
    }),
    prisma.deal.findMany({
      where: { status: "PENDING", userId: me },
      orderBy: { createdAt: "desc" },
      include: {
        listing: { include: { item: { select: { id: true, name: true, iconUrl: true, slotCount: true } }, poster: true } },
        offeredItem: { select: { id: true, name: true, iconUrl: true, slotCount: true } },
      },
    }),
  ]);

  return { incoming, outgoing };
}

// Devuelve el catálogo de options posibles de un grupo, ya ordenado por
// slot posicional — el formulario de publicar lo usa así, atado al grupo
// real del item elegido (ahí sí importa: el roll es de una instancia
// concreta de ese grupo).
export async function getOptionChoices(group: ItemOptionGroup) {
  await requireSession();
  return prisma.itemOptionDef.findMany({
    where: { group },
    orderBy: [{ slotIndex: "asc" }, { label: "asc" }],
  });
}

// El filtro de mercado, a diferencia del formulario, no fija categoría/
// slot/tipo de arma de antemano — busca por stat en una posición
// concreta (p.ej. "Option 2 = MaxHP") sin importar de qué grupo salga, así
// que trae el catálogo entero (194 filas, nada pesado) y el cliente
// dedupea por (slotIndex, statCode) para poblar cada uno de los 3
// desplegables. Ver optionSlotWhere en market.ts, que filtra por
// statCode en vez de por defId por el mismo motivo.
export async function getAllOptionChoices() {
  await requireSession();
  return prisma.itemOptionDef.findMany({
    orderBy: [{ slotIndex: "asc" }, { label: "asc" }],
  });
}

// Parseo + validación de los campos COMUNES de un listing (precio, cantidad,
// refino, slots, opciones y notas), compartido por createListing y
// updateListing. `type` e `item` ya vienen resueltos/validados por el caller;
// `t` es el traductor de "errors". Lanza con el mensaje i18n al primer fallo.
async function parseListingFields(
  formData: FormData,
  type: "SALE" | "BUY" | "TRADE" | "GIFT",
  item: Item,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  // Precio: solo SALE/BUY. null = "sin precio" (competitivo, señal `noPrice`) o
  // no aplica (TRADE/GIFT). Ver el doble sentido de `price` en schema.prisma.
  let price: number | null = null;
  if (type === "SALE" || type === "BUY") {
    const noPrice = formData.get("noPrice") === "on";
    if (!noPrice) {
      const pricedParsed = z.coerce
        .number()
        .int()
        .positive(t("positivePrice"))
        .safeParse(formData.get("price"));
      if (!pricedParsed.success) {
        throw new Error(pricedParsed.error.issues[0]?.message ?? t("invalidPrice"));
      }
      price = pricedParsed.data;
    }
  }

  const [magicalTypes, optionsAvailable] = await Promise.all([
    loadMagicalWeaponTypes(),
    isOptionsFeatureAvailable(),
  ]);
  const optionGroup = optionsAvailable ? getItemOptionGroup(item, magicalTypes) : null;

  // BUY = "mínimos deseados" (se permiten huecos: pedir solo un slot); el resto
  // describe una instancia real → sin huecos. defsById se reutiliza (webhook/DM).
  const rawOptions = await parseOptionsFromFormData(formData, type === "BUY");
  const defsById = await validateOptions(rawOptions, optionGroup);

  // Ilimitado ("los que tengas" → null): solo BUY, o SALE de un item SIN options
  // (infinitas copias de un ejemplar con options aleatorias no tiene sentido).
  let quantity: number | null;
  if (
    (type === "BUY" || (type === "SALE" && optionGroup === null)) &&
    formData.get("unlimited") === "on"
  ) {
    quantity = null;
  } else {
    const qParsed = z.coerce
      .number()
      .int()
      .positive(t("positiveQuantity"))
      .safeParse(formData.get("quantity"));
    if (!qParsed.success) {
      throw new Error(qParsed.error.issues[0]?.message ?? t("positiveQuantity"));
    }
    quantity = qParsed.data;
  }

  let refineLevel = 0;
  if (isRefineEligible(item)) {
    const rawRefine = formData.get("refineLevel");
    refineLevel = typeof rawRefine === "string" && rawRefine !== "" ? Number(rawRefine) : 0;
    if (!Number.isInteger(refineLevel) || refineLevel < 0) {
      throw new Error(t("positiveRefine"));
    }
    const maxRefineLevel = await loadMaxRefineLevel();
    if (refineLevel > maxRefineLevel) {
      throw new Error(t("refineTooHigh", { max: maxRefineLevel }));
    }
  }

  // Las ranuras de carta ya no las indica quien publica: son fijas por item
  // (Item.slotCount, extraído del cliente).

  const notes = parseListingNotes(formData.get("notes"));
  if (notes && notes.length > MAX_LISTING_NOTES_LENGTH) {
    throw new Error(t("notesTooLong", { max: MAX_LISTING_NOTES_LENGTH }));
  }

  return { price, quantity, refineLevel, notes, rawOptions, defsById };
}

export async function createListing(formData: FormData) {
  const session = await requireSession();
  const t = await getTranslations("errors");

  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (maintenanceModeEnabled && !session.user.isAdmin) {
    throw new Error(t("maintenanceMode"));
  }

  // Los mensajes de zod se resuelven aquí dentro (no como const a nivel de
  // módulo) porque necesitan el traductor, que solo existe dentro de la
  // request — reconstruir el schema en cada llamada no tiene coste real.
  const createListingSchema = z.object({
    itemId: z.string().min(1, t("selectItem")),
    // Acción única para TODOS los tipos, incluido GIFT (antes en sendGift). El
    // único caso con lógica propia es el regalo CON destinatario (entrega
    // directa, más abajo); el reclamable es una publicación normal más.
    type: z.enum(["SALE", "BUY", "TRADE", "GIFT"]).default("SALE"),
  });

  const parsed = createListingSchema.safeParse({
    itemId: formData.get("itemId"),
    type: formData.get("type") || "SALE",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? t("invalidData"));
  }

  const item = await prisma.item.findUnique({
    where: { id: parsed.data.itemId },
  });
  if (!item) throw new Error(t("itemNotFound"));

  // Regalo CON destinatario = entrega directa (ver más abajo). Sin destinatario,
  // el GIFT es RECLAMABLE: una publicación normal más. Solo se lee/valida el
  // destinatario en GIFT; en el resto de tipos se ignora aunque venga en el form.
  const recipientId =
    parsed.data.type === "GIFT"
      ? ((formData.get("recipientId") as string) || "").trim() || undefined
      : undefined;
  if (recipientId) {
    if (recipientId === session.user.discordId) throw new Error(t("cannotGiftSelf"));
    const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipient) throw new Error(t("recipientNotFound"));
  }
  const isDirectGift = parsed.data.type === "GIFT" && !!recipientId;

  const { price, quantity, refineLevel, notes, rawOptions, defsById } =
    await parseListingFields(formData, parsed.data.type, item, t);

  const listing = await prisma.$transaction(async (tx) => {
    const created = await tx.listing.create({
      data: {
        posterId: session.user.discordId,
        itemId: parsed.data.itemId,
        type: parsed.data.type,
        quantity,
        price,
        // Regalo directo: nace ya cerrado (la entrega es instantánea).
        status: isDirectGift ? "COMPLETED" : "ACTIVE",
        refineLevel,
        notes,
        options:
          rawOptions.length > 0
            ? {
                create: rawOptions.map((o) => ({
                  slotIndex: o.slotIndex,
                  defId: o.defId,
                  value: o.value,
                })),
              }
            : undefined,
      },
    });
    // Regalo directo: además del listing, un Deal ACCEPTED para el destinatario
    // (la transferencia ya hecha). Sin destinatario no hay Deal (reclamable).
    if (isDirectGift) {
      await tx.deal.create({
        data: {
          listingId: created.id,
          userId: recipientId!,
          quantity: quantity ?? 1,
          status: "ACCEPTED",
          unitPrice: null,
        },
      });
    }
    return created;
  });

  const appUrl = getAppUrl();

  // Regalo directo: DM al destinatario (la entrega ya está hecha) y punto —no se
  // anuncia por webhook—; se vuelve a /market/activity/gifts (ahí aparece, tiene Deal).
  if (isDirectGift) {
    const tDiscord = await getTranslations("discord");
    const tField = await getTranslations("market.field");
    const itemName = formatItemDisplayName(item.name, refineLevel, item.slotCount);
    await sendDirectMessage(recipientId!, {
      title: tDiscord("dm.gifted", { username: session.user.username, item: itemName }),
      url: `${appUrl}/market/activity/gifts`,
      color: DISCORD_EMBED_COLOR.GIFT,
      itemIconUrl: `${appUrl}${item.iconUrl}`,
      fields: [
        { name: tField("quantity"), value: String(quantity), inline: true },
        ...(rawOptions.length > 0
          ? [
              {
                name: tField("options"),
                value: rawOptions
                  .map((o) => `${defsById.get(o.defId)!.label}: ${formatOptionAmount(o.value, false)}`)
                  .join("\n"),
                inline: false,
              },
            ]
          : []),
        { name: tDiscord("fields.from"), value: `<@${session.user.discordId}>`, inline: false },
      ],
    });
    revalidatePath("/market/activity/gifts");
    revalidatePath("/market");
    return { id: listing.id, directGift: true };
  }

  // Anuncio en el webhook de "publicación creada" para TODOS los tipos, incluido
  // el regalo RECLAMABLE (público, cualquiera lo reclama). El regalo DIRECTO ya
  // retornó arriba con su DM al destinatario, así que aquí nunca es directo.
  await sendListingCreatedWebhook({
    itemName: formatItemDisplayName(item.name, refineLevel, item.slotCount),
    itemIconUrl: `${appUrl}${item.iconUrl}`,
    type: parsed.data.type,
    price: listing.price,
    quantity: listing.quantity,
    posterUsername: session.user.username,
    posterAvatarUrl: session.user.avatarUrl,
    posterId: session.user.discordId,
    listingUrl: `${appUrl}/market/${listing.id}`,
    options: rawOptions.map((o) => ({
      label: defsById.get(o.defId)!.label,
      value: o.value,
    })),
  });

  revalidatePath("/market");
  return { id: listing.id, directGift: false };
}

// Editar una publicación propia. Reutiliza el mismo parseo de campos que
// createListing (parseListingFields). El TIPO y el ITEM no se editan: se toman
// del listing existente, no se confía en lo que mande el form. Solo se permite
// si el listing es del usuario, está ACTIVE y NO tiene deals vivos.
export async function updateListing(listingId: string, formData: FormData) {
  const session = await requireSession();
  const t = await getTranslations("errors");

  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (maintenanceModeEnabled && !session.user.isAdmin) {
    throw new Error(t("maintenanceMode"));
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
  });
  if (!listing) throw new Error(t("listingNotFound"));
  if (listing.posterId !== session.user.discordId) throw new Error(t("notYourListing"));
  if (listing.status !== "ACTIVE") throw new Error(t("listingNotActive"));

  // El TIPO se mantiene fijo (bloqueado en edición). El ITEM sí puede cambiar
  // (editar = como crear, con escáner): se lee del form y se valida. El parseo
  // usa el tipo original y el item nuevo (options/refine se validan contra él).
  const itemId = ((formData.get("itemId") as string) || "").trim();
  if (!itemId) throw new Error(t("selectItem"));
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) throw new Error(t("itemNotFound"));

  const { price, quantity, refineLevel, notes, rawOptions } =
    await parseListingFields(formData, listing.type, item, t);

  // Editable solo SIN deals vivos (PENDING o ACCEPTED); CANCELLED/REJECTED no
  // cuentan. Se comprueba DENTRO de la transacción para cerrar la ventana con
  // una oferta que entre justo ahora. Esto excluye de suyo el regalo directo
  // (nace con Deal ACCEPTED). Opciones: se borran y se recrean (más simple y
  // seguro que un diff, y el volumen es mínimo: hasta MAX_OPTION_SLOTS filas).
  await prisma.$transaction(async (tx) => {
    const liveDeals = await tx.deal.count({
      where: { listingId, status: { in: ["PENDING", "ACCEPTED"] } },
    });
    if (liveDeals > 0) throw new Error(t("listingHasDeals"));

    await tx.listingOption.deleteMany({ where: { listingId } });
    await tx.listing.update({
      where: { id: listingId },
      data: {
        itemId: item.id,
        quantity,
        price,
        refineLevel,
        notes,
        options:
          rawOptions.length > 0
            ? {
                create: rawOptions.map((o) => ({
                  slotIndex: o.slotIndex,
                  defId: o.defId,
                  value: o.value,
                })),
              }
            : undefined,
      },
    });
  });

  revalidatePath("/market");
  revalidatePath(`/market/${listingId}`);
  return { id: listingId };
}

// Quien publica cierra la publicación. Regla de cierre (ver deals.ts): si hubo
// algún trato cerrado (Deal ACCEPTED) se da por COMPLETED —se comerció algo—; si
// no, CANCELLED. NO se puede cerrar mientras haya ofertas/reservas PENDING: el
// poster debe aceptarlas o rechazarlas antes (así ninguna se rechaza en
// silencio). Las ACCEPTED sí dejan cerrar; si no, un listing ilimitado ya
// comerciado nunca podría cerrarse.
export async function cancelListing(listingId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { deals: { select: { status: true } } },
  });
  if (!listing) throw new Error(t("listingNotFound"));
  if (listing.posterId !== session.user.discordId) {
    throw new Error(t("onlyPosterCancel"));
  }
  if (listing.status !== "ACTIVE") {
    throw new Error(t("listingNotActive"));
  }

  // Cierre a mano. Con tope: si el listing sigue ACTIVE es que NO se alcanzó la
  // cantidad (al alcanzarla pasa a COMPLETED solo), así que cerrarlo = CANCELLED.
  // Ilimitado: nunca se cierra solo, así que COMPLETED si se comerció algo
  // (≥1 Deal ACCEPTED) y CANCELLED si no (ver deals.ts). Las ventas parciales
  // siguen contando en estadísticas porque se derivan de los Deal.
  const status =
    listing.quantity === null ? listingStatusOnClose(listing.deals) : "CANCELLED";
  await prisma.$transaction(async (tx) => {
    // Bloqueo con ofertas/reservas PENDING sin resolver. Dentro de la tx para
    // cerrar la ventana con una oferta que entre justo ahora, igual que
    // updateListing.
    const pending = await tx.deal.count({ where: { listingId, status: "PENDING" } });
    if (pending > 0) throw new Error(t("listingHasPendingOffers"));
    await tx.listing.update({ where: { id: listingId }, data: { status } });
  });

  revalidatePath("/market");
  revalidatePath(`/market/${listingId}`);
  return listingCardState(listingId);
}

export async function reserveListing(listingId: string, formData: FormData) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");
  const tField = await getTranslations("market.field");

  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (maintenanceModeEnabled && !session.user.isAdmin) {
    throw new Error(t("maintenanceMode"));
  }

  const reserveSchema = z.object({
    quantity: z.coerce.number().int().positive(t("positiveQuantity")),
  });

  const parsed = reserveSchema.safeParse({
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? t("invalidData"));
  }
  const { quantity } = parsed.data;

  const { listing, unitPrice } = await prisma.$transaction(async (tx) => {
    // Bloqueo de la fila: serializa reservas concurrentes para no reservar más
    // stock del disponible. Ver el núcleo del rediseño en deals.ts.
    await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${listingId} FOR UPDATE`;

    const listing = await tx.listing.findUnique({ where: { id: listingId }, include: { item: true } });
    if (!listing) throw new Error(t("listingNotFound"));
    if (listing.posterId === session.user.discordId) {
      throw new Error(t("cannotBuyOwn"));
    }
    if (listing.status !== "ACTIVE") {
      throw new Error(t("listingNotActive"));
    }
    if (listing.type !== "SALE") {
      throw new Error(t("notDirectSale"));
    }

    // Dos mecánicas según el listing:
    //  - precio fijo (price no null): unitPrice = el del listing; la reserva
    //    PENDING RETIENE stock (disponible resta lo reservado).
    //  - "sin precio" (price null, competitivo): el comprador puja su unitPrice
    //    y las pujas PENDING NO retienen stock —varias personas compiten por las
    //    mismas unidades y el vendedor elige— (ver deals.ts). El tope anti-
    //    sobreventa se aplica al ACEPTAR (acceptSaleReservation).
    const competitive = listing.price === null;
    let unitPrice: number;
    if (listing.price === null) {
      const bidParsed = z.coerce
        .number()
        .int()
        .positive(t("positivePrice"))
        .safeParse(formData.get("price"));
      if (!bidParsed.success) {
        throw new Error(bidParsed.error.issues[0]?.message ?? t("invalidPrice"));
      }
      unitPrice = bidParsed.data;
    } else {
      unitPrice = listing.price;
    }

    const agg = await tx.deal.groupBy({
      by: ["status"],
      where: { listingId, status: { in: ["ACCEPTED", "PENDING"] } },
      _sum: { quantity: true },
    });
    const sold = agg.find((a) => a.status === "ACCEPTED")?._sum.quantity ?? 0;
    const reserved = agg.find((a) => a.status === "PENDING")?._sum.quantity ?? 0;
    // available null = ilimitado ("los que tengas"): no hay tope que comprobar.
    // En competitivo no se resta lo reservado (las pujas no bloquean stock).
    const available = availableFrom(listing.quantity, sold, competitive ? 0 : reserved);
    if (available !== null && quantity > available) {
      throw new Error(t("notEnoughStock", { remaining: available }));
    }

    // Deal PENDING: en precio fijo es una reserva que retiene stock hasta que el
    // vendedor confirma/rechaza; en competitivo es una puja a `unitPrice`.
    await tx.deal.create({
      data: {
        listingId,
        userId: session.user.discordId,
        quantity,
        status: "PENDING",
        unitPrice,
      },
    });

    return { listing, unitPrice };
  });

  // Aviso al vendedor de que hay una reserva por confirmar (best-effort; el
  // canal real es la ficha y la futura página de gestión). Fuera de la
  // transacción: una llamada de red no debe alargar el bloqueo de DB.
  const appUrl = getAppUrl();
  await sendDirectMessage(listing.posterId, {
    title: tDiscord("dm.reserveRequested", {
      username: session.user.username,
      item: formatItemDisplayName(listing.item.name, listing.refineLevel, listing.item.slotCount),
    }),
    url: `${appUrl}/market/${listingId}`,
    color: DISCORD_EMBED_COLOR.SALE,
    itemIconUrl: `${appUrl}${listing.item.iconUrl}`,
    fields: [
      { name: tField("quantity"), value: String(quantity), inline: true },
      { name: tDiscord("fields.totalPrice"), value: formatPrice(quantity * unitPrice), inline: true },
      { name: tDiscord("fields.buyer"), value: `<@${session.user.discordId}>`, inline: false },
    ],
  });

  revalidatePath("/market");
  revalidatePath(`/market/${listingId}`);
  return listingCardState(listingId);
}

// Ownership + estado compartidos entre aceptar/rechazar (vendedor) y cancelar
// (comprador) una reserva de venta.
async function loadOwnedPendingSaleDeal(
  dealId: string,
  expectedOwner: "poster" | "buyer",
  discordId: string,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { listing: { include: { item: true } }, user: true },
  });
  if (!deal) throw new Error(t("offerNotFound"));
  if (deal.status !== "PENDING") throw new Error(t("offerNotPending"));
  if (deal.listing.type !== "SALE") throw new Error(t("notDirectSale"));
  const ownerId = expectedOwner === "poster" ? deal.listing.posterId : deal.userId;
  if (ownerId !== discordId) throw new Error(t("noPermissionOffer"));
  return deal;
}

// El vendedor CONFIRMA una reserva: pasa a vendida (ACCEPTED); si con eso se
// agota el stock (vendido calculado de los Deal), el listing pasa a COMPLETED.
export async function acceptSaleReservation(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");
  const tField = await getTranslations("market.field");

  const deal = await loadOwnedPendingSaleDeal(dealId, "poster", session.user.discordId, t);

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${deal.listingId} FOR UPDATE`;
    const cur = await tx.deal.findUnique({ where: { id: dealId }, select: { status: true, quantity: true } });
    if (!cur || cur.status !== "PENDING") throw new Error(t("offerNotPending"));
    const listing = await tx.listing.findUnique({
      where: { id: deal.listingId },
      select: { quantity: true, status: true },
    });
    if (!listing || listing.status !== "ACTIVE") throw new Error(t("listingNotActive"));

    // Guard anti-sobreventa: en "sin precio" (competitivo) las pujas PENDING no
    // retienen stock, así que la suma de las aceptadas podría pasarse del tope.
    // Se comprueba aquí, al aceptar. En precio fijo siempre pasa (la reserva ya
    // reservó el stock), así que es inocuo.
    if (listing.quantity !== null) {
      const acceptedAgg = await tx.deal.aggregate({
        where: { listingId: deal.listingId, status: "ACCEPTED" },
        _sum: { quantity: true },
      });
      const alreadySold = acceptedAgg._sum.quantity ?? 0;
      if (alreadySold + cur.quantity > listing.quantity) {
        throw new Error(t("notEnoughStock", { remaining: listing.quantity - alreadySold }));
      }
    }

    await tx.deal.update({ where: { id: dealId }, data: { status: "ACCEPTED" } });
    // Vendido = Σ cantidad de los Deal ACCEPTED (incluido el recién aceptado).
    const soldAgg = await tx.deal.aggregate({
      where: { listingId: deal.listingId, status: "ACCEPTED" },
      _sum: { quantity: true },
    });
    const sold = soldAgg._sum.quantity ?? 0;
    // Un listing ilimitado (quantity null) nunca se agota solo: lo cierra el
    // poster a mano (isSoldOut devuelve false ahí).
    await tx.listing.update({
      where: { id: deal.listingId },
      data: { status: isSoldOut(listing.quantity, sold) ? "COMPLETED" : "ACTIVE" },
    });
  });

  const appUrl = getAppUrl();
  await sendDirectMessage(deal.userId, {
    title: tDiscord("dm.reserveAccepted", {
      username: session.user.username,
      item: formatItemDisplayName(deal.listing.item.name, deal.listing.refineLevel, deal.listing.item.slotCount),
    }),
    url: `${appUrl}/market/${deal.listingId}`,
    color: DISCORD_EMBED_COLOR.SALE,
    itemIconUrl: `${appUrl}${deal.listing.item.iconUrl}`,
    fields: [
      { name: tField("quantity"), value: String(deal.quantity), inline: true },
      {
        name: tDiscord("fields.totalPrice"),
        value: formatPrice(deal.quantity * (deal.unitPrice ?? 0)),
        inline: true,
      },
      { name: tDiscord("fields.seller"), value: `<@${session.user.discordId}>`, inline: false },
    ],
  });

  revalidatePath("/market");
  revalidatePath(`/market/${deal.listingId}`);
  return listingCardState(deal.listingId);
}

// El vendedor RECHAZA una reserva: libera el stock retenido.
export async function rejectSaleReservation(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");

  const deal = await loadOwnedPendingSaleDeal(dealId, "poster", session.user.discordId, t);
  await prisma.deal.update({ where: { id: dealId }, data: { status: "REJECTED" } });

  const appUrl = getAppUrl();
  await sendDirectMessage(deal.userId, {
    title: tDiscord("dm.reserveRejected", {
      username: session.user.username,
      item: formatItemDisplayName(deal.listing.item.name, deal.listing.refineLevel, deal.listing.item.slotCount),
    }),
    url: `${appUrl}/market/${deal.listingId}`,
    color: DISCORD_EMBED_COLOR.SALE,
    itemIconUrl: `${appUrl}${deal.listing.item.iconUrl}`,
    fields: [{ name: tDiscord("fields.seller"), value: `<@${session.user.discordId}>`, inline: false }],
  });

  revalidatePath(`/market/${deal.listingId}`);
  return listingCardState(deal.listingId);
}

// El comprador CANCELA su propia reserva pendiente.
export async function cancelSaleReservation(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const deal = await loadOwnedPendingSaleDeal(dealId, "buyer", session.user.discordId, t);
  await prisma.deal.update({ where: { id: dealId }, data: { status: "CANCELLED" } });
  revalidatePath(`/market/${deal.listingId}`);
  return listingCardState(deal.listingId);
}

// ── Compras (BUY): el vendedor OFRECE suministrar, el comprador CONFIRMA ──
// Espejo de la reserva de venta con los roles invertidos: en una compra a
// precio fijo, la contraparte (Deal.userId) es el VENDEDOR que se ofrece a
// suministrar `quantity` unidades al precio fijo del listing; el comprador (el
// poster) confirma o rechaza. Varios vendedores pueden cubrir partes.

export async function offerToFulfill(listingId: string, formData: FormData) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");
  const tField = await getTranslations("market.field");

  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (maintenanceModeEnabled && !session.user.isAdmin) {
    throw new Error(t("maintenanceMode"));
  }

  const schema = z.object({
    quantity: z.coerce.number().int().positive(t("positiveQuantity")),
  });
  const parsed = schema.safeParse({ quantity: formData.get("quantity") });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? t("invalidData"));
  }
  const { quantity } = parsed.data;

  const { listing, unitPrice } = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${listingId} FOR UPDATE`;
    const listing = await tx.listing.findUnique({ where: { id: listingId }, include: { item: true } });
    if (!listing) throw new Error(t("listingNotFound"));
    if (listing.posterId === session.user.discordId) throw new Error(t("cannotOfferOwn"));
    if (listing.status !== "ACTIVE") throw new Error(t("listingNotActive"));
    if (listing.type !== "BUY") throw new Error(t("notBuyListing"));

    // Igual que en la venta: precio fijo (el vendedor se ofrece al precio del
    // comprador, la oferta PENDING retiene cupo) vs "sin precio" (competitivo: el
    // vendedor pide su unitPrice y las ofertas no bloquean cupo; el comprador
    // elige la más barata). El tope se aplica al ACEPTAR (acceptFulfillOffer).
    const competitive = listing.price === null;
    let unitPrice: number;
    if (listing.price === null) {
      const askParsed = z.coerce
        .number()
        .int()
        .positive(t("positivePrice"))
        .safeParse(formData.get("price"));
      if (!askParsed.success) {
        throw new Error(askParsed.error.issues[0]?.message ?? t("invalidPrice"));
      }
      unitPrice = askParsed.data;
    } else {
      unitPrice = listing.price;
    }

    // Cupo restante = cantidad pedida − ya cumplido − ya ofrecido (pendiente).
    const agg = await tx.deal.groupBy({
      by: ["status"],
      where: { listingId, status: { in: ["ACCEPTED", "PENDING"] } },
      _sum: { quantity: true },
    });
    const fulfilled = agg.find((a) => a.status === "ACCEPTED")?._sum.quantity ?? 0;
    const offered = agg.find((a) => a.status === "PENDING")?._sum.quantity ?? 0;
    // available null = compra ilimitada ("los que tengas"): sin cupo que topar.
    // En competitivo no se resta lo ofrecido (las ofertas no bloquean cupo).
    const available = availableFrom(listing.quantity, fulfilled, competitive ? 0 : offered);
    if (available !== null && quantity > available) {
      throw new Error(t("notEnoughStock", { remaining: available }));
    }

    await tx.deal.create({
      data: {
        listingId,
        userId: session.user.discordId,
        quantity,
        status: "PENDING",
        unitPrice,
      },
    });
    return { listing, unitPrice };
  });

  // Aviso al comprador (poster) de que hay una oferta de venta por confirmar.
  const appUrl = getAppUrl();
  await sendDirectMessage(listing.posterId, {
    title: tDiscord("dm.fulfillOffered", {
      username: session.user.username,
      item: formatItemDisplayName(listing.item.name, listing.refineLevel, listing.item.slotCount),
    }),
    url: `${appUrl}/market/${listingId}`,
    color: DISCORD_EMBED_COLOR.BUY,
    itemIconUrl: `${appUrl}${listing.item.iconUrl}`,
    fields: [
      { name: tField("quantity"), value: String(quantity), inline: true },
      { name: tDiscord("fields.totalPrice"), value: formatPrice(quantity * unitPrice), inline: true },
      { name: tDiscord("fields.seller"), value: `<@${session.user.discordId}>`, inline: false },
    ],
  });

  revalidatePath("/market");
  revalidatePath(`/market/${listingId}`);
  return listingCardState(listingId);
}

async function loadOwnedPendingBuyDeal(
  dealId: string,
  expectedOwner: "buyer" | "seller",
  discordId: string,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { listing: { include: { item: true } }, user: true },
  });
  if (!deal) throw new Error(t("offerNotFound"));
  if (deal.status !== "PENDING") throw new Error(t("offerNotPending"));
  if (deal.listing.type !== "BUY") throw new Error(t("notBuyListing"));
  // El comprador es el poster; el vendedor es quien hizo la oferta (Deal.userId).
  const ownerId = expectedOwner === "buyer" ? deal.listing.posterId : deal.userId;
  if (ownerId !== discordId) throw new Error(t("noPermissionOffer"));
  return deal;
}

// El comprador CONFIRMA una oferta de venta: cuenta como cumplida; si se
// alcanza la cantidad pedida, el listing pasa a COMPLETED.
export async function acceptFulfillOffer(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");
  const tField = await getTranslations("market.field");

  const deal = await loadOwnedPendingBuyDeal(dealId, "buyer", session.user.discordId, t);

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${deal.listingId} FOR UPDATE`;
    const cur = await tx.deal.findUnique({ where: { id: dealId }, select: { status: true, quantity: true } });
    if (!cur || cur.status !== "PENDING") throw new Error(t("offerNotPending"));
    const listing = await tx.listing.findUnique({
      where: { id: deal.listingId },
      select: { quantity: true, status: true },
    });
    if (!listing || listing.status !== "ACTIVE") throw new Error(t("listingNotActive"));

    // Guard anti-sobrecompra: en "sin precio" las ofertas PENDING no retienen
    // cupo, así que las aceptadas podrían pasarse de la cantidad pedida. Se
    // comprueba al aceptar (inocuo en precio fijo, donde la oferta ya reservó).
    if (listing.quantity !== null) {
      const acceptedAgg = await tx.deal.aggregate({
        where: { listingId: deal.listingId, status: "ACCEPTED" },
        _sum: { quantity: true },
      });
      const alreadyFulfilled = acceptedAgg._sum.quantity ?? 0;
      if (alreadyFulfilled + cur.quantity > listing.quantity) {
        throw new Error(t("notEnoughStock", { remaining: listing.quantity - alreadyFulfilled }));
      }
    }

    await tx.deal.update({ where: { id: dealId }, data: { status: "ACCEPTED" } });
    // Cumplido = Σ cantidad de los Deal ACCEPTED (incluido el recién aceptado).
    const fulfilledAgg = await tx.deal.aggregate({
      where: { listingId: deal.listingId, status: "ACCEPTED" },
      _sum: { quantity: true },
    });
    const fulfilled = fulfilledAgg._sum.quantity ?? 0;
    // Compra ilimitada (quantity null): nunca se cierra sola, la cierra el
    // comprador a mano (isSoldOut devuelve false).
    await tx.listing.update({
      where: { id: deal.listingId },
      data: { status: isSoldOut(listing.quantity, fulfilled) ? "COMPLETED" : "ACTIVE" },
    });
  });

  const appUrl = getAppUrl();
  await sendDirectMessage(deal.userId, {
    title: tDiscord("dm.fulfillAccepted", {
      username: session.user.username,
      item: formatItemDisplayName(deal.listing.item.name, deal.listing.refineLevel, deal.listing.item.slotCount),
    }),
    url: `${appUrl}/market/${deal.listingId}`,
    color: DISCORD_EMBED_COLOR.BUY,
    itemIconUrl: `${appUrl}${deal.listing.item.iconUrl}`,
    fields: [
      { name: tField("quantity"), value: String(deal.quantity), inline: true },
      {
        name: tDiscord("fields.totalPrice"),
        value: formatPrice(deal.quantity * (deal.unitPrice ?? 0)),
        inline: true,
      },
      { name: tDiscord("fields.buyer"), value: `<@${session.user.discordId}>`, inline: false },
    ],
  });

  revalidatePath("/market");
  revalidatePath(`/market/${deal.listingId}`);
  return listingCardState(deal.listingId);
}

// El comprador RECHAZA una oferta de venta.
export async function rejectFulfillOffer(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");

  const deal = await loadOwnedPendingBuyDeal(dealId, "buyer", session.user.discordId, t);
  await prisma.deal.update({ where: { id: dealId }, data: { status: "REJECTED" } });

  const appUrl = getAppUrl();
  await sendDirectMessage(deal.userId, {
    title: tDiscord("dm.fulfillRejected", {
      username: session.user.username,
      item: formatItemDisplayName(deal.listing.item.name, deal.listing.refineLevel, deal.listing.item.slotCount),
    }),
    url: `${appUrl}/market/${deal.listingId}`,
    color: DISCORD_EMBED_COLOR.BUY,
    itemIconUrl: `${appUrl}${deal.listing.item.iconUrl}`,
    fields: [{ name: tDiscord("fields.buyer"), value: `<@${session.user.discordId}>`, inline: false }],
  });

  revalidatePath(`/market/${deal.listingId}`);
  return listingCardState(deal.listingId);
}

// El vendedor CANCELA su propia oferta pendiente.
export async function cancelFulfillOffer(dealId: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const deal = await loadOwnedPendingBuyDeal(dealId, "seller", session.user.discordId, t);
  await prisma.deal.update({ where: { id: dealId }, data: { status: "CANCELLED" } });
  revalidatePath(`/market/${deal.listingId}`);
  return listingCardState(deal.listingId);
}
