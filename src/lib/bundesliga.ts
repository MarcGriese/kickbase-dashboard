/**
 * Echte Bundesliga-Daten: Tabelle und Spieltag mit Ergebnissen.
 *
 * Grundlage sind dieselben zwei Zusatzendpunkte, aus denen fixtures.ts schon
 * die Gegnerstaerke zieht - hier lesen wir sie voll aus. Beide sind nicht
 * offiziell dokumentiert, deshalb werden die Feldnamen defensiv ueber
 * Kandidatenlisten geraten; was fehlt, bleibt `null` und die Oberflaeche zeigt
 * an der Stelle einen Strich statt einer erfundenen Zahl.
 *
 * Bewusst ohne Importe - wie league.ts reine Parserei, damit der Node-Testrunner
 * die Datei direkt laden kann. Vereinsnamen loest die Oberflaeche ueber
 * fixtures.teamName aus der Team-ID auf; hier tragen wir nur den Namen weiter,
 * den die API selbst mitschickt (meist keinen).
 */

/* --------------------------------------------------------------- Helfer */

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Erster nicht-leerer Wert aus mehreren moeglichen Kuerzeln. */
function field(obj: Record<string, any> | null | undefined, keys: string[]): unknown {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

const DEFAULT_CDN = "https://kickbase.b-cdn.net";

/** Ein Bild-Feld der API zu einer absoluten URL machen, sonst null. */
function imageUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return `https:${s}`;
  return `${DEFAULT_CDN}/${s.replace(/^\/+/, "")}`;
}

/* --------------------------------------------------------------- Tabelle */

export interface BLTeam {
  teamId: number;
  place: number;
  /** Name, den die API mitschickt - kann leer sein, dann loest die UI ihn aus der ID. */
  name: string;
  /** Vereinswappen laut API, falls mitgeliefert - sonst baut die UI es aus der ID. */
  crest: string | null;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  goalDiff: number | null;
  points: number | null;
  /** Die letzten Ergebnisse als "S"/"U"/"N", soweit die API sie liefert. */
  form: string[];
}

/** Ein Formzeichen normalisieren: Sieg/Unentschieden/Niederlage. */
function formToken(v: unknown): string | null {
  const s = String(v).trim().toUpperCase();
  if (!s) return null;
  if (["W", "S"].includes(s)) return "S";
  if (["D", "U", "T"].includes(s)) return "U";
  if (["L", "N"].includes(s)) return "N";
  return null;
}

function parseForm(raw: Record<string, any>): string[] {
  const f = field(raw, ["form", "fo", "lm", "last", "trend"]);
  const list = Array.isArray(f) ? f : typeof f === "string" ? f.split(/[\s,]+/) : [];
  return list.map(formToken).filter((x): x is string => x !== null).slice(-5);
}

export function parseBundesligaTable(raw: Record<string, any> | null): BLTeam[] {
  const items: any[] = raw?.it ?? raw?.table ?? [];
  if (!Array.isArray(items) || !items.length) return [];

  return items.map((t, i) => {
    const teamId = Number(field(t, ["tid", "tii", "ti", "i", "id"])) || 0;
    const name = String(field(t, ["tn", "n", "name"]) ?? "").trim();
    const gf = num(field(t, ["g", "gf", "gs", "tg", "goals"]));
    const ga = num(field(t, ["ga", "gc", "gr", "ag"]));
    const gd = num(field(t, ["gd", "dif", "diff", "gdiff"]));
    return {
      teamId,
      place: Number(field(t, ["cpl", "pl", "place", "rank", "r"])) || i + 1,
      name,
      crest: imageUrl(field(t, ["tim", "tl", "logo", "timg", "tlogo", "image"])),
      played: num(field(t, ["sp", "mp", "gp", "games", "m"])),
      wins: num(field(t, ["w", "win", "won"])),
      draws: num(field(t, ["d", "dr", "draw", "drawn"])),
      losses: num(field(t, ["l", "lo", "loss", "lost"])),
      goalsFor: gf,
      goalsAgainst: ga,
      goalDiff: gd !== null ? gd : gf !== null && ga !== null ? gf - ga : null,
      points: num(field(t, ["p", "pts", "points"])),
      form: parseForm(t),
    };
  });
}

/* --------------------------------------------------------------- Spieltag */

