import data from "@/data/skill-planner.json";

// --- Tipos del bundle (ver scripts/prepare-skills.mjs) ---
export type Cell = { pos: number; id: number };
export type SkillReq = { id: number; lv: number };
export type Job = {
  id: number;
  name: string;
  parentId: number | null;
  tier: "first" | "second";
  points: number;
  cells: Cell[];
};
// Stats de combate/coste para el detalle (ver scripts/prepare-skills.mjs).
// Los por-nivel son array (o escalar si no varían); los tiempos van en ms.
export type SkillStats = {
  type?: string; // Magic | Weapon | Misc
  element?: string; // Fire | Water | ... (ausente si usa el elemento del arma)
  target?: string; // Attack | Self | Ground | Support | Trap
  range?: number;
  splash?: number | number[];
  hits?: number | number[];
  castVar?: number | number[]; // cast variable (ms)
  castFixed?: number; // cast fijo (ms)
  afterCast?: number; // delay tras cast (ms)
  cooldown?: number; // ms
  cost?: {
    hp?: number | number[];
    zeny?: number | number[];
    spirit?: number; // esferas espirituales
    ammo?: boolean;
    weapon?: string[]; // tipos de arma requeridos (conjunto pequeño)
    state?: string; // estado requerido (Riding, Cart, Hiding...)
    status?: string[];
    items?: { name: string; amount: number }[];
  };
};

export type Skill = {
  name: string;
  max: number;
  type: string;
  pre: boolean; // ya aprendida, gratis y bloqueada (platinum/novice)
  desc: string[];
  req: Record<string, SkillReq[]>; // prereqs por jobId
  reqDefault: SkillReq[]; // fallback plano (requiredSkills)
  sp?: number[]; // consumo de SP por nivel (ausente si no gasta SP)
  stats?: SkillStats; // combate/coste para el detalle
};
type SkillData = { jobs: Job[]; noviceCells: Cell[]; skills: Record<string, Skill> };

export const SKILL_DATA = data as SkillData;
export const GRID_COLS = 7;

export function getJob(id: number): Job | undefined {
  return SKILL_DATA.jobs.find((j) => j.id === id);
}
export function getSkill(id: number): Skill | undefined {
  return SKILL_DATA.skills[String(id)];
}

// Jobs seleccionables para el selector: 1st ordenados por ID; 2nd ordenados
// según su padre (mismo orden que los 1st, o sea por parentId) y, dentro del
// mismo padre, por ID. Así Swordman (1º de 1st) trae Knight y Crusader al frente
// de los 2nd.
export function selectableJobs() {
  return {
    first: SKILL_DATA.jobs.filter((j) => j.tier === "first").sort((a, b) => a.id - b.id),
    second: SKILL_DATA.jobs
      .filter((j) => j.tier === "second")
      .sort((a, b) => (a.parentId ?? 0) - (b.parentId ?? 0) || a.id - b.id),
  };
}

export type Levels = Record<number, number>;

// Nivel efectivo: las pre (platinum/novice) cuentan siempre a su máximo.
export function effLevel(id: number, levels: Levels): number {
  const s = getSkill(id);
  if (s?.pre) return s.max;
  return levels[id] ?? 0;
}

// --- Vista: árboles a mostrar para el job elegido ---
export type TreeView = { job: Job; tier: "first" | "second"; cells: Cell[] };

export function buildTrees(selectedJobId: number | null): TreeView[] {
  if (selectedJobId == null) return [];
  const job = getJob(selectedJobId);
  if (!job) return [];
  if (job.tier === "first") {
    return [{ job, tier: "first", cells: [...job.cells, ...SKILL_DATA.noviceCells] }];
  }
  const parent = job.parentId != null ? getJob(job.parentId) : undefined;
  const trees: TreeView[] = [];
  if (parent) {
    trees.push({ job: parent, tier: "first", cells: [...parent.cells, ...SKILL_DATA.noviceCells] });
  }
  trees.push({ job, tier: "second", cells: job.cells });
  return trees;
}

