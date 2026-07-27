import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      discordId: string;
      username: string;
      avatarUrl: string | null;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordId?: string;
    username?: string;
    avatarUrl?: string | null;
    isAdmin?: boolean;
  }
}
