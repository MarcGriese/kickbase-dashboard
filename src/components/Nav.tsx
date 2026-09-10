"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Wordmark } from "./ui";

const LINKS = [
  { href: "/dashboard", label: "Kader" },
  { href: "/aufstellung", label: "Aufstellung" },
  { href: "/bundesliga", label: "Bundesliga" },
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
    <header className="sticky top-0 z-20 border-b border-kb-line bg-kb-black/90 backdrop-blur">
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
                    ? "bg-kb-white text-kb-black"
                    : "text-kb-grey-light hover:bg-kb-raised hover:text-kb-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={abmelden}
          className="order-2 ml-auto rounded-md px-3 py-1.5 text-data-sm text-kb-grey transition-colors hover:bg-kb-raised hover:text-kb-white sm:order-3"
        >
          Abmelden
        </button>
      </div>
    </header>
  );
}
