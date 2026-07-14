import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocaleServer } from "@/lib/i18n/get-locale-server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const locale = await getLocaleServer();
  const dict = getDictionary(locale);
  const t = dict.admin;

  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="admin-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="screen-title">{t.title}</div>
          <div className="screen-sub">{t.subtitle}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <SignOutButton label={dict.common.logout} />
          <LanguageSwitcher />
        </div>
      </div>

      {users.length === 0 ? (
        <div className="admin-empty">{t.empty}</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t.email}</th>
                <th>{t.role}</th>
                <th>{t.createdAt}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    <span className="admin-role">{u.role}</span>
                  </td>
                  <td>{u.createdAt.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
