import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "SELLER" | "ADMIN";
      locale: "fr" | "en";
    } & DefaultSession["user"];
  }
  interface User {
    role: "SELLER" | "ADMIN";
    locale: "fr" | "en";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "SELLER" | "ADMIN";
    locale?: "fr" | "en";
  }
}
