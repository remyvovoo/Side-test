import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, role: user.role, locale: user.locale };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as { role: "SELLER" | "ADMIN"; locale: "fr" | "en" };
        token.role = u.role;
        token.locale = u.locale;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as { sub?: string; role?: "SELLER" | "ADMIN"; locale?: "fr" | "en" };
      session.user.id = t.sub!;
      session.user.role = t.role ?? "SELLER";
      session.user.locale = t.locale ?? "fr";
      return session;
    },
  },
});
