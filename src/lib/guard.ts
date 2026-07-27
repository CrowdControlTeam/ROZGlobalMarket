import { redirect } from "next/navigation";
import { auth } from "@/auth";

// La pertenencia al guild ya se verificó al hacer login (ver src/auth.ts).
// Aquí solo confirmamos que hay una sesión válida y no caducada.
export async function requireSession() {
  const session = await auth();
  if (!session?.user) redirect("/");
  return session;
}
