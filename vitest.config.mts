import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Resuelve el alias "@/..." igual que tsconfig, y corre en entorno node
// (los tests actuales cubren lógica pura, sin DOM). Ver src/**/*.test.ts.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
