import { describe, it, expect } from "vitest";
import { ItemCategory, EquipSlot } from "@prisma/client";
import { isRefineEligible, formatRefinedName } from "@/lib/refine-constants";

describe("isRefineEligible", () => {
  it("las armas siempre son refinables", () => {
    expect(isRefineEligible({ category: ItemCategory.WEAPON, slot: null })).toBe(true);
  });

  it("armaduras refinables: casco, cuerpo, escudo, prenda, calzado", () => {
    for (const slot of [
      EquipSlot.HEADGEAR,
      EquipSlot.ARMOR,
      EquipSlot.SHIELD,
      EquipSlot.GARMENT,
      EquipSlot.FOOTGEAR,
    ]) {
      expect(isRefineEligible({ category: ItemCategory.ARMOR, slot })).toBe(true);
    }
  });

  it("no refinables: accesorio, slot nulo y otras categorías", () => {
    expect(isRefineEligible({ category: ItemCategory.ARMOR, slot: EquipSlot.ACCESSORY })).toBe(false);
    expect(isRefineEligible({ category: ItemCategory.ARMOR, slot: null })).toBe(false);
    expect(isRefineEligible({ category: ItemCategory.CARD, slot: null })).toBe(false);
  });
});

describe("formatRefinedName", () => {
  it("prefija +N solo a partir de +1", () => {
    expect(formatRefinedName("Blade", 0)).toBe("Blade");
    expect(formatRefinedName("Blade", 9)).toBe("+9 Blade");
  });
});
