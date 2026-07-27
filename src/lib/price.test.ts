import { describe, it, expect } from "vitest";
import { formatNumber, formatPrice, priceColorClass } from "@/lib/price";

describe("formatNumber / formatPrice", () => {
  // Nota: el separador de miles concreto depende de los datos ICU del host
  // (en producción es "." por es-ES); el test no se acopla a eso y comprueba
  // lo invariante: mismos dígitos que el entero y sin parte decimal.
  it("no muestra decimales y conserva los dígitos del entero", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1500).replace(/\D/g, "")).toBe("1500");
    expect(formatNumber(1500.7).replace(/\D/g, "")).toBe("1501"); // redondea, sin fracción
  });

  it("formatPrice es el número formateado + ' z'", () => {
    expect(formatPrice(1500)).toBe(`${formatNumber(1500)} z`);
    expect(formatPrice(1500).endsWith(" z")).toBe(true);
  });
});

describe("priceColorClass", () => {
  it("usa el color base por debajo de 1M", () => {
    expect(priceColorClass(0)).toBe("text-ro-gold-dark!");
    expect(priceColorClass(999_999)).toBe("text-ro-gold-dark!");
  });

  it("sube de color por cada orden de magnitud", () => {
    expect(priceColorClass(1_000_000)).toBe("text-green-700!");
    expect(priceColorClass(10_000_000)).toBe("text-blue-700!");
    expect(priceColorClass(100_000_000)).toBe("text-red-700!");
    expect(priceColorClass(1_000_000_000)).toBe("text-purple-700!");
  });
});
