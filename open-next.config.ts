import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Configuración de OpenNext para Cloudflare Workers. Por ahora la de por
// defecto (sin caché incremental externo): la app es dinámica y con sesión,
// así que no depende de ISR. Si más adelante se quiere caché de páginas se
// añadiría aquí un incrementalCache (KV/R2). Ver
// https://opennext.js.org/cloudflare
export default defineCloudflareConfig();
