import { decodeBuild } from "@/lib/skill-planner";
import { SkillPlanner } from "./SkillPlanner";

function firstValue(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

// Skill planner (Fase 2/3): simula la ventana de skills del juego. Si llega un
// build compartido en ?build=<código>, se decodifica aquí (server) y se pasa
// como estado inicial. requireSession lo aplica el layout de /db.
export default async function DbSkillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const code = firstValue((await searchParams).build);
  const initial = code ? decodeBuild(code) : null;
  return <SkillPlanner initialJobId={initial?.jobId ?? null} initialLevels={initial?.levels ?? {}} />;
}
