/**
 * Schreiben und Lesen der taeglichen Schnappschuesse.
 *
 * Ein Schnappschuss pro Liga und Kalendertag. Laeuft der Job zweimal am
 * selben Tag, ersetzt der zweite Lauf den ersten - der Speicher bleibt bei
 * einer Zeile pro Tag, und genau das ist die Kurve, die du sehen willst.
 */

import "server-only";
import { getDb } from "./db";
import { pick } from "./fields";

/* --------------------------------------------------------------- Kalender */

const BERLIN = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-09-09" in deutscher Zeit - Kickbase rechnet Marktwerte nachts um. */
export function berlinDay(when: Date = new Date()): string {
  return BERLIN.format(when);
}

/** Kalendertag minus n Tage, wieder als YYYY-MM-DD. */
export function dayMinus(day: string, n: number): string {
  const t = Date.parse(`${day}T00:00:00Z`);
  return new Date(t - n * 86_400_000).toISOString().slice(0, 10);
}

/** Ganze Tage zwischen zwei Kalendertagen. */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000
  );
}

/* --------------------------------------------------------------- Schreiben */

export interface SnapshotPlayer {
  playerId: string;
  name: string;
  pos: number;
  teamId: string | null;
  marketValue: number;
  points: number;
  average: number;
  status: number;
  owned: boolean;
}

export interface SnapshotTeam {
  teamValue: number | null;
  budget: number | null;
  squadSize: number | null;
}

export interface ManagerStanding {
  managerId: string;
  name: string;
  points: number;
  matchdayPoints: number | null;
  teamValue: number | null;
  isMe: boolean;
}

export type SnapshotSource = "cron" | "startup" | "manual";

/** Rohdaten aus /squad oder /market in eine Schnappschuss-Zeile uebersetzen. */
export function toSnapshotPlayer(
  raw: Record<string, any>,
  owned: boolean
): SnapshotPlayer | null {
  const playerId = String(pick(raw, "id", "") ?? "");
  if (!playerId) return null;

  const teamId = pick<string | number | null>(raw, "teamId", null);
  return {
    playerId,
    name: String(pick(raw, "name", "Unbekannt")),
    pos: Number(pick(raw, "pos", 0)) || 0,
    teamId: teamId === null || teamId === undefined ? null : String(teamId),
    marketValue: Math.round(Number(pick(raw, "marketValue", 0)) || 0),
    points: Math.round(Number(pick(raw, "points", 0)) || 0),
    average: Number(pick(raw, "average", 0)) || 0,
    status: Number(pick(raw, "status", 0)) || 0,
    owned,
  };
}

/**
 * Legt den Schnappschuss des Tages an - oder ersetzt ihn.
 * Alles in einer Transaktion: entweder der ganze Tag steht, oder nichts.
 */
