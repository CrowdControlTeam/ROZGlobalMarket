// Seed de EJEMPLOS para desarrollo local: reemplaza Listings/Deals/BisEntries
// por un set que cubre las combinaciones (tipos, precio/sin precio, cantidad/
// ilimitado, refino, options por grupo, estados; y BiS por slot × concreto/
// genérico/ambos × etiquetas). Re-ejecutable (borra y recrea). Solo LOCAL.
//
// Uso: node prisma/seedExamples.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OTHER_ID = "100000000000000001"; // usuario sintético (para deals entrantes/salientes)

async function pick(where) {
  return prisma.item.findFirst({ where: { tradeable: true, ...where }, orderBy: { name: "asc" } });
}
async function loadOpts(group) {
  const out = [];
  for (let s = 1; s <= 3; s++) {
    out.push(await prisma.itemOptionDef.findFirst({ where: { group, slotIndex: s }, orderBy: { label: "asc" } }));
  }
  return out.filter(Boolean);
}
// Options de listing: value = roll (SALE/TRADE, usamos el máximo) o mínimo (BUY).
const listingOpts = (defs, kind) =>
  defs.map((d, i) => ({ slotIndex: i + 1, defId: d.id, value: kind === "min" ? d.minValue : d.maxValue }));
// Options de BiS: minValue opcional (null = "cualquier valor").
const bisOpts = (defs, withMin) =>
  defs.map((d, i) => ({ slotIndex: i + 1, defId: d.id, minValue: withMin ? d.minValue : null }));

