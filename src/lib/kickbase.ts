/**
 * Server-seitiger Client fuer die (inoffizielle) Kickbase-API v4.
 *
 * Laeuft ausschliesslich auf dem Server: der Token verlaesst nie den Node-Prozess
 * ausser als httpOnly-Cookie. Damit umgehen wir auch CORS - der Browser spricht
 * nur mit deinem eigenen Next.js-Server, nie direkt mit api.kickbase.com.
 */

import "server-only";

export const BASE_URL = "https://api.kickbase.com";

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

/** Alle Ligen, in denen du Manager bist. */
export async function getLeagues(token: string) {
  for (const path of ["/v4/leagues/selection", "/v4/leagues", "/v4/leagues/list"]) {
    try {
      const d = await request<Json>(path, token);
      const items = d.it ?? d.leagues ?? d.srvl ?? [];
      if (Array.isArray(items) && items.length) return items as Json[];
    } catch (err) {
      if (err instanceof KickbaseError && err.status === 401) throw err;
      // sonst: naechsten Pfad probieren
    }
  }
  return [] as Json[];
}

export async function getSquad(token: string, leagueId: string) {
  const d = await request<Json>(`/v4/leagues/${leagueId}/squad`, token);
  return (d.it ?? []) as Json[];
}

export async function getMarket(token: string, leagueId: string) {
  const d = await request<Json>(`/v4/leagues/${leagueId}/market`, token);
  return (d.it ?? []) as Json[];
}

export async function getRanking(token: string, leagueId: string) {
  return request<Json>(`/v4/leagues/${leagueId}/ranking`, token);
}

export async function getBudget(token: string, leagueId: string) {
  try {
    const d = await request<Json>(`/v4/leagues/${leagueId}/me/budget`, token);
    return (d.b ?? d.budget ?? d.bs ?? null) as number | null;
  } catch {
    return null;
  }
}

export async function getFeed(token: string, leagueId: string) {
  try {
    return await request<Json>(`/v4/leagues/${leagueId}/activitiesFeed`, token);
  } catch {
    return {} as Json;
  }
}