export function writeSnapshot(args: {
  leagueId: string;
  source: SnapshotSource;
  players: SnapshotPlayer[];
  team?: SnapshotTeam;
  managers?: ManagerStanding[];
  when?: Date;
}): { snapshotId: number; day: string; players: number } {
  const db = getDb();
  const day = berlinDay(args.when);
  const takenAt = (args.when ?? new Date()).toISOString();

  const run = db.transaction(() => {
    // Ein bestehender Tag wird ersetzt; ON DELETE CASCADE raeumt die Kinder ab.
    db.prepare(`DELETE FROM snapshots WHERE league_id = ? AND day = ?`).run(
      args.leagueId,
      day
    );

    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO snapshots (league_id, day, taken_at, source)
         VALUES (?, ?, ?, ?)`
      )
      .run(args.leagueId, day, takenAt, args.source);
    const snapshotId = Number(lastInsertRowid);

    const insert = db.prepare(
      `INSERT OR REPLACE INTO player_snapshots
         (snapshot_id, player_id, name, pos, team_id,
          market_value, points, average, status, owned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const p of args.players) {
      insert.run(
        snapshotId,
        p.playerId,
        p.name,
        p.pos,
        p.teamId,
        p.marketValue,
        p.points,
        p.average,
        p.status,
        p.owned ? 1 : 0
      );
    }

    if (args.team) {
      db.prepare(
        `INSERT INTO team_snapshots (snapshot_id, team_value, budget, squad_size)
         VALUES (?, ?, ?, ?)`
      ).run(
        snapshotId,
        args.team.teamValue,
        args.team.budget,
        args.team.squadSize
      );
    }

    if (args.managers && args.managers.length) {
      const insertManager = db.prepare(
        `INSERT OR REPLACE INTO manager_snapshots
           (snapshot_id, manager_id, name, points, matchday_points, team_value, is_me)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const m of args.managers) {
        insertManager.run(
          snapshotId,
          m.managerId,
          m.name,
          m.points,
          m.matchdayPoints,
          m.teamValue,
          m.isMe ? 1 : 0
        );
      }
    }

    return snapshotId;
  });

  const snapshotId = run();
  return { snapshotId, day, players: args.players.length };
}

/* ------------------------------------------------------------------ Lesen */

export interface SnapshotMeta {
  id: number;
  day: string;
  takenAt: string;
  source: SnapshotSource;
}

/** Juengster Schnappschuss am Tag `day` oder davor. */
export function snapshotOnOrBefore(
  leagueId: string,
  day: string
): SnapshotMeta | null {
  const row = getDb()
    .prepare(
      `SELECT id, day, taken_at AS takenAt, source
         FROM snapshots
        WHERE league_id = ? AND day <= ?
        ORDER BY day DESC
        LIMIT 1`
    )
    .get(leagueId, day) as SnapshotMeta | undefined;
  return row ?? null;
}

export function newestSnapshot(leagueId: string): SnapshotMeta | null {
  return snapshotOnOrBefore(leagueId, "9999-12-31");
}

export function hasSnapshotForDay(leagueId: string, day: string): boolean {
  const row = getDb()
    .prepare(`SELECT 1 FROM snapshots WHERE league_id = ? AND day = ? LIMIT 1`)
    .get(leagueId, day);
  return row !== undefined;
}

export function countSnapshots(leagueId?: string): number {
  const db = getDb();
  const row = leagueId
    ? db
        .prepare(`SELECT COUNT(*) AS n FROM snapshots WHERE league_id = ?`)
        .get(leagueId)
    : db.prepare(`SELECT COUNT(*) AS n FROM snapshots`).get();
  return Number((row as { n: number } | undefined)?.n ?? 0);
}

/** Marktwerte eines Schnappschusses, nach Spieler-ID. */
function valuesOf(snapshotId: number): Map<string, number> {
  const rows = getDb()
    .prepare(
      `SELECT player_id AS playerId, market_value AS marketValue
         FROM player_snapshots
        WHERE snapshot_id = ?`
    )
    .all(snapshotId) as { playerId: string; marketValue: number }[];

  return new Map(rows.map((r) => [r.playerId, r.marketValue]));
}

/* --------------------------------------------------------------- Vergleich */

export interface Change {
  /** Kalendertag, gegen den verglichen wurde. */
  day: string;
  /** Wie viele Tage das her ist. */
  ageDays: number;
  from: number;
  delta: number;
  pct: number;
}

export interface PlayerTrend {
  /** Gegen den letzten Schnappschuss vor heute. */
  since: Change | null;
  /** Gegen den Stand vor rund einer Woche. */
  d7: Change | null;
  /** Gegen den Stand vor rund einem Monat. */
  d30: Change | null;
  /** Der Spieler taucht in keinem Schnappschuss auf - neu im Kader oder Markt. */
  isNew: boolean;
}

const EMPTY_TREND: PlayerTrend = {
  since: null,
  d7: null,
  d30: null,
  isNew: true,
};

function change(from: number, to: number, day: string, today: string): Change | null {
  if (!from) return null;
  const delta = to - from;
  return {
    day,
    ageDays: daysBetween(day, today),
    from,
    delta,
    pct: (delta / from) * 100,
  };
}

export interface TrendReport {
  /** Pro Spieler-ID der Vergleich gegen die gespeicherten Staende. */
  byPlayer: Map<string, PlayerTrend>;
  /** Der juengste Schnappschuss vor heute - Basis fuer `since`. */
  reference: SnapshotMeta | null;
  /** Der allerjuengste Schnappschuss, auch wenn er von heute ist. */
  newest: SnapshotMeta | null;
  /** Nichts gespeichert: die Oberflaeche soll das sagen, nicht Nullen zeigen. */
  empty: boolean;
}

/**
 * Das Herzstueck: vergleicht die eben von Kickbase geholten Marktwerte mit
 * dem, was in der Datei steht. Drei Abfragen, egal wie gross der Kader ist.
 */
export function compareWithHistory(
  leagueId: string,
  current: { playerId: string; marketValue: number }[],
  when: Date = new Date()
): TrendReport {
  const today = berlinDay(when);
  const newest = newestSnapshot(leagueId);

  // Fuer `since` bewusst den Stand VOR heute nehmen. Sonst nullt ein
  // Schnappschuss, der heute frueh lief, den Vergleich aus.
  const reference = snapshotOnOrBefore(leagueId, dayMinus(today, 1));
  const ref7 = snapshotOnOrBefore(leagueId, dayMinus(today, 7));
  const ref30 = snapshotOnOrBefore(leagueId, dayMinus(today, 30));

  const byPlayer = new Map<string, PlayerTrend>();
  if (!newest) {
    for (const c of current) byPlayer.set(c.playerId, EMPTY_TREND);
    return { byPlayer, reference: null, newest: null, empty: true };
  }

  const vRef = reference ? valuesOf(reference.id) : null;
  // Faellt ein Horizont mit einem schon geladenen zusammen, nicht neu lesen.
  const v7 =
    ref7 && reference && ref7.id === reference.id ? vRef : ref7 ? valuesOf(ref7.id) : null;
  const v30 =
    ref30 && ref7 && ref30.id === ref7.id
      ? v7
      : ref30 && reference && ref30.id === reference.id
        ? vRef
        : ref30
          ? valuesOf(ref30.id)
          : null;

  for (const c of current) {
    const from = vRef?.get(c.playerId);
    const from7 = v7?.get(c.playerId);
    const from30 = v30?.get(c.playerId);

    byPlayer.set(c.playerId, {
      since:
        from !== undefined && reference
          ? change(from, c.marketValue, reference.day, today)
          : null,
      d7: from7 !== undefined && ref7 ? change(from7, c.marketValue, ref7.day, today) : null,
      d30:
        from30 !== undefined && ref30
          ? change(from30, c.marketValue, ref30.day, today)
          : null,
      isNew: from === undefined && from7 === undefined && from30 === undefined,
    });
  }

  return { byPlayer, reference, newest, empty: false };
}

/* ------------------------------------------------------- Manager-Formkurve */

/** Gesamtpunkte je Manager in einem Schnappschuss. */
function managerPointsOf(snapshotId: number): Map<string, number> {
  const rows = getDb()
    .prepare(
      `SELECT manager_id AS managerId, points
         FROM manager_snapshots
        WHERE snapshot_id = ?`
    )
    .all(snapshotId) as { managerId: string; points: number }[];
  return new Map(rows.map((r) => [r.managerId, r.points]));
}

export interface ManagerForm {
  /** Punkte seit dem Stand vor rund einer Woche. */
  d7: number | null;
  /** Punkte seit dem letzten Stand vor heute. */
  d1: number | null;
}

export interface ManagerFormReport {
  byManager: Map<string, ManagerForm>;
  reference: SnapshotMeta | null;
  ref7: SnapshotMeta | null;
  empty: boolean;
}

/**
 * Wie viele Punkte jeder Manager seit gestern und seit rund einer Woche
 * geholt hat - der Zuwachs gegen die gespeicherten Staende. Solange nichts
 * gespeichert ist, bleibt alles null und die Oberflaeche sagt das.
 */
export function compareManagers(
  leagueId: string,
  current: { managerId: string; points: number }[],
  when: Date = new Date()
): ManagerFormReport {
  const today = berlinDay(when);
  const reference = snapshotOnOrBefore(leagueId, dayMinus(today, 1));
  const ref7 = snapshotOnOrBefore(leagueId, dayMinus(today, 7));

  const byManager = new Map<string, ManagerForm>();
  if (!reference && !ref7) {
    for (const c of current) byManager.set(c.managerId, { d7: null, d1: null });
    return { byManager, reference: null, ref7: null, empty: true };
  }

  const v1 = reference ? managerPointsOf(reference.id) : null;
  const v7 =
    ref7 && reference && ref7.id === reference.id ? v1 : ref7 ? managerPointsOf(ref7.id) : null;

  for (const c of current) {
    const from1 = v1?.get(c.managerId);
    const from7 = v7?.get(c.managerId);
    byManager.set(c.managerId, {
      d1: from1 !== undefined ? c.points - from1 : null,
      d7: from7 !== undefined ? c.points - from7 : null,
    });
  }

  return { byManager, reference, ref7, empty: false };
}

/** Dasselbe fuer den Teamwert als Ganzes. */
export function compareTeamValue(
  leagueId: string,
  currentTeamValue: number,
  when: Date = new Date()
): Change | null {
  const today = berlinDay(when);
  const reference = snapshotOnOrBefore(leagueId, dayMinus(today, 1));
  if (!reference) return null;

  const row = getDb()
    .prepare(`SELECT team_value AS teamValue FROM team_snapshots WHERE snapshot_id = ?`)
    .get(reference.id) as { teamValue: number | null } | undefined;

  if (!row?.teamValue) return null;
  return change(row.teamValue, currentTeamValue, reference.day, today);
}
