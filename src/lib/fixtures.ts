/**
 * Spielplan und Gegnerstaerke.
 *
 * Aus dem Spieltags-Endpunkt bauen wir pro Verein die naechsten Partien und
 * faerben den Gegner rot/gelb/gruen. Die Staerke kommt aus der echten
 * Bundesliga-Tabelle, solange die API sie liefert; sonst aus einer groben
 * Einstufung, die hier offen im Code steht statt versteckt in der Anzeige.
 */

/** rot = schwerer Gegner, gelb = ausgeglichen, gruen = dankbare Aufgabe. */
export type Strength = "hart" | "mittel" | "leicht";

export interface Fixture {
  matchday: number;
  opponentId: number;
  opponentName: string;
  /** Drei-Zeichen-Kuerzel fuer die enge Spalte in der Kadertabelle. */
  opponentShort: string;
  home: boolean;
  kickoff: string | null; // ISO - Client formatiert selbst
  strength: Strength;
}

export interface Schedule {
  /** Verein -> die naechsten Partien, aufsteigend nach Spieltag. */
  byTeam: Map<number, Fixture[]>;
  /** Anstoss des naechsten Spiels ueberhaupt - Ende des Prognose-Horizonts. */
  nextKickoff: Date | null;
  /** Nummer des naechsten Spieltags, fuer die Beschriftung. */
  nextMatchday: number | null;
}

export const EMPTY_SCHEDULE: Schedule = {
  byTeam: new Map(),
  nextKickoff: null,
  nextMatchday: null,
};

/**
 * Vereinsnamen als Rueckfallebene, wenn die Paarung nur IDs enthaelt.
 * Unvollstaendig zu sein ist hier in Ordnung - dann steht da die ID.
 */
const TEAM_NAMES: Record<number, string> = {
  2: "Bayern",
  3: "Dortmund",
  4: "Frankfurt",
  5: "Freiburg",
  6: "Hamburg",
  7: "Leverkusen",
  8: "Schalke",
  9: "Stuttgart",
  10: "Bremen",
  11: "Wolfsburg",
  13: "Augsburg",
  14: "Hoffenheim",
  15: "Gladbach",
  18: "Mainz",
  20: "Hertha",
  24: "Bochum",
  28: "Köln",
  39: "St. Pauli",
  40: "Union Berlin",
  43: "Leipzig",
  50: "Heidenheim",
  51: "Darmstadt",
};

/** Gelaeufige Kuerzel - was hier fehlt, wird aus dem Namen abgeleitet. */
const TEAM_SHORTS: Record<number, string> = {
  2: "FCB",
  3: "BVB",
  4: "SGE",
  5: "SCF",
  6: "HSV",
  7: "B04",
  8: "S04",
  9: "VFB",
  10: "SVW",
  11: "WOB",
  13: "FCA",
  14: "TSG",
  15: "BMG",
  18: "M05",
  20: "BSC",
  24: "BOC",
  28: "KOE",
  39: "STP",
  40: "FCU",
  43: "RBL",
  50: "FCH",
  51: "SVD",
};

export function teamName(id: number, fromApi?: string | null): string {
  const api = (fromApi ?? "").trim();
  if (api) return api;
  return TEAM_NAMES[id] ?? `Team ${id}`;
}

export function teamShort(id: number, name: string): string {
  return (
    TEAM_SHORTS[id] ??
    name
      .replace(/[^A-Za-zÄÖÜäöüß ]/g, "")
      .trim()
      .slice(0, 3)
      .toUpperCase()
  );
}

/* ------------------------------------------------------------ Tabelle */

/** Verein -> Tabellenplatz. Leer, wenn die API keine Tabelle hergibt. */
export type TableIndex = Map<number, { place: number; name: string }>;

export function buildTable(raw: Record<string, any> | null): TableIndex {
  const index: TableIndex = new Map();
  const items: any[] = raw?.it ?? [];

  items.forEach((t, i) => {
    const id = Number(t?.tid ?? t?.i ?? t?.id);
    if (!id) return;
    // "cpl" ist der aktuelle Platz; sonst zaehlt die Reihenfolge der Liste.
    const place = Number(t?.cpl ?? t?.pl ?? t?.place) || i + 1;
    index.set(id, { place, name: String(t?.tn ?? t?.n ?? t?.name ?? "").trim() });
  });

  return index;
}

