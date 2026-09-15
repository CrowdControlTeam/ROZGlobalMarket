import { describe, it, expect } from "vitest";
import { effectiveBuildLimit } from "@/lib/build-limit";

const base = { maxBuildsPerUser: 5, buildsRoleId: null, buildsRoleMax: null };

describe("effectiveBuildLimit", () => {
  it("usa el base cuando no hay override configurado", () => {
    expect(effectiveBuildLimit(base, ["r1", "r2"])).toBe(5);
  });

  it("aplica el override exacto si el usuario tiene el rol", () => {
    const cfg = { maxBuildsPerUser: 5, buildsRoleId: "vip", buildsRoleMax: 20 };
    expect(effectiveBuildLimit(cfg, ["vip", "otro"])).toBe(20);
  });

  it("usa el base si el usuario NO tiene el rol", () => {
    const cfg = { maxBuildsPerUser: 5, buildsRoleId: "vip", buildsRoleMax: 20 };
    expect(effectiveBuildLimit(cfg, ["otro"])).toBe(5);
  });

  it("es override exacto: el rol puede reducir el tope", () => {
    const cfg = { maxBuildsPerUser: 5, buildsRoleId: "vip", buildsRoleMax: 2 };
    expect(effectiveBuildLimit(cfg, ["vip"])).toBe(2);
  });

  it("sin buildsRoleMax (rol configurado a medias) usa el base", () => {
    const cfg = { maxBuildsPerUser: 5, buildsRoleId: "vip", buildsRoleMax: null };
    expect(effectiveBuildLimit(cfg, ["vip"])).toBe(5);
  });
});
