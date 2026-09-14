// Cálculo del límite de builds por usuario. Puro (sin dependencias de servidor)
// para poder testearlo y para no ser una server action (builds.ts es "use
// server": todo export ahí debe ser async).

export type BuildLimitConfig = {
  maxBuildsPerUser: number;
  buildsRoleId: string | null;
  buildsRoleMax: number | null;
};

// Límite EFECTIVO: si el usuario tiene el rol configurado (buildsRoleId) y hay un
// tope de rol (buildsRoleMax), ese override REEMPLAZA al base (override exacto,
// no "el mayor"); si no, el base (maxBuildsPerUser).
export function effectiveBuildLimit(config: BuildLimitConfig, roles: string[]): number {
  if (config.buildsRoleId && config.buildsRoleMax != null && roles.includes(config.buildsRoleId)) {
    return config.buildsRoleMax;
  }
  return config.maxBuildsPerUser;
}
