"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import clsx from "clsx";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  if (!session) return null;

  const isAdmin = session.user.role === "ADMIN";

  const links = [
    { href: "/board", label: "Nástěnka" },
    { href: "/dashboard", label: "Přehled" },
    ...(isAdmin ? [{ href: "/users", label: "Uživatelé" }] : []),
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/board" className="font-bold text-lg text-brand-700">
            Koncept CRM
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "px-3 py-1.5 rounded-md text-sm font-medium",
                  pathname?.startsWith(l.href)
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-600 hidden sm:block">
            {session.user.name}{" "}
            <span className="text-xs text-slate-400">
              ({isAdmin ? "Admin" : "Uživatel"})
            </span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="btn-ghost"
          >
            Odhlásit
          </button>
        </div>
      </div>
      {/* mobile nav */}
      <nav className="sm:hidden flex gap-1 px-4 pb-2 overflow-x-auto">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={clsx(
              "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap",
              pathname?.startsWith(l.href)
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
