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
      {/* Auf schmalen Schirmen bricht die Linkleiste in eine zweite Zeile -
          in einer Reihe passen Wortmarke, drei Links und Abmelden nicht. */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/dashboard" aria-label="Zur Übersicht" className="order-1">
          <Wordmark />
        </Link>

        <nav className="order-3 flex w-full items-center gap-1 sm:order-2 sm:w-auto">
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
          className="order-2 ml-auto rounded-md px-3 py-1.5 text-data-sm text-snow-faint transition-colors hover:bg-night-800 hover:text-snow sm:order-3"
        >
          Abmelden
        </button>
      </div>
    </header>
  );
}