/**
 * Gegnerstaerke aus Tabellenplatz und Heimrecht.
 *
 * Heimspiel entschaerft, Auswaerts verschaerft - bewusst als glatte
 * Platzverschiebung, damit die Regel nachvollziehbar bleibt.
 */
export function strengthOf(
  opponentId: number,
  home: boolean,
  table: TableIndex
): Strength {
  const place = table.get(opponentId)?.place;
  if (!place) return "mittel"; // ohne Tabelle keine Behauptung

  const adjusted = place + (home ? 2 : -2);
  if (adjusted <= 6) return "hart";
  if (adjusted <= 12) return "mittel";
  return "leicht";
}

/* ------------------------------------------------------------ Spielplan */

interface RawMatch {
  matchday: number;
  t1: number;
  t2: number;
  kickoff: Date | null;
  finished: boolean;
}

/** Zieht alle Paarungen aus der verschachtelten Spieltagsantwort. */
function flatten(raw: Record<string, any> | null): RawMatch[] {
  const days: any[] = raw?.it ?? [];
  const out: RawMatch[] = [];

  for (const day of days) {
    const matchday = Number(day?.day ?? day?.md ?? day?.d) || 0;
    const matches: any[] = day?.it ?? day?.m ?? [];
    for (const m of matches) {
      const t1 = Number(m?.t1 ?? m?.t1i);
      const t2 = Number(m?.t2 ?? m?.t2i);
      if (!t1 || !t2) continue;

      const dt = m?.dt ?? m?.mdst ?? m?.d ?? m?.date;
      const kickoff = dt ? new Date(dt) : null;
      // st: 0 geplant, 1 laeuft, 2 beendet. Fehlt das Feld, entscheidet die Zeit.
      const st = Number(m?.st ?? m?.status);
      const finished = Number.isFinite(st)
        ? st >= 2
        : kickoff
          ? kickoff.getTime() < Date.now()
          : false;

      out.push({
        matchday,
        t1,
        t2,
        kickoff: kickoff && !Number.isNaN(kickoff.getTime()) ? kickoff : null,
        finished,
      });
    }
  }

  return out;
}

/**
 * Baut den Spielplan-Index. `limit` begrenzt die Partien pro Verein.
 */
export function buildSchedule(
  matchdaysRaw: Record<string, any> | null,
  table: TableIndex,
  limit = 3
): Schedule {
  const all = flatten(matchdaysRaw);
  if (!all.length) return EMPTY_SCHEDULE;

  const now = Date.now();
  const upcoming = all
    .filter((m) => !m.finished && (!m.kickoff || m.kickoff.getTime() > now))
    .sort((a, b) => {
      const ka = a.kickoff?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const kb = b.kickoff?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return ka - kb || a.matchday - b.matchday;
    });

  if (!upcoming.length) return EMPTY_SCHEDULE;

  const byTeam = new Map<number, Fixture[]>();
  const add = (teamId: number, opponentId: number, home: boolean, m: RawMatch) => {
    const list = byTeam.get(teamId) ?? [];
    if (list.length >= limit) return;
    const opponentName = teamName(opponentId, table.get(opponentId)?.name);
    list.push({
      matchday: m.matchday,
      opponentId,
      opponentName,
      opponentShort: teamShort(opponentId, opponentName),
      home,
      kickoff: m.kickoff ? m.kickoff.toISOString() : null,
      strength: strengthOf(opponentId, home, table),
    });
    byTeam.set(teamId, list);
  };

  for (const m of upcoming) {
    add(m.t1, m.t2, true, m);
    add(m.t2, m.t1, false, m);
  }

  const withTime = upcoming.find((m) => m.kickoff);
  return {
    byTeam,
    nextKickoff: withTime?.kickoff ?? null,
    nextMatchday: upcoming[0]?.matchday || null,
  };
}
