// Script puntual (no hook de build) para poblar ItemOptionDef con los 194
// registros reales de random options, extraídos de https://ragnarokze.ro/options
// el 2026-07-19. Idempotente: upsert sobre (group, slotIndex, statCode), se
// puede re-ejecutar sin duplicar filas.
//
// Uso: node prisma/seedItemOptions.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ELEMENTS = [
  "Neutral",
  "Water",
  "Earth",
  "Fire",
  "Wind",
  "Poison",
  "Holy",
  "Shadow",
  "Ghost",
  "Undead",
];

// Mismo orden de 10 elementos que ELEMENTS, sin "Neutral" (así viene en la
// fuente para "resistance increase" de Garment slot 2).
const ELEMENTS_NO_NEUTRAL = ELEMENTS.filter((e) => e !== "Neutral");

const RACES = [
  "Formless",
  "Undead",
  "Brute",
  "Plant",
  "Insect",
  "Fish",
  "Demon",
  "Demi-Human",
  "Angel",
  "Dragon",
];

function slugify(label) {
  return label
    .toUpperCase()
    .replace(/\(%\)/g, " PCT")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stat(label, min, max) {
  return { label, statCode: slugify(label), minValue: min, maxValue: max };
}

function elementalReduction(dmgType, min, max) {
  return ELEMENTS.map((el) =>
    stat(`${dmgType} Damage from ${el} enemies reduction (%)`, min, max),
  );
}

function elementalDamageTo(dmgType, min, max) {
  return ELEMENTS.map((el) => stat(`${dmgType} Damage to ${el} enemies (%)`, min, max));
}

function raceResistance(min, max) {
  return RACES.map((r) => stat(`Resistance to ${r} (%)`, min, max));
}

function raceDamageToMonsters(dmgType, min, max) {
  return RACES.map((r) => stat(`${dmgType} Damage to ${r} monsters (%)`, min, max));
}

function raceIgnoreDef(defType, min, max) {
  return RACES.map((r) => stat(`Ignore ${r} ${defType} Def (%)`, min, max));
}

const DATA = {
  ARMOR: {
    1: [stat("MaxHP", 150, 350), stat("MaxSP", 25, 50), stat("MaxHP (%)", 1, 5), stat("MaxSP (%)", 1, 5)],
    2: [
      stat("HP Recovery speed increase (%)", 15, 50),
      stat("SP Recovery speed increase (%)", 15, 50),
      stat("FLEE", 5, 15),
      stat("DEF", 10, 30),
      stat("MDEF", 1, 5),
      stat("Received Healing increase", 3, 7),
      stat("Variable Casting reduction", 5, 10),
      ...elementalReduction("Phys", 5, 10),
      ...elementalReduction("Magic", 5, 10),
    ],
    3: [stat("MaxHP", 150, 350), stat("MaxSP", 25, 50), ...raceResistance(3, 7)],
  },
  GARMENT: {
    1: [stat("MaxHP", 150, 250), stat("MaxSP", 25, 50), stat("MaxHP (%)", 1, 5), stat("MaxSP (%)", 1, 5)],
    2: [
      stat("FLEE", 5, 15),
      stat("DEF", 10, 50),
      stat("MDEF", 2, 5),
      stat("Received Healing increase", 5, 10),
      stat("Variable Casting reduction", 5, 10),
      ...elementalReduction("Phys", 5, 10),
      ...elementalReduction("Magic", 5, 10),
      ...ELEMENTS_NO_NEUTRAL.map((el) => stat(`${el} resistance increase (%)`, 1, 5)),
    ],
    3: [stat("MaxHP", 150, 300), stat("MaxSP", 25, 50), ...raceResistance(3, 7)],
  },
  FOOTGEAR: {
    1: [stat("MaxHP", 150, 250), stat("MaxSP", 25, 50), stat("MaxHP (%)", 1, 5), stat("MaxSP (%)", 1, 5)],
    2: [
      stat("FLEE", 5, 15),
      stat("DEF", 10, 50),
      stat("MDEF", 2, 5),
      stat("Received Healing increase", 5, 10),
      stat("HIT", 5, 10),
    ],
    3: [stat("MaxHP", 150, 300), stat("MaxSP", 25, 50), ...raceResistance(3, 7)],
  },
  WEAPON_PHYSICAL: {
    1: [stat("ATK", 5, 30), stat("ATK (%)", 1, 5)],
    2: [
      stat("ASPD", 1, 1),
      stat("ASPD increase (%)", 5, 7),
      stat("HIT", 5, 20),
      stat("FLEE", 10, 20),
      stat("CRI", 2, 5),
      stat("Critical Damage increase (%)", 5, 10),
      ...elementalDamageTo("Physical", 5, 10),
    ],
    3: [
      ...raceDamageToMonsters("Phys", 5, 10),
      ...raceIgnoreDef("Phys", 5, 15),
      stat("Ignore Normal Enemy Phys Def (%)", 5, 10),
      stat("Phys Damage to Normal enemies (%)", 3, 7),
      stat("Phys Damage to Boss enemies (%)", 3, 7),
    ],
  },
  WEAPON_MAGICAL: {
    1: [stat("MATK", 5, 30), stat("MATK (%)", 1, 5)],
    2: [
      stat("FLEE", 10, 20),
      stat("Heal increase (%)", 5, 10),
      stat("Variable Casting reduction (%)", 5, 10),
      ...elementalDamageTo("Magic", 5, 10),
    ],
    3: [
      ...raceDamageToMonsters("Magic", 5, 10),
      ...raceIgnoreDef("Magic", 5, 15),
      stat("Ignore Normal Enemy Magic Def (%)", 5, 10),
      stat("Magic Damage to Normal enemies (%)", 3, 7),
      stat("Magic Damage to Boss enemies (%)", 3, 7),
      stat("Heal increase (%)", 5, 10),
    ],
  },
};

const EXPECTED_COUNTS = {
  ARMOR: 43,
  GARMENT: 50,
  FOOTGEAR: 21,
  WEAPON_PHYSICAL: 41,
  WEAPON_MAGICAL: 39,
};

async function main() {
  let total = 0;
  for (const [group, slots] of Object.entries(DATA)) {
    let groupCount = 0;
    for (const [slotIndex, entries] of Object.entries(slots)) {
      for (const entry of entries) {
        await prisma.itemOptionDef.upsert({
          where: {
            group_slotIndex_statCode: {
              group,
              slotIndex: Number(slotIndex),
              statCode: entry.statCode,
            },
          },
          update: { label: entry.label, minValue: entry.minValue, maxValue: entry.maxValue },
          create: {
            group,
            slotIndex: Number(slotIndex),
            statCode: entry.statCode,
            label: entry.label,
            minValue: entry.minValue,
            maxValue: entry.maxValue,
          },
        });
        groupCount++;
      }
    }
    total += groupCount;
    const expected = EXPECTED_COUNTS[group];
    const flag = groupCount === expected ? "OK" : "MISMATCH";
    console.log(`${group}: ${groupCount} (esperado ${expected}) [${flag}]`);
  }
  console.log(`Total: ${total} (esperado ${Object.values(EXPECTED_COUNTS).reduce((a, b) => a + b, 0)})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
