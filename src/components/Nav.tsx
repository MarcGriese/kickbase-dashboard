"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Wordmark } from "./ui";

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
    <header className="sticky top-0 z-20 border-b border-night-700 bg-night-900/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/dashboard" aria-label="Zur Übersicht">
          <Wordmark />
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-data-sm font-bold uppercase tracking-wider transition-colors ${
                  active
                    ? "bg-kb/15 text-kb"
                    : "text-snow-muted hover:bg-night-800 hover:text-snow"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={abmelden}
          className="ml-auto rounded-md px-3 py-1.5 text-data-sm text-snow-faint transition-colors hover:bg-night-800 hover:text-snow"
        >
          Abmelden
        </button>
      </div>
    </header>
  );
}
