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
export type Skill = {
  name: string;
  max: number;
  type: string;
  pre: boolean; // ya aprendida, gratis y bloqueada (platinum/novice)
  desc: string[];
  req: Record<string, SkillReq[]>; // prereqs por jobId
  reqDefault: SkillReq[]; // fallback plano (requiredSkills)
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
