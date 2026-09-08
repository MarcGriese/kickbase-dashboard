/**
 * Minimales Session-Handling: der Kickbase-Token liegt in einem httpOnly-Cookie.
 * Kein JavaScript im Browser kommt daran, und er wird nie an den Client gesendet.
 *
 * Fuer localhost bewusst schlank gehalten. Wenn du das jemals oeffentlich
 * hostest: Token verschluesseln (SESSION_SECRET), secure-Flag setzen und eine
 * kuerzere Laufzeit waehlen.
 */

import "server-only";
import { cookies } from "next/headers";

const TOKEN_COOKIE = "kb_token";
const LEAGUE_COOKIE = "kb_league";

// Kickbase-Tokens laufen nach rund 7 Tagen ab.
const MAX_AGE = 60 * 60 * 24 * 7;

export function setSession(token: string, leagueId: string) {
  const jar = cookies();
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  };
  jar.set(TOKEN_COOKIE, token, opts);
  jar.set(LEAGUE_COOKIE, leagueId, { ...opts, httpOnly: false });
}

export function getToken(): string | null {
  return cookies().get(TOKEN_COOKIE)?.value ?? null;
}

export function getLeagueId(): string | null {
  return cookies().get(LEAGUE_COOKIE)?.value ?? null;
}

export function clearSession() {
  const jar = cookies();
  jar.delete(TOKEN_COOKIE);
  jar.delete(LEAGUE_COOKIE);
}
