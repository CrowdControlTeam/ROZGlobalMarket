import { describe, it, expect } from "vitest";
import { ItemCategory, EquipSlot, WeaponType } from "@prisma/client";
import {
  getItemOptionGroup,
  buildOptionSelectionsFromDetected,
  emptyOptionSelections,
  MAX_OPTION_SLOTS,
} from "@/lib/item-options-constants";

const magical = new Set<WeaponType>([WeaponType.ROD, WeaponType.TWO_HAND_ROD, WeaponType.BOOK]);

describe("getItemOptionGroup", () => {
  it("clasifica armas físicas vs mágicas según magicalTypes", () => {
    expect(
      getItemOptionGroup({ category: ItemCategory.WEAPON, slot: null, weaponType: WeaponType.DAGGER }, magical),
    ).toBe("WEAPON_PHYSICAL");
    expect(
      getItemOptionGroup({ category: ItemCategory.WEAPON, slot: null, weaponType: WeaponType.ROD }, magical),
    ).toBe("WEAPON_MAGICAL");
  });

  it("devuelve null para arma sin weaponType clasificado", () => {
    expect(getItemOptionGroup({ category: ItemCategory.WEAPON, slot: null, weaponType: null }, magical)).toBeNull();
  });

  it("mapea los slots de armadura con pool de options", () => {
    expect(getItemOptionGroup({ category: ItemCategory.ARMOR, slot: EquipSlot.ARMOR, weaponType: null }, magical)).toBe("ARMOR");
    expect(getItemOptionGroup({ category: ItemCategory.ARMOR, slot: EquipSlot.GARMENT, weaponType: null }, magical)).toBe("GARMENT");
    expect(getItemOptionGroup({ category: ItemCategory.ARMOR, slot: EquipSlot.FOOTGEAR, weaponType: null }, magical)).toBe("FOOTGEAR");
  });

  it("devuelve null para armaduras sin pool (escudo, casco) y otras categorías", () => {
    expect(getItemOptionGroup({ category: ItemCategory.ARMOR, slot: EquipSlot.SHIELD, weaponType: null }, magical)).toBeNull();
    expect(getItemOptionGroup({ category: ItemCategory.ARMOR, slot: EquipSlot.UPPER_HEADGEAR, weaponType: null }, magical)).toBeNull();
    expect(getItemOptionGroup({ category: ItemCategory.CARD, slot: null, weaponType: null }, magical)).toBeNull();
    expect(getItemOptionGroup({ category: ItemCategory.CONSUMABLE, slot: null, weaponType: null }, magical)).toBeNull();
  });
});

describe("buildOptionSelectionsFromDetected", () => {
  it("coloca cada detección en su slot (1-indexado) y deja el resto vacío", () => {
    const result = buildOptionSelectionsFromDetected([
      { slotIndex: 1, defId: "a", value: 10 },
      { slotIndex: 3, defId: "c", value: 30 },
    ]);
    expect(result).toEqual([
      { defId: "a", value: 10 },
      { defId: "", value: "" },
      { defId: "c", value: 30 },
    ]);
  });

  it("ignora slotIndex fuera de rango", () => {
    const result = buildOptionSelectionsFromDetected([
      { slotIndex: 0, defId: "x", value: 1 },
      { slotIndex: MAX_OPTION_SLOTS + 1, defId: "y", value: 2 },
    ]);
    expect(result).toEqual(emptyOptionSelections());
  });
});
