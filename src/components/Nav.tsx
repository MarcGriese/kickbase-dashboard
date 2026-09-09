"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandLogo } from "./BrandLogo";

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
    <header className="sticky top-0 z-20 border-b border-kb-line bg-kb-black/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        {/* Guideline Placement: "The logomark should always be left-aligned." */}
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <BrandLogo variant="mark" height={20} />
          <span className="kb-headline text-[0.9375rem] tracking-tight">
            Kaderzentrale
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-data-sm font-semibold uppercase tracking-wide transition-colors ${
                  active
                    ? "bg-kb-white text-kb-black"
                    : "text-kb-grey hover:bg-kb-raised hover:text-kb-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={abmelden}
          className="ml-auto rounded-md px-3 py-1.5 text-data-sm text-kb-grey transition-colors hover:bg-kb-raised hover:text-kb-white"
        >
          Abmelden
        </button>
      </div>
    </header>
  );
}
