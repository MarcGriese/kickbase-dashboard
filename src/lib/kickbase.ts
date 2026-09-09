/**
 * Server-seitiger Client fuer die (inoffizielle) Kickbase-API v4.
 *
 * Laeuft ausschliesslich auf dem Server: der Token verlaesst nie den Node-Prozess
 * ausser als httpOnly-Cookie. Damit umgehen wir auch CORS - der Browser spricht
 * nur mit deinem eigenen Next.js-Server, nie direkt mit api.kickbase.com.
 *
 * Grundregel fuer alles ausser Login/Kader: Wenn ein Zusatzendpunkt sich
 * anders verhaelt als erwartet, faellt die Funktion auf null zurueck und die
 * Oberflaeche zeigt den Abschnitt einfach nicht. Eine fehlende Spielpaarung
 * darf nie das Dashboard zerlegen.
 */

import "server-only";

export const BASE_URL = "https://api.kickbase.com";

/** Bundesliga. Andere Wettbewerbe hat die App bewusst nicht im Blick. */
export const COMPETITION_ID = "1";

export class KickbaseError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "KickbaseError";
  }
}

type Json = Record<string, any>;

async function request<T = Json>(
  path: string,
  token: string | null,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
    // Kickbase-Daten aendern sich minuetlich - niemals cachen.
    cache: "no-store",
  });

  if (res.status === 401) {
    throw new KickbaseError("Sitzung abgelaufen. Bitte neu anmelden.", 401);
  }
  if (!res.ok) {
    throw new KickbaseError(
      `Kickbase antwortete mit ${res.status} auf ${path}`,
      res.status
    );
  }
  return (await res.json()) as T;
}

/** Probiert mehrere Pfade durch und nimmt den ersten, der Daten liefert. */
async function firstOf<T = Json>(
  paths: string[],
  token: string,
  ok: (d: Json) => T | null
): Promise<T | null> {
  for (const path of paths) {
    try {
      const d = await request<Json>(path, token);
      const v = ok(d);
      if (v !== null) return v;
    } catch (err) {
      if (err instanceof KickbaseError && err.status === 401) throw err;
      // sonst: naechsten Pfad probieren
    }
  }
  return null;
}

/** Meldet dich an und gibt Token + Rohdaten zurueck. */
export async function login(email: string, password: string) {
  const res = await fetch(BASE_URL + "/v4/user/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ em: email, pass: password }),
    cache: "no-store",
  });

  if (res.status === 401) {
    throw new KickbaseError(
      "E-Mail oder Passwort stimmt nicht. Hinweis: Wenn du dich in der App mit Apple oder Facebook anmeldest, musst du zuerst unter Einstellungen → Profil ein eigenes Passwort setzen.",
      401
    );
  }
  if (!res.ok) {
    throw new KickbaseError(`Anmeldung fehlgeschlagen (${res.status}).`, res.status);
  }

  const data: Json = await res.json();
  // Je nach API-Stand liegt der Token unter unterschiedlichen Keys.
  const token: string | undefined = data.tkn ?? data.token ?? data.accessToken;
  if (!token) {
    throw new KickbaseError(
      "Kickbase hat keinen Token zurueckgegeben. Die API hat sich vermutlich geaendert.",
      500
    );
  }
  return { token, raw: data };
}

/**
 * ID des angemeldeten Nutzers. Die Rangliste markiert das eigene Konto nicht
 * (kein "me"-Feld in der Antwort), deshalb holen wir die ID separat und
 * gleichen sie gegen die `i` der Ranglisteneintraege ab.
 */
export async function getMyId(token: string): Promise<string | null> {
  return firstOf<string>(
    ["/v4/user/settings", "/v4/user/me"],
    token,
    (d) => {
      const id = d?.u?.i ?? d?.u?.id ?? d?.i ?? d?.id ?? null;
      return id === null || id === undefined || id === "" ? null : String(id);
    }
  );
}

/** Alle Ligen, in denen du Manager bist. */
export async function getLeagues(token: string) {
  const items = await firstOf<Json[]>(
    ["/v4/leagues/selection", "/v4/leagues", "/v4/leagues/list"],
    token,
    (d) => {
      const it = d.it ?? d.leagues ?? d.srvl ?? [];
      return Array.isArray(it) && it.length ? (it as Json[]) : null;
    }
  );
  return items ?? [];
}

export async function getSquad(token: string, leagueId: string) {
  const d = await request<Json>(`/v4/leagues/${leagueId}/squad`, token);
  return (d.it ?? []) as Json[];
}

export async function getMarket(token: string, leagueId: string) {
  const d = await request<Json>(`/v4/leagues/${leagueId}/market`, token);
  return (d.it ?? []) as Json[];
}

