// Genera el bundle del skill planner (src/data/skill-planner.json) a partir de
// los JSON extraídos del cliente (skills.json + skilltree.json). Recorta a lo
// que el planner necesita y se empaqueta con la app (se carga en /db/skills).
//
// Uso: node scripts/prepare-skills.mjs [ruta/output]
import fs from "node:fs";

const SRC = process.argv[2] ?? "E:/Proyectos/Git/ROZDataBaseExtractor/server/output";
const SKILLS = JSON.parse(fs.readFileSync(`${SRC}/skills.json`, "utf8"));
const TREES = JSON.parse(fs.readFileSync(`${SRC}/skilltree.json`, "utf8"));

const skillById = new Map(SKILLS.map((s) => [s.id, s]));

const NOVICE_JOB = 0;
const noviceTree = TREES.find((t) => t.jobId === NOVICE_JOB);
const noviceCells = noviceTree.skills.map((s) => ({ pos: s.position, id: s.skillId }));
const noviceIds = new Set(noviceCells.map((c) => c.id));

// Jobs plannables (excluye novice —se integra— y los _H, que ya vienen
// plannable:false).
const jobs = TREES.filter((t) => t.plannable && t.jobId !== NOVICE_JOB).map((t) => ({
  id: t.jobId,
  name: t.jobName,
  parentId: t.parentJobId,
  tier: t.tier, // "first" | "second"
  points: t.skillPoints,
  cells: t.skills.map((s) => ({ pos: s.position, id: s.skillId })),
}));

// Skills usadas (en cualquier árbol plannable + novice).
const usedIds = new Set(noviceIds);
jobs.forEach((j) => j.cells.forEach((c) => usedIds.add(c.id)));

// Stats de combate/coste (dbStats del cliente), recortadas y normalizadas para
// el DETALLE de la skill (no el tooltip). Campos ausentes se omiten; los
// por-nivel se guardan como array (o escalar si no varían). Los tiempos van en
// ms (el detalle los pasa a segundos).
function normHits(hc) {
  if (typeof hc === "number") return hc > 1 ? hc : undefined; // 1 golpe no aporta
  if (Array.isArray(hc)) {
    const arr = hc.map((x) => x.Count);
    return arr.some((n) => n > 1) ? arr : undefined;
  }
  return undefined;
}
function buildStats(s) {
  const d = s.dbStats;
  if (!d) return undefined;
  const st = {};
  if (d.skillType) st.type = d.skillType; // Magic | Weapon | Misc
  if (d.element && d.element !== "Weapon") st.element = d.element; // "Weapon" = elemento del arma
  if (d.targetType) st.target = d.targetType; // Attack | Self | Ground | Support | Trap
  if (typeof d.range === "number" && d.range > 0) st.range = d.range;
  if (d.splashArea != null && !(Array.isArray(d.splashArea) && !d.splashArea.length)) st.splash = d.splashArea;
  const hits = normHits(d.hitCount);
  if (hits) st.hits = hits;
  if (d.castTime != null && !(Array.isArray(d.castTime) && !d.castTime.length)) st.castVar = d.castTime;
  if (typeof d.fixedCastTime === "number" && d.fixedCastTime > 0) st.castFixed = d.fixedCastTime;
  if (typeof d.afterCastActDelay === "number" && d.afterCastActDelay > 0) st.afterCast = d.afterCastActDelay;
  if (typeof d.cooldown === "number" && d.cooldown > 0) st.cooldown = d.cooldown;
  const r = d.requires || {};
  const cost = {};
  if (r.hpCost != null) cost.hp = r.hpCost;
  if (r.zenyCost != null) cost.zeny = r.zenyCost;
  if (typeof r.spiritSphere === "number" && r.spiritSphere > 0) cost.spirit = r.spiritSphere;
  if (r.ammo && typeof r.ammo === "object" && Object.keys(r.ammo).length) cost.ammo = true;
  if (r.weapon && typeof r.weapon === "object") {
    const w = Object.keys(r.weapon);
    // Un conjunto pequeño = requisito real (p. ej. {Bow}); la lista casi completa
    // significa "cualquier arma" → no se muestra.
    if (w.length > 0 && w.length < 8) cost.weapon = w;
  }
  if (typeof r.state === "string") cost.state = r.state;
  if (r.status && typeof r.status === "object" && Object.keys(r.status).length) cost.status = Object.keys(r.status);
  if (Array.isArray(r.itemCost) && r.itemCost.length) {
    cost.items = r.itemCost.map((x) => ({ name: String(x.Item).replace(/_/g, " "), amount: x.Amount }));
  }
  if (Object.keys(cost).length) st.cost = cost;
  return Object.keys(st).length ? st : undefined;
}

const skills = {};
for (const id of usedIds) {
  const s = skillById.get(id);
  if (!s) {
    console.warn("skill sin datos:", id);
    continue;
  }
  // Prereqs POR JOB (prerequisites). Fallback plano (requiredSkills) para las
  // que no traen versión por job.
  const req = {};
  for (const p of s.prerequisites ?? []) {
    // Algunos prereqs vienen con jobId null (Super_Baby, no plannable): se
    // ignoran para no meter una clave "null" basura en el bundle.
    if (p.jobId == null) continue;
    req[p.jobId] = p.skills.map((x) => ({ id: x.skillId, lv: x.level }));
  }
  const reqDefault = (s.requiredSkills ?? []).map((x) => ({ id: x.skillId, lv: x.level }));

  // Consumo de SP por nivel (spCost del cliente). Solo se guarda si hay algún
  // coste > 0 (las pasivas y las que no gastan SP se omiten). Se muestra en el
  // detalle de la skill (SkillModal), no en el tooltip de hover.
  const sp = Array.isArray(s.spCost) && s.spCost.some((n) => n > 0) ? s.spCost : undefined;
  const stats = buildStats(s);

  skills[id] = {
    name: s.name,
    max: s.maxLevel || 1,
    type: s.type || "",
    // pre = ya aprendida, gratis y bloqueada: quest skills (platinum) + las 3 de
    // novice, que aparecen integradas en los 1st jobs.
    pre: !!s.questSkill || noviceIds.has(id),
    desc: Array.isArray(s.description) ? s.description : [],
    req,
    reqDefault,
    ...(sp ? { sp } : {}),
    ...(stats ? { stats } : {}),
  };
}

const out = { jobs, noviceCells, skills };
const path = "src/data/skill-planner.json";
fs.writeFileSync(path, JSON.stringify(out));
const bytes = fs.statSync(path).size;
console.log(
  `Bundle: ${jobs.length} jobs, ${Object.keys(skills).length} skills → ${path} (${(bytes / 1024).toFixed(0)} KB)`,
);
