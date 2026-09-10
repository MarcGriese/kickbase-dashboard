/**
 * SQLite-Verbindung fuer den Schnappschuss-Speicher.
 *
 * Kickbase liefert immer nur das Jetzt: `sdmvt` ist die Marktwertaenderung
 * seit gestern, mehr Gedaechtnis hat die API nicht. Damit siehst du keinen
 * dreitaegigen Rutsch, keine Erholung und nicht, welcher Spieler still vor
 * sich hin waechst. Diese Datei ist das Gedaechtnis: eine lokale Datei,
 * eine Zeile pro Liga und Tag.
 *
 * Bewusst better-sqlite3 und nicht node:sqlite - letzteres braucht in Node 22
 * noch das Flag --experimental-sqlite, was `next dev` unbrauchbar macht.
 */

import "server-only";
// Bewusst ohne "node:"-Praefix: webpack lehnt das node:-Schema ab, bevor es
// ueberhaupt zur Alias-Aufloesung kommt (UnhandledSchemeError). Das
// Edge-Bundle in next.config.mjs biegt genau diese beiden auf ein leeres
// Modul um - siehe die Erklaerung dort.
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

export type Db = Database.Database;

/** Wo die Datei liegt. Ueberschreibbar fuer Tests oder ein anderes Volume. */
export function dbPath(): string {
  return process.env.KB_DB_PATH
    ? path.resolve(process.env.KB_DB_PATH)
    : path.join(process.cwd(), "data", "kaderzentrale.db");
}

/**
 * Next haelt im Dev-Modus mehrere Modul-Instanzen gleichzeitig (HMR).
 * Ohne diesen Cache oeffnet jeder Reload ein neues Handle auf dieselbe Datei.
 */
const globalCache = globalThis as unknown as { __kbDb?: Db };

export function getDb(): Db {
  if (globalCache.__kbDb) return globalCache.__kbDb;

  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  // WAL: Lesen blockiert nicht, waehrend der naechtliche Job schreibt.
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);

  globalCache.__kbDb = db;
  return db;
}

/**
 * Schema-Migration ueber user_version. Jeder Schritt laeuft genau einmal und
 * hebt die Version an - so bleibt eine bestehende Datei beim Update heil.
 */
function migrate(db: Db): void {
  const current = db.pragma("user_version", { simple: true }) as number;

  if (current < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        league_id  TEXT    NOT NULL,
        day        TEXT    NOT NULL,   -- YYYY-MM-DD, Zeitzone Europe/Berlin
        taken_at   TEXT    NOT NULL,   -- ISO 8601 UTC
        source     TEXT    NOT NULL,   -- 'cron' | 'startup' | 'manual'
        UNIQUE (league_id, day)
      );

      CREATE TABLE IF NOT EXISTS player_snapshots (
        snapshot_id  INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
        player_id    TEXT    NOT NULL,
        name         TEXT,
        pos          INTEGER,
        team_id      TEXT,
        market_value INTEGER,
        points       INTEGER,
        average      REAL,
        status       INTEGER,
        owned        INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (snapshot_id, player_id)
      );

      CREATE TABLE IF NOT EXISTS team_snapshots (
        snapshot_id INTEGER PRIMARY KEY REFERENCES snapshots(id) ON DELETE CASCADE,
        team_value  INTEGER,
        budget      INTEGER,
        squad_size  INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_league_day
        ON snapshots (league_id, day DESC);
      CREATE INDEX IF NOT EXISTS idx_player_snapshots_player
        ON player_snapshots (player_id);
    `);
    db.pragma("user_version = 1");
  }

  if (current < 2) {
    // Manager-Staende pro Tag: Grundlage fuer die Formkurve der Mitspieler.
    // Baut sich erst ab dem naechsten Schnappschuss auf - Kickbase kennt keine
    // Vergangenheit, das Gedaechtnis faengt beim ersten Lauf an.
    db.exec(`
      CREATE TABLE IF NOT EXISTS manager_snapshots (
        snapshot_id     INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
        manager_id      TEXT    NOT NULL,
        name            TEXT,
        points          INTEGER,
        matchday_points INTEGER,
        team_value      INTEGER,
        is_me           INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (snapshot_id, manager_id)
      );

      CREATE INDEX IF NOT EXISTS idx_manager_snapshots_manager
        ON manager_snapshots (manager_id);
    `);
    db.pragma("user_version = 2");
  }
}

/** Nur fuer Tests: schliesst das Handle und leert den Cache. */
export function closeDb(): void {
  globalCache.__kbDb?.close();
  globalCache.__kbDb = undefined;
}