/**
 * Rangliste der Liga. Ohne `dayNumber` die Gesamtwertung; die Antwort traegt
 * pro Manager auch `mdp`, die Punkte des zuletzt gewerteten Spieltags.
 */
export async function getRanking(
  token: string,
  leagueId: string,
  dayNumber?: number
) {
  const q = dayNumber === undefined ? "" : `?dayNumber=${dayNumber}`;
  return request<Json>(`/v4/leagues/${leagueId}/ranking${q}`, token);
}

/**
 * Manager-Dashboard eines Mitspielers: Teamwert (`tv`), Transfergewinn
 * (`prft`), Punkte (`tp`). Grundlage der Budget-Herleitung in league.ts.
 */
export async function getManagerDashboard(
  token: string,
  leagueId: string,
  userId: string
): Promise<Json | null> {
  try {
    return await request<Json>(
      `/v4/leagues/${leagueId}/managers/${userId}/dashboard`,
      token
    );
  } catch (err) {
    if (err instanceof KickbaseError && err.status === 401) throw err;
    return null;
  }
}

/**
 * Kader eines Mitspielers. Enthaelt pro Spieler `mvgl` - genau die stillen
 * Reserven, die der Kontoherleitung noch fehlen.
 */
export async function getManagerSquad(
  token: string,
  leagueId: string,
  userId: string
): Promise<Json[] | null> {
  try {
    const d = await request<Json>(
      `/v4/leagues/${leagueId}/managers/${userId}/squad`,
      token
    );
    return Array.isArray(d.it) ? (d.it as Json[]) : null;
  } catch (err) {
    if (err instanceof KickbaseError && err.status === 401) throw err;
    return null;
  }
}

/**
 * Arbeitet eine Liste mit begrenzter Gleichzeitigkeit ab.
 *
 * Eine Liga mit 18 Managern ergaebe sonst 36 Anfragen auf einen Schlag -
 * das mag weder die API noch der eigene Server.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return out;
}

export async function getBudget(token: string, leagueId: string) {
  try {
    const d = await request<Json>(`/v4/leagues/${leagueId}/me/budget`, token);
    return (d.b ?? d.budget ?? d.bs ?? null) as number | null;
  } catch {
    return null;
  }
}

/**
 * Budget und Teamwert, wie Kickbase sie selbst fuehrt.
 *
 * Der Teamwert aus der API ist massgeblich - die Summe der Marktwerte aus dem
 * Kader kann davon abweichen (Kickbase rundet und rechnet Leihen anders).
 * Wenn der Endpunkt nichts hergibt, rechnet die Seite selbst.
 */
export async function getTeamOverview(
  token: string,
  leagueId: string
): Promise<{ budget: number | null; teamValue: number | null }> {
  const found = await firstOf<{ budget: number | null; teamValue: number | null }>(
    [`/v4/leagues/${leagueId}/me`, `/v4/leagues/${leagueId}/overview`],
    token,
    (d) => {
      const budget = num(d.b ?? d.budget ?? d.bs);
      const teamValue = num(d.tv ?? d.teamValue ?? d.tvs);
      if (budget === null && teamValue === null) return null;
      return { budget, teamValue };
    }
  );

  if (found && found.budget !== null) return found;

  // Budget notfalls aus dem eigenen Endpunkt nachziehen.
  const budget = await getBudget(token, leagueId);
  return { budget, teamValue: found?.teamValue ?? null };
}

export async function getFeed(token: string, leagueId: string) {
  try {
    return await request<Json>(`/v4/leagues/${leagueId}/activitiesFeed`, token);
  } catch {
    return {} as Json;
  }
}

/**
 * Spielplan der Bundesliga: alle Spieltage mit Paarungen und Anstosszeiten.
 * Basis fuer "die naechsten drei Spiele" und fuer den Prognose-Horizont.
 */
export async function getMatchdays(token: string): Promise<Json | null> {
  return firstOf<Json>(
    [
      `/v4/competitions/${COMPETITION_ID}/matchdays`,
      `/v4/competitions/${COMPETITION_ID}/matches`,
    ],
    token,
    (d) => (Array.isArray(d.it) && d.it.length ? d : null)
  );
}

/** Bundesliga-Tabelle - liefert die Staerke der kommenden Gegner. */
export async function getCompetitionTable(token: string): Promise<Json | null> {
  return firstOf<Json>(
    [
      `/v4/competitions/${COMPETITION_ID}/table`,
      `/v4/competitions/${COMPETITION_ID}/ranking`,
    ],
    token,
    (d) => (Array.isArray(d.it) && d.it.length ? d : null)
  );
}

function num(v: unknown): number | null {
  const n = Number(v);
  return v === null || v === undefined || Number.isNaN(n) ? null : n;
}
