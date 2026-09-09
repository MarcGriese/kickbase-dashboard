/**
 * Aufstellungs-Logik: die beste Startelf aus dem eigenen Kader und daraus
 * abgeleitet konkrete Wechsel-Empfehlungen vom Transfermarkt.
 *
 * Bewusst reine Funktionen ohne API- oder DB-Abhaengigkeit - genau der Teil,
 * den man nicht gegen Kickbase pruefen kann (die API gibt weder eine
 * "richtige" Elf noch eine Punkteprognose her) und der deshalb hier getestet
 * wird, so wie league.ts.
 *
 * Der Startwert eines Spielers ist bewusst schlicht und nachvollziehbar:
 * sein Punkteschnitt, gedaempft wenn er angeschlagen ist, und leicht nach
 * Gegnerstaerke des naechsten Spiels justiert. Verletzte, gesperrte und nicht
 * gemeldete Spieler koennen nicht starten und fallen mit Wert 0 heraus.
 */

import type { Fixture, Strength } from "./fixtures";

/** Verletzt, Gesperrt, Nicht im Kader - kann diese Woche nicht auflaufen. */
const UNAVAILABLE = new Set<number>([1, 8, 16]);
/** Angeschlagen, Aufbautraining - kann spielen, aber mit Fragezeichen. */
const DOUBTFUL = new Set<number>([2, 4]);

/** Daempfung des Startwerts fuer einen angeschlagenen Spieler. */
const DOUBTFUL_FACTOR = 0.5;
/** Justierung des Startwerts nach Staerke des naechsten Gegners. */
const STRENGTH_FACTOR: Record<Strength, number> = {
  hart: 0.9,
  mittel: 1.0,
  leicht: 1.1,
};

/** Nur diese Verbesserung rechtfertigt einen Wechsel - sonst ist es Aktionismus. */
const DEFAULT_MIN_RATIO = 1.1;

export interface Formation {
  name: string;
  def: number;
  mid: number;
  att: number;
}

/**
 * Die von Kickbase erlaubten Grundordnungen. Torwart ist immer genau einer,
 * die Summe der Feldspieler ist immer zehn.
 */
export const FORMATIONS: Formation[] = [
  { name: "3-4-3", def: 3, mid: 4, att: 3 },
  { name: "3-5-2", def: 3, mid: 5, att: 2 },
  { name: "3-6-1", def: 3, mid: 6, att: 1 },
  { name: "4-3-3", def: 4, mid: 3, att: 3 },
  { name: "4-4-2", def: 4, mid: 4, att: 2 },
  { name: "4-5-1", def: 4, mid: 5, att: 1 },
  { name: "5-2-3", def: 5, mid: 2, att: 3 },
  { name: "5-3-2", def: 5, mid: 3, att: 2 },
  { name: "5-4-1", def: 5, mid: 4, att: 1 },
];

/** Das Minimum, das ein Spieler fuer die Aufstellungs-Logik mitbringen muss. */
export interface Startable {
  id: string;
  pos: number;
  teamId: number;
  average: number;
  status: number;
}

/** Ein Marktspieler zusaetzlich mit Preis und Maximalgebot. */
export interface MarketStartable extends Startable {
  marketValue: number;
  price: number;
  maxBid: number;
}

export function isAvailable(status: number): boolean {
  return !UNAVAILABLE.has(status);
}

/** Der naechste Gegner eines Spielers, oder null ohne Spielplan. */
function nextFixture(p: Startable, byTeam: Map<number, Fixture[]>): Fixture | null {
  const list = byTeam.get(p.teamId);
  return list && list.length ? list[0] : null;
}

/**
 * Erwarteter Startwert. Kein Kickbase-Wert, sondern eine ehrliche
 * Fortschreibung: Punkteschnitt, gedaempft nach Fitness, justiert nach
 * Gegnerstaerke. Wer nicht auflaufen kann, hat den Wert 0.
 */
