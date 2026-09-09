/**
 * Start-Hook. Laeuft einmal, wenn der Server hochkommt - vor der ersten
 * Anfrage.
 *
 * Zwei Aufgaben:
 *   1. Die SQLite-Datei oeffnen und migrieren, damit die erste Seite nicht
 *      als Erste die Schemaerzeugung bezahlt.
 *   2. Melden, wie alt der gespeicherte Vergleichsstand ist - und, wenn
 *      Zugangsdaten hinterlegt sind und der heutige Stand noch fehlt, ihn
 *      gleich holen.
 *
 * Zu (2) eine Einschraenkung, die man kennen muss: beim Start gibt es keine
 * Browser-Sitzung und damit keinen Token. Ohne KB_EMAIL / KB_PASSWORD in der
 * Umgebung kann der Start-Hook nichts abrufen - er migriert dann nur und
 * meldet den gespeicherten Stand. Der eigentliche Vergleich zwischen aktuellen
 * und gespeicherten Werten passiert ohnehin bei jedem Seitenaufruf, wo der
 * Token vorliegt.
 *
 * Nichts hier darf den Start umwerfen: jeder Fehler wird geloggt und
 * geschluckt.
 */

export async function register(): Promise<void> {
  // Der Edge-Runtime fehlt das Dateisystem - SQLite gibt es dort nicht.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { getDb, dbPath } = await import("./lib/db");
    const { berlinDay, countSnapshots, newestSnapshot, daysBetween } =
      await import("./lib/snapshot");

    getDb(); // oeffnet und migriert
    const today = berlinDay();

    const leagueId = process.env.KB_LEAGUE_ID ?? null;
    const newest = leagueId ? newestSnapshot(leagueId) : null;
    const total = countSnapshots();

    if (newest) {
      const age = daysBetween(newest.day, today);
      console.log(
        `[kaderzentrale] ${dbPath()} – ${total} Schnappschüsse, ` +
          `letzter ${newest.day} (${age} Tage alt, Quelle: ${newest.source}).`
      );
    } else {
      console.log(
        `[kaderzentrale] ${dbPath()} – ${total} Schnappschüsse gespeichert, ` +
          `für die konfigurierte Liga noch keiner. Der Verlauf bleibt leer, ` +
          `bis der erste Lauf durch ist.`
      );
    }

    await snapshotOnStart(today);
  } catch (err) {
    console.error("[kaderzentrale] Start-Hook fehlgeschlagen:", err);
  }
}

/**
 * Holt den heutigen Stand, falls er fehlt und die Zugangsdaten dafuer da sind.
 * Standardmaessig an; ueber KB_SNAPSHOT_ON_START=0 abschaltbar, wenn dich der
 * Anmeldevorgang bei jedem Neustart stoert.
 */
async function snapshotOnStart(today: string): Promise<void> {
  if (process.env.KB_SNAPSHOT_ON_START === "0") return;
  if (!process.env.KB_EMAIL || !process.env.KB_PASSWORD) return;

  const { hasSnapshotForDay } = await import("./lib/snapshot");
  const { captureSnapshot, loginFromEnv } = await import("./lib/capture");

  // Erst die Liga aus der Umgebung pruefen, damit ein bereits vorhandener
  // Tagesstand gar keine Anmeldung ausloest.
  const configured = process.env.KB_LEAGUE_ID;
  if (configured && hasSnapshotForDay(configured, today)) return;

  const creds = await loginFromEnv();
  if (!creds) return;
  if (hasSnapshotForDay(creds.leagueId, today)) return;

  const result = await captureSnapshot(creds.token, creds.leagueId, "startup");
  console.log(
    `[kaderzentrale] Schnappschuss ${result.day} angelegt: ` +
      `${result.players} Spieler, davon ${result.owned} im eigenen Kader, ` +
      `Teamwert ${result.teamValue}.`
  );
}
