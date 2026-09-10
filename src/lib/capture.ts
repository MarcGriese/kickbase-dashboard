/**
 * Holt den aktuellen Stand bei Kickbase und legt ihn als Schnappschuss ab.
 *
 * Wird von zwei Stellen benutzt: vom naechtlichen Cron-Aufruf auf
 * /api/snapshot und vom Start-Hook in instrumentation.ts. Beide teilen sich
 * denselben Code, damit der gespeicherte Stand immer gleich aussieht.
 */

import "server-only";
import { getSquad, getMarket, getBudget, getRanking, getLeagues, login } from "./kickbase";
import { parseRanking } from "./league";
import {
  berlinDay,
  hasSnapshotForDay,
  toSnapshotPlayer,
  writeSnapshot,
  type ManagerStanding,
  type SnapshotPlayer,
  type SnapshotSource,
} from "./snapshot";

export interface CaptureResult {
  ok: true;
  leagueId: string;
  day: string;
  players: number;
  owned: number;
  teamValue: number;
  budget: number | null;
  skipped?: "already-taken";
}

/**
 * Ein Schnappschuss fuer eine Liga.
 * `force` ueberschreibt einen Stand, der heute schon geschrieben wurde.
 */
export async function captureSnapshot(
  token: string,
  leagueId: string,
  source: SnapshotSource,
  opts: { force?: boolean } = {}
): Promise<CaptureResult> {
  const day = berlinDay();

  if (!opts.force && hasSnapshotForDay(leagueId, day)) {
    return {
      ok: true,
      leagueId,
      day,
      players: 0,
      owned: 0,
      teamValue: 0,
      budget: null,
      skipped: "already-taken",
    };
  }

  // Der Markt darf fehlschlagen, ohne den Kader mitzureissen - er ist nachts
  // regelmaessig leer, und der Kader ist der Teil, auf den es ankommt.
  // Die Rangliste ist optional: fehlt sie, bleibt nur die Formkurve leer.
  const [squadRaw, marketRaw, budget, rankingRaw] = await Promise.all([
    getSquad(token, leagueId),
    getMarket(token, leagueId).catch(() => [] as Record<string, any>[]),
    getBudget(token, leagueId),
    getRanking(token, leagueId).catch(() => ({}) as Record<string, any>),
  ]);

  const managers: ManagerStanding[] = parseRanking(rankingRaw)
    .filter((m) => m.id)
    .map((m) => ({
      managerId: m.id,
      name: m.name,
      points: m.points,
      matchdayPoints: m.matchdayPoints,
      teamValue: m.teamValue,
      isMe: m.isMe,
    }));

  const byId = new Map<string, SnapshotPlayer>();
  // Markt zuerst, Kader danach: eigene Spieler gewinnen bei Doppeltreffern.
  for (const raw of marketRaw) {
    const p = toSnapshotPlayer(raw, false);
    if (p) byId.set(p.playerId, p);
  }
  for (const raw of squadRaw) {
    const p = toSnapshotPlayer(raw, true);
    if (p) byId.set(p.playerId, p);
  }

  // Array.from statt Spread: tsconfig zielt auf ES5, wo Map-Iteratoren
  // nicht gespreadet werden koennen.
  const players = Array.from(byId.values());
  const owned = players.filter((p) => p.owned);
  const teamValue = owned.reduce((s, p) => s + p.marketValue, 0);

  const written = writeSnapshot({
    leagueId,
    source,
    players,
    team: { teamValue, budget, squadSize: owned.length },
    managers,
  });

  return {
    ok: true,
    leagueId,
    day: written.day,
    players: written.players,
    owned: owned.length,
    teamValue,
    budget,
  };
}

/**
 * Anmeldung ueber KB_EMAIL / KB_PASSWORD aus der Umgebung.
 *
 * Der naechtliche Cron-Job laeuft ohne Browser und damit ohne Session-Cookie.
 * Ohne hinterlegte Zugangsdaten kann er sich nicht anmelden - das ist kein
 * Fehler, sondern eine bewusste Entscheidung des Nutzers, und der Aufrufer
 * bekommt hier `null` statt einer Ausnahme.
 */
export async function loginFromEnv(): Promise<{
  token: string;
  leagueId: string;
} | null> {
  const email = process.env.KB_EMAIL;
  const password = process.env.KB_PASSWORD;
  if (!email || !password) return null;

  const { token } = await login(email, password);

  const wanted = process.env.KB_LEAGUE_ID;
  if (wanted) return { token, leagueId: wanted };

  const leagues = await getLeagues(token);
  const first = leagues[0];
  const leagueId = String(first?.i ?? first?.id ?? "");
  if (!leagueId) return null;

  return { token, leagueId };
}
