import { describe, it, expect } from "vitest";
import { getItem, getItems, itemExists, getAllItems } from "@/lib/item-store";

describe("item-store", () => {
  it("carga el catálogo completo en memoria", () => {
    expect(getAllItems().length).toBeGreaterThan(3000);
  });

  it("resuelve un item por id con todos sus campos", () => {
    const red = getItem("501"); // Red Potion (id estable del cliente)
    expect(red).toBeDefined();
    expect(red!.name).toBe("Red Potion");
    expect(red).toHaveProperty("description");
    expect(red).toHaveProperty("iconUrl", "/icons/items/501.png");
  });

  it("devuelve undefined y false para ids desconocidos", () => {
    expect(getItem("999999999")).toBeUndefined();
    expect(itemExists("999999999")).toBe(false);
    expect(itemExists("501")).toBe(true);
  });

  it("getItems resuelve en bloque e ignora ids desconocidos", () => {
    const m = getItems(["501", "999999999"]);
    expect(m.size).toBe(1);
    expect(m.get("501")!.name).toBe("Red Potion");
  });
});
