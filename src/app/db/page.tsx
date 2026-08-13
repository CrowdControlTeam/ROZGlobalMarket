import { redirect } from "next/navigation";

// /db no tiene vista propia: el pilar del header apunta aquí y redirige a la
// primera pestaña (Items).
export default function DbIndexPage() {
  redirect("/db/items");
}
