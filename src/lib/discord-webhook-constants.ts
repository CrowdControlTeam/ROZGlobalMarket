// Validación del host de la URL de webhook, separada de admin-config.ts (que
// es "use server") para poder testearla como función pura. La URL la usa el
// servidor para hacer POST (ver src/lib/discord-webhook.ts): sin restringir
// el host, un admin podría apuntarla a cualquier URL interna y usar el
// servidor como proxy (SSRF). Se aceptan los hosts canónicos de webhook de
// Discord (discord.com / discordapp.com, con subdominios ptb/canary) y la
// ruta /api[/vN]/webhooks/<id>/<token>.
export const DISCORD_WEBHOOK_RE =
  /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/\d+\/[\w-]+$/;

export function isDiscordWebhookUrl(url: string): boolean {
  return DISCORD_WEBHOOK_RE.test(url);
}
