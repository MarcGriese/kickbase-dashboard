"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
        <div className="mb-1 flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-neon" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">Kaderzentrale</h1>
        </div>
        <p className="mb-8 pl-3 text-data-sm text-chalk-muted">
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
              className="w-full rounded-lg border border-pitch-600 bg-pitch-900 px-3 py-2.5 text-data-sm placeholder:text-chalk-faint focus:border-neon"
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
              className="w-full rounded-lg border border-pitch-600 bg-pitch-900 px-3 py-2.5 text-data-sm placeholder:text-chalk-faint focus:border-neon"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label htmlFor="league" className="label mb-1.5 block">
              Liga <span className="normal-case text-chalk-faint">(optional)</span>
            </label>
            <input
              id="league"
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && anmelden()}
              className="w-full rounded-lg border border-pitch-600 bg-pitch-900 px-3 py-2.5 text-data-sm placeholder:text-chalk-faint focus:border-neon"
              placeholder="Namensteil – sonst wird die erste Liga genommen"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2.5 text-data-sm text-loss"
            >
              {error}
            </p>
          )}

          <button
            onClick={anmelden}
            disabled={busy || !email || !password}
            className="w-full rounded-lg bg-neon py-2.5 text-sm font-bold text-pitch-950 transition-colors hover:bg-neon-dim disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Melde an …" : "Anmelden"}
          </button>
        </div>

        <p className="mt-5 text-data-xs leading-relaxed text-chalk-faint">
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
