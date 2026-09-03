import { describe, it, expect } from "vitest";
import { EquipSlot, ItemCategory, WeaponType } from "@/db/enums";
import { isOneHandWeapon } from "@/lib/item-slots";
import { isDualWieldJob, itemFitsBuildSlot } from "@/lib/build-constants";

const ASSASSIN = 12;
const NINJA = 25;
const KNIGHT = 8; // cualquier clase sin dual wield

const weapon = (weaponType: WeaponType | null) => ({
  category: ItemCategory.WEAPON,
  slot: EquipSlot.WEAPON,
  weaponType,
});
const shield = { category: ItemCategory.ARMOR, slot: EquipSlot.SHIELD, weaponType: null };
const armor = { category: ItemCategory.ARMOR, slot: EquipSlot.ARMOR, weaponType: null };

describe("isOneHandWeapon", () => {
  it("acepta armas de una mano", () => {
    expect(isOneHandWeapon(weapon(WeaponType.DAGGER))).toBe(true);
    expect(isOneHandWeapon(weapon(WeaponType.ONE_HAND_SWORD))).toBe(true);
    expect(isOneHandWeapon(weapon(WeaponType.MACE))).toBe(true);
  });
  it("rechaza armas de dos manos", () => {
    expect(isOneHandWeapon(weapon(WeaponType.TWO_HAND_SWORD))).toBe(false);
    expect(isOneHandWeapon(weapon(WeaponType.KATAR))).toBe(false);
    expect(isOneHandWeapon(weapon(WeaponType.BOW))).toBe(false);
    expect(isOneHandWeapon(weapon(WeaponType.FUUMA_SHURIKEN))).toBe(false);
  });
  it("rechaza no-armas y armas sin tipo", () => {
    expect(isOneHandWeapon(shield)).toBe(false);
    expect(isOneHandWeapon(weapon(null))).toBe(false);
  });
});

describe("isDualWieldJob", () => {
  it("solo Assassin y Ninja", () => {
    expect(isDualWieldJob(ASSASSIN)).toBe(true);
    expect(isDualWieldJob(NINJA)).toBe(true);
    expect(isDualWieldJob(KNIGHT)).toBe(false);
    expect(isDualWieldJob(null)).toBe(false);
  });
});

describe("itemFitsBuildSlot — off-hand (SHIELD)", () => {
  it("clase con dual wield: escudo o arma de una mano", () => {
    expect(itemFitsBuildSlot(shield, "SHIELD", ASSASSIN)).toBe(true);
    expect(itemFitsBuildSlot(weapon(WeaponType.DAGGER), "SHIELD", ASSASSIN)).toBe(true);
    expect(itemFitsBuildSlot(weapon(WeaponType.DAGGER), "SHIELD", NINJA)).toBe(true);
  });
  it("clase con dual wield: NO admite armas de dos manos", () => {
    expect(itemFitsBuildSlot(weapon(WeaponType.TWO_HAND_SWORD), "SHIELD", ASSASSIN)).toBe(false);
    expect(itemFitsBuildSlot(weapon(WeaponType.KATAR), "SHIELD", ASSASSIN)).toBe(false);
  });
  it("clase sin dual wield: solo escudos", () => {
    expect(itemFitsBuildSlot(shield, "SHIELD", KNIGHT)).toBe(true);
    expect(itemFitsBuildSlot(weapon(WeaponType.DAGGER), "SHIELD", KNIGHT)).toBe(false);
    expect(itemFitsBuildSlot(weapon(WeaponType.DAGGER), "SHIELD", null)).toBe(false);
  });
});

describe("itemFitsBuildSlot — otros slots (sin efecto del dual wield)", () => {
  it("el arma va en WEAPON para cualquier clase", () => {
    expect(itemFitsBuildSlot(weapon(WeaponType.TWO_HAND_SWORD), "WEAPON", KNIGHT)).toBe(true);
    expect(itemFitsBuildSlot(weapon(WeaponType.DAGGER), "WEAPON", ASSASSIN)).toBe(true);
  });
  it("un arma no encaja en ARMOR ni una armadura en WEAPON", () => {
    expect(itemFitsBuildSlot(weapon(WeaponType.DAGGER), "ARMOR", ASSASSIN)).toBe(false);
    expect(itemFitsBuildSlot(armor, "WEAPON", ASSASSIN)).toBe(false);
    expect(itemFitsBuildSlot(armor, "ARMOR", ASSASSIN)).toBe(true);
  });
});
