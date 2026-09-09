"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [league, setLeague] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function anmelden() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, league: league || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Anmeldung fehlgeschlagen.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Der Server ist nicht erreichbar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <div className="animate-fade-up">
        {/*
          Die Lockup-Variante wird laut Guidelines am haeufigsten benutzt.
          Der grosszuegige Abstand darunter ist die geforderte Schutzzone.
        */}
        <BrandLogo variant="lockup" height={22} className="mb-7" />

        <h1 className="display text-2xl">Kaderzentrale</h1>
        <p className="mb-8 mt-3 max-w-sm text-body text-kb-grey-light">
          Deine Kickbase-Liga, auf Tagesentscheidungen heruntergebrochen.
        </p>

        <div className="card space-y-4 p-6">
          <div>
            <label htmlFor="email" className="label mb-1.5 block">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && anmelden()}
              className="field"
              placeholder="du@beispiel.de"
            />
          </div>

          <div>
            <label htmlFor="password" className="label mb-1.5 block">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && anmelden()}
              className="field"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label htmlFor="league" className="label mb-1.5 block">
              Liga <span className="normal-case text-kb-grey">(optional)</span>
            </label>
            <input
              id="league"
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && anmelden()}
              className="field"
              placeholder="Namensteil – sonst wird die erste Liga genommen"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border-l-2 border-kb-red bg-kb-raised px-3 py-2.5 text-body text-kb-white"
            >
              {error}
            </p>
          )}

          <button
            onClick={anmelden}
            disabled={busy || !email || !password}
            className="btn-primary w-full"
          >
            {busy ? "Melde an …" : "Anmelden"}
          </button>
        </div>

        <p className="mt-5 text-data-xs leading-relaxed text-kb-grey">
          Die Zugangsdaten gehen direkt an Kickbase und werden nicht gespeichert.
          Der Token bleibt in einem httpOnly-Cookie auf deinem Rechner. Wenn du
          dich in der App mit Apple oder Facebook anmeldest, setz zuerst unter
          Einstellungen → Profil ein eigenes Passwort – anders akzeptiert die API
          den Login nicht.
        </p>
      </div>
    </main>
  );
}