export type MatchStatus = "geplant" | "live" | "beendet";

export interface MatchSide {
  teamId: number;
  /** Name laut API, falls die Paarung ihn mitschickt - sonst leer (UI loest ihn auf). */
  name: string;
  goals: number | null;
}

export interface Match {
  matchday: number;
  kickoff: string | null; // ISO - Client formatiert selbst
  status: MatchStatus;
  home: MatchSide;
  away: MatchSide;
}

function side(teamId: number, goals: number | null, name = ""): MatchSide {
  return { teamId, name, goals };
}

function statusOf(rawStatus: number | null, kickoff: Date | null): MatchStatus {
  if (rawStatus !== null) {
    if (rawStatus >= 2) return "beendet";
    if (rawStatus === 1) return "live";
    return "geplant";
  }
  // Ohne Status-Feld entscheidet die Zeit: laengst angepfiffen ~ beendet.
  if (!kickoff) return "geplant";
  const elapsed = Date.now() - kickoff.getTime();
  if (elapsed < 0) return "geplant";
  if (elapsed > 2 * 60 * 60 * 1000) return "beendet";
  return "live";
}

/** Alle Partien aus der verschachtelten Spieltagsantwort, mit Ergebnissen. */
export function parseMatches(raw: Record<string, any> | null): Match[] {
  const days: any[] = raw?.it ?? [];
  const out: Match[] = [];

  for (const day of days) {
    const matchday = Number(field(day, ["day", "md", "d"])) || 0;
    const matches: any[] = day?.it ?? day?.m ?? [];
    for (const m of matches) {
      const t1 = Number(field(m, ["t1", "t1i"]));
      const t2 = Number(field(m, ["t2", "t2i"]));
      if (!t1 || !t2) continue;

      const dt = field(m, ["dt", "mdst", "d", "date"]);
      const kickoffRaw = dt ? new Date(dt as string) : null;
      const kickoff = kickoffRaw && !Number.isNaN(kickoffRaw.getTime()) ? kickoffRaw : null;
      const status = statusOf(num(field(m, ["st", "status"])), kickoff);

      out.push({
        matchday,
        kickoff: kickoff ? kickoff.toISOString() : null,
        status,
        home: side(
          t1,
          num(field(m, ["t1g", "g1", "hg", "s1", "hs"])),
          String(field(m, ["t1n", "hn"]) ?? "").trim()
        ),
        away: side(
          t2,
          num(field(m, ["t2g", "g2", "ag", "s2", "as"])),
          String(field(m, ["t2n", "an"]) ?? "").trim()
        ),
      });
    }
  }

  return out;
}

/**
 * Der Spieltag, der gerade zaehlt: laeuft eine Partie, ist es deren Spieltag;
 * sonst der naechste mit noch nicht beendeten Spielen; sonst der letzte.
 */
export function currentMatchday(matches: Match[]): number | null {
  if (!matches.length) return null;
  const live = matches.find((m) => m.status === "live");
  if (live) return live.matchday;

  const upcoming = matches
    .filter((m) => m.status === "geplant")
    .sort((a, b) => {
      const ka = a.kickoff ? Date.parse(a.kickoff) : Number.MAX_SAFE_INTEGER;
      const kb = b.kickoff ? Date.parse(b.kickoff) : Number.MAX_SAFE_INTEGER;
      return ka - kb || a.matchday - b.matchday;
    });
  if (upcoming.length) return upcoming[0].matchday;

  return matches.reduce((max, m) => Math.max(max, m.matchday), 0) || null;
}

export function matchesOf(matches: Match[], matchday: number): Match[] {
  return matches
    .filter((m) => m.matchday === matchday)
    .sort((a, b) => {
      const ka = a.kickoff ? Date.parse(a.kickoff) : Number.MAX_SAFE_INTEGER;
      const kb = b.kickoff ? Date.parse(b.kickoff) : Number.MAX_SAFE_INTEGER;
      return ka - kb;
    });
}

/** Verein -> seine Partie an einem Spieltag. Fuer "spielt mein Spieler heute?". */
export function matchByTeam(matches: Match[]): Map<number, Match> {
  const map = new Map<number, Match>();
  for (const m of matches) {
    map.set(m.home.teamId, m);
    map.set(m.away.teamId, m);
  }
  return map;
}
