/**
 * Der naechtliche Schnappschuss.
 *
 * Zwei Wege herein:
 *   1. Cron ohne Browser - `Authorization: Bearer $SNAPSHOT_SECRET`. Weil
 *      dabei kein Session-Cookie mitkommt, meldet sich der Job selbst mit
 *      KB_EMAIL / KB_PASSWORD an.
 *   2. Angemeldet im Browser - dann zaehlt das Session-Cookie und du kannst
 *      den Lauf jederzeit von Hand ausloesen.
 *
 * GET meldet nur, was gespeichert ist. Geschrieben wird ausschliesslich
 * ueber POST.
 */

import { NextResponse } from "next/server";
import { getToken, getLeagueId } from "@/lib/session";
import { captureSnapshot, loginFromEnv } from "@/lib/capture";
import { KickbaseError } from "@/lib/kickbase";
import { berlinDay, countSnapshots, newestSnapshot } from "@/lib/snapshot";
import { dbPath } from "@/lib/db";

export const dynamic = "force-dynamic";

function secretMatches(req: Request): boolean {
  const expected = process.env.SNAPSHOT_SECRET;
  if (!expected) return false;

  const header = req.headers.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/i, "");
  if (provided.length !== expected.length) return false;

  // Konstante Laufzeit - der Vergleich soll die Laenge des Treffers nicht verraten.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function GET() {
  const leagueId = getLeagueId();
  const newest = leagueId ? newestSnapshot(leagueId) : null;

  return NextResponse.json({
    file: dbPath(),
    today: berlinDay(),
    leagueId,
    snapshots: leagueId ? countSnapshots(leagueId) : countSnapshots(),
    newest,
  });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  try {
    // Weg 1: Cron mit Geheimnis, Anmeldung ueber die Umgebung.
    if (secretMatches(req)) {
      const creds = await loginFromEnv();
      if (!creds) {
        return NextResponse.json(
          {
            error:
              "SNAPSHOT_SECRET stimmt, aber KB_EMAIL/KB_PASSWORD fehlen. Ohne hinterlegte Zugangsdaten kann der nächtliche Lauf sich nicht anmelden.",
          },
          { status: 428 }
        );
      }
      const result = await captureSnapshot(
        creds.token,
        creds.leagueId,
        "cron",
        { force }
      );
      return NextResponse.json(result);
    }

    // Weg 2: angemeldeter Browser.
    const token = getToken();
    const leagueId = getLeagueId();
    if (!token || !leagueId) {
      return NextResponse.json(
        { error: "Nicht angemeldet und kein gültiges SNAPSHOT_SECRET." },
        { status: 401 }
      );
    }

    const result = await captureSnapshot(token, leagueId, "manual", { force });
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof KickbaseError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status });
  }
}
