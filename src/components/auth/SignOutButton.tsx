"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ label }: { label: string }) {
  return (
    <button className="btn btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: "/login" })} type="button">
      <i className="ti ti-logout" /> {label}
    </button>
  );
}
