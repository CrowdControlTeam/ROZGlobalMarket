import { describe, it, expect } from "vitest";
import { isDiscordWebhookUrl } from "@/lib/discord-webhook-constants";

describe("isDiscordWebhookUrl", () => {
  it("acepta webhooks de Discord válidos", () => {
    expect(isDiscordWebhookUrl("https://discord.com/api/webhooks/123456789012345678/abcDEF-_tok")).toBe(true);
    expect(isDiscordWebhookUrl("https://discordapp.com/api/webhooks/123/tok")).toBe(true);
    expect(isDiscordWebhookUrl("https://canary.discord.com/api/v10/webhooks/123/tok")).toBe(true);
    expect(isDiscordWebhookUrl("https://ptb.discord.com/api/webhooks/123/tok")).toBe(true);
  });

  it("rechaza http, otros hosts y el ataque de subdominio", () => {
    expect(isDiscordWebhookUrl("http://discord.com/api/webhooks/123/tok")).toBe(false);
    expect(isDiscordWebhookUrl("https://evil.com/api/webhooks/123/tok")).toBe(false);
    // Host que solo empieza por "discord.com" pero es otro dominio (SSRF).
    expect(isDiscordWebhookUrl("https://discord.com.evil.com/api/webhooks/123/tok")).toBe(false);
    expect(isDiscordWebhookUrl("https://internal-service:8080/")).toBe(false);
  });

  it("rechaza rutas de webhook malformadas", () => {
    expect(isDiscordWebhookUrl("https://discord.com/api/webhooks/")).toBe(false);
    expect(isDiscordWebhookUrl("https://discord.com/api/webhooks/123")).toBe(false);
    expect(isDiscordWebhookUrl("https://discord.com/")).toBe(false);
  });
});
