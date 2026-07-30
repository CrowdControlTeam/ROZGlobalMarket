import { describe, it, expect } from "vitest";
import { ItemCategory, EquipSlot } from "@prisma/client";
import {
  getMaxCardSlots,
  isCardSlotEligible,
  formatItemDisplayName,
  MAX_WEAPON_CARD_SLOTS,
  MAX_ARMOR_CARD_SLOTS,
} from "@/lib/card-slots-constants";

describe("getMaxCardSlots", () => {
  it("armas hasta 4 slots", () => {
    expect(getMaxCardSlots({ category: ItemCategory.WEAPON, slot: null })).toBe(MAX_WEAPON_CARD_SLOTS);
  });

  it("armaduras hasta 1 slot, salvo casco inferior (0)", () => {
    expect(getMaxCardSlots({ category: ItemCategory.ARMOR, slot: EquipSlot.ARMOR })).toBe(MAX_ARMOR_CARD_SLOTS);
    expect(getMaxCardSlots({ category: ItemCategory.ARMOR, slot: EquipSlot.LOWER_HEADGEAR })).toBe(0);
  });

  it("otras categorías, 0 slots", () => {
    expect(getMaxCardSlots({ category: ItemCategory.CARD, slot: null })).toBe(0);
    expect(getMaxCardSlots({ category: ItemCategory.CONSUMABLE, slot: null })).toBe(0);
  });
});

describe("isCardSlotEligible", () => {
  it("refleja getMaxCardSlots > 0", () => {
    expect(isCardSlotEligible({ category: ItemCategory.WEAPON, slot: null })).toBe(true);
    expect(isCardSlotEligible({ category: ItemCategory.ARMOR, slot: EquipSlot.LOWER_HEADGEAR })).toBe(false);
    expect(isCardSlotEligible({ category: ItemCategory.PET, slot: null })).toBe(false);
  });
});

describe("formatItemDisplayName", () => {
  it("combina prefijo de refine (con espacio) y sufijo de slots (pegado)", () => {
    expect(formatItemDisplayName("Silk Robe", 7, 1)).toBe("+7 Silk Robe[1]");
  });

  it("omite el prefijo y/o sufijo cuando son 0", () => {
    expect(formatItemDisplayName("Silk Robe", 0, 0)).toBe("Silk Robe");
    expect(formatItemDisplayName("Silk Robe", 5, 0)).toBe("+5 Silk Robe");
    expect(formatItemDisplayName("Silk Robe", 0, 2)).toBe("Silk Robe[2]");
  });
});