// --- Contexto de cálculo (pools + lookup de tier/job por skill) ---
export type PlannerCtx = {
  bySkill: Map<number, { jobId: number; tier: "first" | "second" }>;
  editableIds: number[];
  P1: number; // pool 1st (solo skills de 1st)
  P2: number; // pool 2nd (skills de 2nd o de 1st)
};

export function buildCtx(selectedJobId: number | null): PlannerCtx {
  const trees = buildTrees(selectedJobId);
  const bySkill = new Map<number, { jobId: number; tier: "first" | "second" }>();
  const editableIds: number[] = [];
  let P1 = 0;
  let P2 = 0;
  for (const tree of trees) {
    if (tree.tier === "first") P1 = tree.job.points;
    else P2 = tree.job.points;
    for (const cell of tree.cells) {
      if (bySkill.has(cell.id)) continue;
      bySkill.set(cell.id, { jobId: tree.job.id, tier: tree.tier });
      const s = getSkill(cell.id);
      if (s && !s.pre) editableIds.push(cell.id);
    }
  }
  return { bySkill, editableIds, P1, P2 };
}

// Prereqs de una skill EN el árbol donde se muestra (por job; fallback plano).
export function prereqsOf(id: number, ctx: PlannerCtx): SkillReq[] {
  const s = getSkill(id);
  if (!s) return [];
  const info = ctx.bySkill.get(id);
  const byJob = info ? s.req[String(info.jobId)] : undefined;
  return byJob ?? s.reqDefault;
}

// --- Códec del build (export/import/share) ---
// Formato binario compacto: [ver=1][jobId u16][ (skillId u16)(level u8) × n ],
// codificado en base64url. Solo se guardan skills con nivel > 0 (las pre y las
// de nivel 0 se derivan). Robusto a reordenar datos (guarda ids explícitos) y se
// valida al importar.
const BUILD_VERSION = 1;

function base64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function encodeBuild(jobId: number, levels: Levels): string {
  const entries = Object.entries(levels)
    .map(([id, lv]) => [Number(id), lv] as const)
    .filter(([, lv]) => lv > 0);
  const buf = new Uint8Array(3 + entries.length * 3);
  const dv = new DataView(buf.buffer);
  buf[0] = BUILD_VERSION;
  dv.setUint16(1, jobId);
  let off = 3;
  for (const [id, lv] of entries) {
    dv.setUint16(off, id);
    dv.setUint8(off + 2, lv);
    off += 3;
  }
  return base64urlEncode(buf);
}

// Devuelve el build validado contra los datos (job existente, skills editables
// del árbol, nivel acotado a su máximo) o null si el código es inválido.
export function decodeBuild(code: string): { jobId: number; levels: Levels } | null {
  try {
    const buf = base64urlDecode(code);
    if (buf.length < 3 || buf[0] !== BUILD_VERSION || (buf.length - 3) % 3 !== 0) return null;
    const dv = new DataView(buf.buffer);
    const jobId = dv.getUint16(1);
    if (!getJob(jobId)) return null;
    const ctx = buildCtx(jobId);
    const editable = new Set(ctx.editableIds);
    const levels: Levels = {};
    for (let off = 3; off < buf.length; off += 3) {
      const id = dv.getUint16(off);
      const lv = dv.getUint8(off + 2);
      const skill = getSkill(id);
      if (skill && editable.has(id) && lv > 0) levels[id] = Math.min(lv, skill.max);
    }
    return { jobId, levels };
  } catch {
    return null;
  }
}

// Cierre transitivo de prerequisitos: la skill dada + todos sus prereqs en
// cadena (para resaltarlos al hover). Incluye la propia skill.
export function prereqClosure(id: number, ctx: PlannerCtx): Set<number> {
  const set = new Set<number>();
  const stack = [id];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (set.has(cur)) continue;
    set.add(cur);
    for (const p of prereqsOf(cur, ctx)) stack.push(p.id);
  }
  return set;
}

