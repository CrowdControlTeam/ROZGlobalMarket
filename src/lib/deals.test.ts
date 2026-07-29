import { describe, it, expect } from "vitest";
import { computeListingQuantities, listingStatusOnClose } from "./deals";

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
