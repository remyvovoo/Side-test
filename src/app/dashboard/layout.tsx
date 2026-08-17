import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, role: true, createdAt: true },
  });
  if (!user) redirect("/login");

  const TRIAL_DAYS = 30;
  const elapsed = Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000);
  const trialDaysLeft = Math.max(0, TRIAL_DAYS - elapsed);

  return (
    <DashboardShell email={user.email} isAdmin={user.role === "ADMIN"} trialDaysLeft={trialDaysLeft}>
      {children}
    </DashboardShell>
  );
}
