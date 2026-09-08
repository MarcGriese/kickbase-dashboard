"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/ui";

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
        <div className="mb-1 flex items-center gap-2.5">
          <BrandMark size={26} />
          <h1 className="display text-2xl">Kaderzentrale</h1>
        </div>
        <p className="mb-8 pl-9 text-data-sm text-snow-muted">
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
              Liga <span className="normal-case text-snow-faint">(optional)</span>
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
              className="rounded-lg border border-down/30 bg-down/10 px-3 py-2.5 text-data-sm text-down"
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

        <p className="mt-5 text-data-xs leading-relaxed text-snow-faint">
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
