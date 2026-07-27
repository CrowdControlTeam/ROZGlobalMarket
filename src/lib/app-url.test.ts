import { describe, it, expect, afterEach } from "vitest";
import { getAppUrl } from "@/lib/app-url";

const original = process.env.APP_URL;

afterEach(() => {
  if (original === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = original;
});

describe("getAppUrl", () => {
  it("usa APP_URL cuando está definida", () => {
    process.env.APP_URL = "https://market.example.com";
    expect(getAppUrl()).toBe("https://market.example.com");
  });

  it("quita la barra final para poder concatenar rutas sin dobles", () => {
    process.env.APP_URL = "https://market.example.com/";
    expect(getAppUrl()).toBe("https://market.example.com");
    process.env.APP_URL = "https://market.example.com///";
    expect(getAppUrl()).toBe("https://market.example.com");
  });

  it("cae a localhost si no está definida o está vacía", () => {
    delete process.env.APP_URL;
    expect(getAppUrl()).toBe("http://localhost:3000");
    process.env.APP_URL = "   ";
    expect(getAppUrl()).toBe("http://localhost:3000");
  });
});