// Puntos ADICIONALES que necesita cada skill de la cadena para poder APRENDER
// `id` (nivel 1), teniendo en cuenta lo ya subido: para cada skill, su nivel
// requerido en la cadena (la propia a 1, prereqs a su nivel; máximo si varias
// rutas lo piden) MENOS su nivel actual. Se descartan las ya cubiertas (0). El
// total (suma) es el coste real restante. Para los badges de "coste" al hover.
export function learnCost(id: number, ctx: PlannerCtx, levels: Levels): Map<number, number> {
  const level = new Map<number, number>();
  function visit(sid: number, lv: number) {
    const cur = level.get(sid) ?? 0;
    if (lv <= cur && cur > 0) return;
    level.set(sid, Math.max(cur, lv));
    for (const p of prereqsOf(sid, ctx)) visit(p.id, p.lv);
  }
  visit(id, 1);

  const cost = new Map<number, number>();
  for (const [sid, lv] of level) {
    const add = lv - effLevel(sid, levels);
    if (add > 0) cost.set(sid, add);
  }
  return cost;
}

// --- Pools ---
// Skills de 1st gastan primero del pool 1st (P1) y, si se agota, del 2nd (P2).
// Skills de 2nd gastan solo del 2nd. Un build de 2nd job = 49 atados a 1st + 69
// flexibles; las skills de 2nd nunca pasan de 69.
export function poolUsage(levels: Levels, ctx: PlannerCtx) {
  let s1 = 0;
  let s2 = 0;
  for (const id of ctx.editableIds) {
    const lv = levels[id] ?? 0;
    if (lv <= 0) continue;
    if (ctx.bySkill.get(id)!.tier === "first") s1 += lv;
    else s2 += lv;
  }
  const pool1stUsed = Math.min(s1, ctx.P1);
  const overflow = Math.max(0, s1 - ctx.P1);
  const pool2ndUsed = s2 + overflow;
  return { s1, s2, pool1stUsed, pool2ndUsed };
}

export function isValid(levels: Levels, ctx: PlannerCtx): boolean {
  const u = poolUsage(levels, ctx);
  return u.pool1stUsed <= ctx.P1 && u.pool2ndUsed <= ctx.P2;
}

// Sube (recursivo) `id` y sus prereqs hasta cumplir los mínimos. No valida pools
// (lo hace setLevel al final).
function ensure(levels: Levels, id: number, lv: number, ctx: PlannerCtx): void {
  const s = getSkill(id);
  if (!s || s.pre) return; // pre siempre satisfecha
  const want = Math.min(lv, s.max);
  if ((levels[id] ?? 0) >= want) return;
  for (const p of prereqsOf(id, ctx)) ensure(levels, p.id, p.lv, ctx);
  levels[id] = want;
}

// Al bajar `loweredId`, resetea a 0 las skills que dependían de él por encima de
// su nuevo nivel (en cascada).
function cascadeReset(levels: Levels, loweredId: number, ctx: PlannerCtx): void {
  for (const did of ctx.editableIds) {
    if ((levels[did] ?? 0) <= 0) continue;
    const dep = prereqsOf(did, ctx).find((p) => p.id === loweredId);
    if (dep && effLevel(loweredId, levels) < dep.lv) {
      levels[did] = 0;
      cascadeReset(levels, did, ctx);
    }
  }
}

// Fija el nivel de una skill. Al subir, arrastra prereqs (y valida pools: si no
// cabe, devuelve null). Al bajar, resetea dependientes. Devuelve el nuevo mapa
// (o null si la subida no cabe en los puntos).
export function setLevel(levels: Levels, id: number, target: number, ctx: PlannerCtx): Levels | null {
  const s = getSkill(id);
  if (!s || s.pre) return null;
  const clamped = Math.max(0, Math.min(target, s.max));
  const cur = levels[id] ?? 0;
  if (clamped === cur) return levels;

  const next: Levels = { ...levels };
  if (clamped > cur) {
    ensure(next, id, clamped, ctx);
    if (!isValid(next, ctx)) return null;
    return next;
  }
  next[id] = clamped;
  cascadeReset(next, id, ctx);
  return next;
}
