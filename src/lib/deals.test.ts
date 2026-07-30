import { describe, it, expect } from "vitest";
import {
  computeListingQuantities,
  listingStatusOnClose,
  availableFrom,
  isSoldOut,
} from "./deals";

describe("computeListingQuantities", () => {
  it("sin deals: nada vendido ni reservado", () => {
    expect(computeListingQuantities(10, [])).toEqual({ sold: 0, reserved: 0, available: 10 });
  });

  it("suma ACCEPTED como vendido y PENDING como reservado; ignora REJECTED/CANCELLED", () => {
    const deals = [
      { status: "ACCEPTED" as const, quantity: 3 },
      { status: "ACCEPTED" as const, quantity: 2 },
      { status: "PENDING" as const, quantity: 4 },
      { status: "REJECTED" as const, quantity: 5 },
      { status: "CANCELLED" as const, quantity: 6 },
    ];
    expect(computeListingQuantities(10, deals)).toEqual({ sold: 5, reserved: 4, available: 1 });
  });

  it("quantity null (ilimitado) => available null, pero sigue contando vendido/reservado", () => {
    const deals = [
      { status: "ACCEPTED" as const, quantity: 7 },
      { status: "PENDING" as const, quantity: 3 },
    ];
    expect(computeListingQuantities(null, deals)).toEqual({ sold: 7, reserved: 3, available: null });
  });

  it("no devuelve disponible negativo (se satura en 0)", () => {
    const deals = [
      { status: "ACCEPTED" as const, quantity: 8 },
      { status: "PENDING" as const, quantity: 5 },
    ];
    expect(computeListingQuantities(10, deals).available).toBe(0);
  });

  it("todo vendido: available 0", () => {
    expect(computeListingQuantities(5, [{ status: "ACCEPTED", quantity: 5 }]).available).toBe(0);
  });
});

describe("availableFrom", () => {
  it("con tope: cantidad - vendido - reservado", () => {
    expect(availableFrom(10, 3, 2)).toBe(5);
  });
  it("no baja de 0", () => {
    expect(availableFrom(10, 8, 5)).toBe(0);
  });
  it("ilimitado (quantity null) => null", () => {
    expect(availableFrom(null, 100, 50)).toBeNull();
  });
});

describe("isSoldOut", () => {
  it("con tope y agotado => true", () => {
    expect(isSoldOut(5, 5)).toBe(true);
    expect(isSoldOut(5, 7)).toBe(true);
  });
  it("con tope y stock => false", () => {
    expect(isSoldOut(5, 4)).toBe(false);
  });
  it("ilimitado (null) nunca se agota => false", () => {
    expect(isSoldOut(null, 9999)).toBe(false);
  });
});

describe("listingStatusOnClose", () => {
  it("con ≥1 ACCEPTED => COMPLETED", () => {
    expect(
      listingStatusOnClose([{ status: "REJECTED" }, { status: "ACCEPTED" }, { status: "PENDING" }]),
    ).toBe("COMPLETED");
  });

  it("sin ninguna ACCEPTED => CANCELLED", () => {
    expect(listingStatusOnClose([{ status: "PENDING" }, { status: "REJECTED" }])).toBe("CANCELLED");
  });

  it("sin deals => CANCELLED", () => {
    expect(listingStatusOnClose([])).toBe("CANCELLED");
  });
});
