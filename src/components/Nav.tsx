"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Kader" },
  { href: "/markt", label: "Transfermarkt" },
  { href: "/liga", label: "Tabelle" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function abmelden() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-pitch-700 bg-pitch-900/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-neon" aria-hidden />
          <span className="text-sm font-bold tracking-tight">Kaderzentrale</span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-data-sm font-medium transition-colors ${
                  active
                    ? "bg-neon/15 text-neon"
                    : "text-chalk-muted hover:bg-pitch-800 hover:text-chalk"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={abmelden}
          className="ml-auto rounded-md px-3 py-1.5 text-data-sm text-chalk-faint transition-colors hover:bg-pitch-800 hover:text-chalk"
        >
          Abmelden
        </button>
      </div>
    </header>
  );
}
