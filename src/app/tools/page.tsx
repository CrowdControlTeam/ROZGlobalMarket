import { redirect } from "next/navigation";

// /tools no tiene vista propia: redirige a la primera herramienta (como /db).
export default function ToolsIndexPage() {
  redirect("/tools/vct");
}