export function startScore(p: Startable, byTeam: Map<number, Fixture[]>): number {
  if (UNAVAILABLE.has(p.status)) return 0;
  let s = Math.max(0, p.average);
  if (DOUBTFUL.has(p.status)) s *= DOUBTFUL_FACTOR;
  const next = nextFixture(p, byTeam);
  if (next) s *= STRENGTH_FACTOR[next.strength];
  return s;
}

export interface Lineup<T extends Startable> {
  formation: Formation;
  gk: T | null;
  def: T[];
  mid: T[];
  att: T[];
  /** Alle elf, Torwart zuerst. */
  starters: T[];
  /** Der Rest des Kaders, absteigend nach Startwert. */
  bench: T[];
  /** Summe der Startwerte der elf - die "erwarteten Punkte" der Elf. */
  expectedPoints: number;
  /** Wie die anderen Grundordnungen abgeschnitten haetten. */
  alternatives: { formation: Formation; total: number }[];
}

function byScoreDesc<T extends Startable>(byTeam: Map<number, Fixture[]>) {
  return (a: T, b: T) => startScore(b, byTeam) - startScore(a, byTeam);
}

/** Die besten n einer schon sortierten Liste, ohne die Liste zu veraendern. */
function top<T>(list: T[], n: number): T[] {
  return list.slice(0, Math.max(0, n));
}

/**
 * Beste Startelf ueber alle erlaubten Grundordnungen.
 *
 * Fuer jede Grundordnung wird die punktbeste Besetzung aus den vorhandenen
 * Spielern gebildet; gewaehlt wird die Ordnung mit der hoechsten Summe. Reicht
 * der Kader fuer keine Standard-Ordnung (zu wenige einer Position), wird aus
 * dem, was da ist, die beste Elf gebaut - lieber eine ehrliche Notloesung als
 * gar keine Empfehlung.
 */
export function pickBestEleven<T extends Startable>(
  players: T[],
  byTeam: Map<number, Fixture[]> = new Map()
): Lineup<T> | null {
  if (!players.length) return null;

  const cmp = byScoreDesc<T>(byTeam);
  const keepers = players.filter((p) => p.pos === 1).sort(cmp);
  const defs = players.filter((p) => p.pos === 2).sort(cmp);
  const mids = players.filter((p) => p.pos === 3).sort(cmp);
  const atts = players.filter((p) => p.pos === 4).sort(cmp);

  const scoreOf = (list: T[]) => list.reduce((s, p) => s + startScore(p, byTeam), 0);

  const fits = FORMATIONS.filter(
    (f) => defs.length >= f.def && mids.length >= f.mid && atts.length >= f.att
  );

  const gk = keepers[0] ?? null;
  const gkScore = gk ? startScore(gk, byTeam) : 0;

  if (fits.length) {
    const ranked = fits
      .map((f) => {
        const def = top(defs, f.def);
        const mid = top(mids, f.mid);
        const att = top(atts, f.att);
        const total = gkScore + scoreOf(def) + scoreOf(mid) + scoreOf(att);
        return { formation: f, def, mid, att, total };
      })
      .sort((a, b) => b.total - a.total);

    const best = ranked[0];
    return assemble(best, gk, players, byTeam, ranked);
  }

  // Notloesung: beste zehn Feldspieler egal welcher Position.
  const outfield = players
    .filter((p) => p.pos !== 1)
    .sort(cmp)
    .slice(0, 10);
  const def = outfield.filter((p) => p.pos === 2);
  const mid = outfield.filter((p) => p.pos === 3);
  const att = outfield.filter((p) => p.pos === 4);
  const formation: Formation = {
    name: `${def.length}-${mid.length}-${att.length}`,
    def: def.length,
    mid: mid.length,
    att: att.length,
  };
  const total = gkScore + scoreOf(outfield);
  return assemble({ formation, def, mid, att, total }, gk, players, byTeam, [
    { formation, total },
  ]);
}