async function main() {
  // --- Limpieza (test data local) ---
  await prisma.deal.deleteMany({});
  await prisma.bisEntry.deleteMany({});
  await prisma.listing.deleteMany({});

  const me = await prisma.user.findFirst({ where: { id: { not: OTHER_ID } } });
  if (!me) throw new Error("No hay usuario real; inicia sesión al menos una vez.");
  const other = await prisma.user.upsert({
    where: { id: OTHER_ID },
    update: { username: "TestBuyer" },
    create: { id: OTHER_ID, username: "TestBuyer" },
  });
  const stage = await prisma.bisStage.findFirst({ orderBy: { order: "desc" } });
  const roles = await prisma.combatRole.findMany({ orderBy: { order: "asc" } });
  const jobs = await prisma.job.findMany({ orderBy: { order: "asc" } });
  const R = (i) => roles[i % roles.length].id;
  const J = (i) => jobs[i % jobs.length].id;

  // --- Items representativos ---
  const wPhys = await pick({ category: "WEAPON", weaponType: { in: ["ONE_HAND_SWORD", "DAGGER", "MACE", "ONE_HAND_AXE"] } });
  const wMag = await pick({ category: "WEAPON", weaponType: { in: ["ROD", "BOOK"] } });
  const armor = await pick({ category: "ARMOR", slot: "ARMOR" });
  const garment = await pick({ category: "ARMOR", slot: "GARMENT" });
  const footgear = await pick({ category: "ARMOR", slot: "FOOTGEAR" });
  const headgear = await pick({ category: "ARMOR", slot: "HEADGEAR" });
  const shield = await pick({ category: "ARMOR", slot: "SHIELD" });
  const accessory = await pick({ category: "ARMOR", slot: "ACCESSORY" });
  const card = await pick({ category: "CARD" });
  const consumable = await pick({ category: { in: ["HEALING", "USABLE"] } });

  const [oPhys, oMag, oArmor, oGarment, oFootgear] = await Promise.all([
    loadOpts("WEAPON_PHYSICAL"),
    loadOpts("WEAPON_MAGICAL"),
    loadOpts("ARMOR"),
    loadOpts("GARMENT"),
    loadOpts("FOOTGEAR"),
  ]);

  // --- Listings ---
  const L = []; // guardo algunos para colgar deals
  const mk = async (data) => {
    const created = await prisma.listing.create({ data: { posterId: me.id, ...data } });
    L.push(created);
    return created;
  };
  const opt = (opts) => (opts.length ? { create: opts } : undefined);

  // SALE — variando refino, options (por grupo), precio/sin precio, cantidad.
  await mk({ itemId: wPhys.id, type: "SALE", refineLevel: 7, price: 5_000_000, quantity: 1, notes: "Roll perfecto, no negociable.", options: opt(listingOpts(oPhys.slice(0, 2), "roll")) });
  await mk({ itemId: wMag.id, type: "SALE", refineLevel: 9, price: 12_000_000, quantity: 3, options: opt(listingOpts(oMag.slice(0, 1), "roll")) });
  await mk({ itemId: armor.id, type: "SALE", refineLevel: 4, price: null, quantity: 5, notes: "Mejor oferta.", options: opt(listingOpts(oArmor.slice(0, 2), "roll")) }); // sin precio (competitivo)
  await mk({ itemId: garment.id, type: "SALE", refineLevel: 0, price: 800_000, quantity: 2, options: opt(listingOpts(oGarment.slice(0, 1), "roll")) });
  await mk({ itemId: footgear.id, type: "SALE", refineLevel: 3, price: 1_500_000, quantity: 1, options: opt(listingOpts(oFootgear.slice(0, 3), "roll")) }); // 3 options
  await mk({ itemId: headgear.id, type: "SALE", refineLevel: 5, price: 3_000_000, quantity: 1 }); // headgear: sin options
  await mk({ itemId: shield.id, type: "SALE", refineLevel: 2, price: 600_000, quantity: 1 });
  await mk({ itemId: accessory.id, type: "SALE", refineLevel: 0, price: 400_000, quantity: 4 }); // accesorio: sin refino/options
  await mk({ itemId: card.id, type: "SALE", refineLevel: 0, price: 2_500_000, quantity: 2 });
  await mk({ itemId: consumable.id, type: "SALE", refineLevel: 0, price: 1_200, quantity: null }); // ILIMITADO (material)
  const soldListing = await mk({ itemId: consumable.id, type: "SALE", price: 900, quantity: 10, status: "ACTIVE", notes: "Con ventas ya cerradas." });
  await mk({ itemId: wPhys.id, type: "SALE", refineLevel: 6, price: 2_000_000, quantity: 1, status: "CANCELLED" });
  await mk({ itemId: card.id, type: "SALE", price: 1_000_000, quantity: 1, status: "EXPIRED" });

  // BUY — precio fijo o mejor precio, ilimitado, options como mínimos.
  const buyWeapon = await mk({ itemId: wPhys.id, type: "BUY", price: 4_000_000, quantity: 2, notes: "Compro con estas stats mínimas.", options: opt(listingOpts(oPhys.slice(0, 2), "min")) });
  await mk({ itemId: armor.id, type: "BUY", price: null, quantity: null }); // mejor precio + ilimitado
  await mk({ itemId: card.id, type: "BUY", price: 2_000_000, quantity: 1 });
  await mk({ itemId: consumable.id, type: "BUY", price: 1_000, quantity: null });

  // TRADE — sin precio, cantidad 1, con/ sin options, notas.
  const tradeListing = await mk({ itemId: wMag.id, type: "TRADE", refineLevel: 7, quantity: 1, price: null, notes: "Busco arma física equivalente." });
  await mk({ itemId: armor.id, type: "TRADE", quantity: 1, price: null, options: opt(listingOpts(oArmor.slice(0, 1), "roll")) });

  // GIFT — reclamable (cantidad, sin precio).
  const giftListing = await mk({ itemId: card.id, type: "GIFT", quantity: 3, price: null, notes: "¡Regalo para quien lo pille!" });
  await mk({ itemId: consumable.id, type: "GIFT", quantity: 5, price: null });
  await mk({ itemId: headgear.id, type: "GIFT", refineLevel: 4, quantity: 1, price: null });

  // Listing del OTRO usuario (para un deal saliente mío).
  const otherListing = await prisma.listing.create({
    data: { posterId: other.id, itemId: wPhys.id, type: "SALE", refineLevel: 8, price: 9_000_000, quantity: 1 },
  });

  // --- Deals (pestaña Pendientes) ---
  // Entrantes (sobre MIS listings, de `other`):
  await prisma.deal.create({ data: { listingId: L[0].id, userId: other.id, quantity: 1, status: "PENDING", unitPrice: 5_000_000 } }); // reserva de venta
  await prisma.deal.create({ data: { listingId: buyWeapon.id, userId: other.id, quantity: 1, status: "PENDING", unitPrice: 4_000_000 } }); // le vendo (BUY)
  await prisma.deal.create({ data: { listingId: tradeListing.id, userId: other.id, quantity: 1, status: "PENDING", offeredItemId: wPhys.id, offeredQuantity: 1, offeredRefine: 7, zenyOffered: 500_000 } }); // oferta de trade
  await prisma.deal.create({ data: { listingId: giftListing.id, userId: other.id, quantity: 1, status: "PENDING" } }); // reclamación de regalo
  // Vendido/cerrado (ACCEPTED → cuenta como "vendido"):
  await prisma.deal.create({ data: { listingId: soldListing.id, userId: other.id, quantity: 4, status: "ACCEPTED", unitPrice: 900 } });
  // Saliente (MI deal sobre el listing de `other`):
  await prisma.deal.create({ data: { listingId: otherListing.id, userId: me.id, quantity: 1, status: "PENDING", unitPrice: 9_000_000 } });

  // --- BiS ---
  const pos = {};
  const nextPos = (slot) => (pos[slot] = (pos[slot] ?? -1) + 1);
  const bis = (slot, data) =>
    prisma.bisEntry.create({
      data: {
        stageId: stage.id,
        slot,
        position: nextPos(slot),
        createdById: me.id,
        roles: { connect: (data.roleIdx ?? []).map((i) => ({ id: R(i) })) },
        jobs: { connect: (data.jobIdx ?? []).map((i) => ({ id: J(i) })) },
        itemId: data.itemId ?? null,
        refineLevel: data.refineLevel ?? null,
        note: data.note ?? null,
        options: data.opts?.length ? { create: data.opts } : undefined,
      },
    });

  await bis("HEADGEAR", { itemId: headgear.id, refineLevel: 7, roleIdx: [0], note: "Casco recomendado." });
  await bis("ARMOR", { itemId: armor.id, refineLevel: 4, jobIdx: [0] });
  await bis("ARMOR", { opts: bisOpts(oArmor.slice(0, 2), true), roleIdx: [1], note: "Cualquier armadura con estas stats." }); // genérico con mínimos
  await bis("SHIELD", { itemId: shield.id, refineLevel: 4, roleIdx: [0], jobIdx: [1] });
  await bis("GARMENT", { opts: bisOpts(oGarment.slice(0, 1), false), jobIdx: [2] }); // genérico sin mínimo
  await bis("FOOTGEAR", { itemId: footgear.id, refineLevel: 5, roleIdx: [2] });
  await bis("FOOTGEAR", { opts: bisOpts(oFootgear.slice(0, 1), true), jobIdx: [3] });
  await bis("ACCESSORY", { itemId: accessory.id, roleIdx: [3] }); // sin refino/options
  await bis("WEAPON", { itemId: wPhys.id, refineLevel: 9, jobIdx: [0] });
  await bis("WEAPON", { opts: bisOpts(oPhys.slice(0, 2), true), roleIdx: [0], note: "Arma física genérica." });
  await bis("WEAPON", { opts: bisOpts(oMag.slice(0, 1), false), jobIdx: [1] }); // arma mágica genérica
  await bis("WEAPON", { itemId: wPhys.id, refineLevel: 7, opts: bisOpts(oPhys.slice(0, 1), true), roleIdx: [1], jobIdx: [2] }); // item + options

  const [nl, nd, nb] = await Promise.all([prisma.listing.count(), prisma.deal.count(), prisma.bisEntry.count()]);
  console.log(`Ejemplos creados → listings: ${nl} | deals: ${nd} | bisEntries: ${nb}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