function assemble<T extends Startable>(
  best: { formation: Formation; def: T[]; mid: T[]; att: T[]; total: number },
  gk: T | null,
  players: T[],
  byTeam: Map<number, Fixture[]>,
  ranked: { formation: Formation; total: number }[]
): Lineup<T> {
  const starters = ([] as T[])
    .concat(gk ? [gk] : [])
    .concat(best.def, best.mid, best.att);
  const startingIds = new Set(starters.map((p) => p.id));
  const bench = players
    .filter((p) => !startingIds.has(p.id))
    .sort(byScoreDesc<T>(byTeam));

  return {
    formation: best.formation,
    gk,
    def: best.def,
    mid: best.mid,
    att: best.att,
    starters,
    bench,
    expectedPoints: best.total,
    alternatives: ranked.map((r) => ({ formation: r.formation, total: r.total })),
  };
}

/* -------------------------------------------------- Wechsel-Empfehlungen */

export interface Replacement<O extends Startable, M extends MarketStartable> {
  /** Der Stammspieler, der weichen wuerde. */
  out: O;
  /** Der Marktspieler, der hereinkommt. */
  incoming: M;
  /** Zugewinn an Startwert (in erwarteten Punkten). */
  improvement: number;
  /**
   * Netto-Kosten des Tauschs: Maximalgebot minus dem Marktwert, den der
   * verkaufte Stammspieler wieder einbringt. Negativ = der Tausch spuelt Geld
   * in die Kasse.
   */
  netCost: number;
}

/**
 * Konkrete "ersetze X durch Y"-Vorschlaege.
 *
 * Verglichen wird positionsgleich: ein Marktspieler muss den Stammspieler auf
 * seiner Position um mindestens `minRatio` im Startwert schlagen. Bezahlbar
 * heisst: die Netto-Kosten (Maximalgebot abzueglich des Verkaufserloeses fuer
 * den Weichenden) passen ins Budget - das ist der Puffer, den der Verkauf des
 * ersetzten Spielers schafft.
 *
 * Gierig, aber eindeutig: jeder Stammspieler wird hoechstens einmal ersetzt
 * und jeder Marktspieler hoechstens einmal geholt, in der Reihenfolge des
 * groessten Zugewinns.
 */
export function suggestReplacements<O extends Startable, M extends MarketStartable>(
  starters: O[],
  market: M[],
  byTeam: Map<number, Fixture[]> = new Map(),
  opts: { budget?: number | null; minRatio?: number; max?: number } = {}
): Replacement<O, M>[] {
  const minRatio = opts.minRatio ?? DEFAULT_MIN_RATIO;
  const budget = opts.budget ?? null;
  const max = opts.max ?? 6;

  const ownIds = new Set(starters.map((p) => p.id));

  const pairs: Replacement<O, M>[] = [];
  for (const out of starters) {
    const outScore = startScore(out, byTeam);
    for (const incoming of market) {
      if (incoming.pos !== out.pos) continue;
      if (ownIds.has(incoming.id)) continue; // schon im eigenen Kader
      if (!isAvailable(incoming.status)) continue;

      const inScore = startScore(incoming, byTeam);
      if (inScore <= 0) continue;
      // Ohne Referenz (Stammspieler ohne Punkte) genuegt jeder echte Wert;
      // sonst muss der Zugewinn ueber der Schwelle liegen.
      if (outScore > 0 && inScore < outScore * minRatio) continue;

      const outValue = (out as unknown as { marketValue?: number }).marketValue ?? 0;
      const netCost = incoming.maxBid - outValue;
      if (budget !== null && netCost > budget) continue;

      pairs.push({ out, incoming, improvement: inScore - outScore, netCost });
    }
  }

  pairs.sort((a, b) => b.improvement - a.improvement || a.netCost - b.netCost);

  const usedOut = new Set<string>();
  const usedIn = new Set<string>();
  const chosen: Replacement<O, M>[] = [];
  for (const p of pairs) {
    if (usedOut.has(p.out.id) || usedIn.has(p.incoming.id)) continue;
    usedOut.add(p.out.id);
    usedIn.add(p.incoming.id);
    chosen.push(p);
    if (chosen.length >= max) break;
  }

  return chosen;
}
