/**
 * Bewertungslogik - portiert aus kickbase_advisor.py.
 *
 * Ehrliche Einordnung: Die API gibt die versteckten Maximalgebote deiner
 * Mitspieler NICHT her. Der "ligauebliche Aufschlag" unten wird aus real
 * abgeschlossenen Transfers im Aktivitaets-Feed geschaetzt (gezahlter Preis
 * gegen damaligen Marktwert). Das ist eine Heuristik, keine Wahrheit - die
 * Oberflaeche sagt das auch so.
 *
 * Drei Signale gehen ein:
 *   1. Marktwert - der Tagesschritt von Kickbase und, sobald der
 *      Schnappschuss-Speicher gefuellt ist, der Verlauf ueber Tage.
 *   2. Punkte - nicht roh, sondern pro Million Marktwert. Das ist die
 *      eigentliche Waehrung: ein Abwehrspieler mit maessigem Schnitt zum
 *      halben Preis schlaegt den teuren Stuermer, weil das freie Budget
 *      den naechsten Steiger kauft.
 *   3. Einsatzfaehigkeit - verletzt, gesperrt, nicht im Kader.
 */

import { pick, pct } from "./fields";
import { playerImage, teamLogo } from "./images";
import type { PlayerTrend } from "./snapshot";

export type Verdict = "verkaufen" | "halten" | "stark-halten";
export type MarketVerdict = "kaufen" | "beobachten" | "finger-weg";

export interface RatedPlayer {
  id: string;
  name: string;
  pos: number;
  teamId: string | null;
  photo: string | null;
  logo: string | null;
  marketValue: number;
  dayDelta: number;
  dayPct: number;
  average: number;
  points: number;
  /** Punkteschnitt pro Million Marktwert. */
  ppm: number;
  totalGain: number;
  status: number;
  image: string | null;
  trend: PlayerTrend | null;
  verdict: Verdict;
  score: number;
  reasons: string[];
}

export interface RatedMarketPlayer extends Omit<RatedPlayer, "verdict" | "totalGain"> {
  price: number;
  maxBid: number;
  verdict: MarketVerdict;
  expiry: number | null;
}

/** Bewertungs-Kontext: woran der einzelne Spieler gemessen wird. */
export interface RatingContext {
  /** Median der Punkte pro Million ueber die betrachtete Gruppe. */
  medianPpm: number;
  /** Verlauf aus dem Schnappschuss-Speicher, nach Spieler-ID. */
  trends?: Map<string, PlayerTrend>;
}

/* ------------------------------------------------------------------ Median */

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median der Preis/Marktwert-Verhaeltnisse aus dem Aktivitaets-Feed. */
export function leagueOverpay(feed: Record<string, any>): {
  factor: number;
  samples: number;
} {
  const items: any[] = feed?.af ?? feed?.it ?? feed?.items ?? [];
  const ratios: number[] = [];

  for (const it of items) {
    const blob = it?.data ?? it;
    const price = Number(blob?.trp ?? blob?.prc ?? blob?.price);
    const mv = Number(blob?.mv ?? blob?.marketValue);
    if (mv > 0 && price > 0) {
      const r = price / mv;
      // Ausreisser raus - Fehlparsings und Kickbase-Zwangsverkaeufe.
      if (r > 0.3 && r < 5) ratios.push(r);
    }
  }

  if (ratios.length < 3) return { factor: 1.05, samples: 0 };
  return { factor: median(ratios), samples: ratios.length };
}

/* --------------------------------------------------- Punkte pro Million */

/**
 * Punkteschnitt je Million Marktwert.
 *
 * Absolute Schwellen waeren hier wertlos - was "gut" ist, haengt vom
 * Preisniveau der Saison ab. Deshalb wird immer gegen den Median der
 * jeweiligen Gruppe verglichen, nie gegen eine feste Zahl.
 */
export function pointsPerMillion(average: number, marketValue: number): number {
  if (!marketValue || marketValue <= 0) return 0;
  return average / (marketValue / 1_000_000);
}

/** Median der Punkte pro Million ueber eine Liste von Rohdatensaetzen. */
export function medianPpm(rows: Record<string, any>[]): number {
  const values = rows
    .map((r) => {
      const mv = Number(pick(r, "marketValue", 0)) || 0;
      const avg = Number(pick(r, "average", 0)) || 0;
      // Spieler ohne einen einzigen Einsatz verzerren den Median nach unten.
      return avg > 0 && mv > 0 ? pointsPerMillion(avg, mv) : null;
    })
    .filter((v): v is number => v !== null);

  return median(values);
}

/** Bewertet den Gegenwert und haengt die Begruendung an. */
function scorePpm(
  ppm: number,
  average: number,
  reference: number,
  reasons: string[]
): number {
  if (!reference || average <= 0 || ppm <= 0) {
    if (average <= 0) reasons.push("noch keine Punkte");
    return 0;
  }

  const ratio = ppm / reference;
  if (ratio >= 1.3) {
    reasons.push(`${ppm.toFixed(1)} Punkte je Mio – starker Gegenwert`);
    return 2;
  }
  if (ratio >= 1.1) {
    reasons.push(`${ppm.toFixed(1)} Punkte je Mio`);
    return 1;
  }
  if (ratio <= 0.6) {
    reasons.push(`nur ${ppm.toFixed(1)} Punkte je Mio – teuer für den Ertrag`);
    return -2;
  }
  if (ratio <= 0.85) {
    reasons.push(`${ppm.toFixed(1)} Punkte je Mio – unterdurchschnittlich`);
    return -1;
  }
  return 0;
}

/* ------------------------------------------------------------- Grunddaten */

function base(raw: Record<string, any>, trends?: Map<string, PlayerTrend>) {
  const marketValue = Number(pick(raw, "marketValue", 0)) || 0;
  const dayDelta = Number(pick(raw, "dayDelta", 0)) || 0;
  const average = Number(pick(raw, "average", 0)) || 0;
  const id = String(pick(raw, "id", ""));
  const rawTeamId = pick<string | number | null>(raw, "teamId", null);
  const teamId =
    rawTeamId === null || rawTeamId === undefined ? null : String(rawTeamId);
  const photo = playerImage(raw);

  return {
    id,
    name: String(pick(raw, "name", "Unbekannt")),
    pos: Number(pick(raw, "pos", 0)) || 0,
    teamId,
    photo,
    logo: teamLogo(raw, teamId),
    marketValue,
    dayDelta,
    dayPct: pct(dayDelta, marketValue),
    average,
    points: Number(pick(raw, "points", 0)) || 0,
    ppm: pointsPerMillion(average, marketValue),
    status: Number(pick(raw, "status", 0)) || 0,
    // Beibehalten fuer Aufrufer, die das alte Feld lesen.
    image: photo,
    trend: trends?.get(id) ?? null,
  };
}

/**
 * Verlauf aus dem Schnappschuss-Speicher bewerten.
 *
 * Der Tagesschritt von Kickbase ist verrauscht - ein einzelnes Minus sagt
 * wenig. Eine Woche in dieselbe Richtung sagt viel. Erst mit gespeicherten
 * Staenden kann die App diesen Unterschied ueberhaupt sehen.
 */
function scoreTrend(trend: PlayerTrend | null, dayPct: number, reasons: string[]): number {
  const week = trend?.d7;
  if (!week) return 0;

  let s = 0;
  if (week.pct <= -3) {
    s -= 2;
    reasons.push(`${week.pct.toFixed(1)} % in ${week.ageDays} Tagen`);
  } else if (week.pct <= -1) {
    s -= 1;
    reasons.push(`seit ${week.ageDays} Tagen leicht fallend`);
  } else if (week.pct >= 3) {
    s += 2;
    reasons.push(`+${week.pct.toFixed(1)} % in ${week.ageDays} Tagen`);
  } else if (week.pct >= 1) {
    s += 1;
    reasons.push(`seit ${week.ageDays} Tagen steigend`);
  }

  // Wendepunkte sind die interessanteste Information im Verlauf.
  if (week.pct < -1 && dayPct > 0.3) reasons.push("dreht heute nach oben");
  if (week.pct > 1 && dayPct < -0.3) reasons.push("knickt heute ein");

  return s;
}

/* ------------------------------------------------------------ Eigener Kader */

/** Bewertet einen Spieler aus deinem Kader. */
export function rateOwn(
  raw: Record<string, any>,
  ctx: RatingContext = { medianPpm: 0 }
): RatedPlayer {
  const b = base(raw, ctx.trends);
  const totalGain = Number(pick(raw, "totalGain", 0)) || 0;
  const reasons: string[] = [];
  let score = 0;

  if (b.dayPct <= -0.8) {
    score -= 2;
    reasons.push(`verliert heute ${b.dayPct.toFixed(1)} %`);
  } else if (b.dayPct >= 0.8) {
    score += 2;
    reasons.push(`gewinnt heute ${b.dayPct.toFixed(1)} %`);
  }

  score += scoreTrend(b.trend, b.dayPct, reasons);
  score += scorePpm(b.ppm, b.average, ctx.medianPpm, reasons);

  if (b.average >= 150) {
    score += 1;
    reasons.push(`Schnitt ${b.average.toFixed(0)}`);
  } else if (b.average <= 60 && b.average > 0) {
    score -= 1;
    reasons.push(`nur ${b.average.toFixed(0)} Punkte im Schnitt`);
  }

  if (totalGain > 0 && b.dayPct < 0) {
    reasons.push("Gewinn steht im Feuer");
  }

  if (b.status !== 0) {
    score -= 2;
    reasons.push("nicht einsatzbereit");
  }

  // Schwelle bei drei: ein einzelnes Signal soll noch keinen Verkauf ausloesen.
  const verdict: Verdict =
    score <= -3 ? "verkaufen" : score >= 3 ? "stark-halten" : "halten";

  return { ...b, totalGain, verdict, score, reasons };
}

/* ------------------------------------------------------------ Transfermarkt */

/** Bewertet einen Spieler vom Transfermarkt. */
export function rateMarket(
  raw: Record<string, any>,
  overpay: number,
  budget: number | null,
  ctx: RatingContext = { medianPpm: 0 }
): RatedMarketPlayer {
  const b = base(raw, ctx.trends);
  const price = Number(pick(raw, "price", b.marketValue)) || b.marketValue;
  const reasons: string[] = [];
  let score = 0;

  if (b.average >= 140) {
    score += 1;
    reasons.push(`Schnitt ${b.average.toFixed(0)}`);
  }

  // Beim Kauf zaehlt der Gegenwert auf den PREIS, nicht auf den Marktwert -
  // ein Schnaeppchen verbessert die Rendite, ein Aufschlag frisst sie auf.
  const ppmAtPrice = pointsPerMillion(b.average, price);
  score += scorePpm(ppmAtPrice, b.average, ctx.medianPpm, reasons);

  score += scoreTrend(b.trend, b.dayPct, reasons);

  if (b.dayPct >= 0.5) {
    score += 1;
    reasons.push("Marktwert zieht an");
  } else if (b.dayPct <= -1.0) {
    score -= 1;
    reasons.push("Marktwert fällt");
  }

  if (b.marketValue && price < b.marketValue * 0.98) {
    score += 2;
    reasons.push("unter Marktwert angeboten");
  } else if (b.marketValue && price > b.marketValue * 1.1) {
    score -= 1;
    reasons.push("deutlich über Marktwert");
  }

  if (b.status !== 0) {
    score -= 2;
    reasons.push("nicht einsatzbereit");
  }

  let maxBid = b.marketValue * overpay;
  if (score >= 4) maxBid *= 1.03; // bei einem echten Ziel etwas mutiger
  if (budget !== null) maxBid = Math.min(maxBid, budget);

  const affordable = budget === null || price <= budget;
  const verdict: MarketVerdict =
    score >= 3 && affordable ? "kaufen" : score <= -1 ? "finger-weg" : "beobachten";

  return {
    ...b,
    price,
    maxBid,
    verdict,
    score,
    reasons,
    expiry: (pick(raw, "expiry", null) as number | null) ?? null,
  };
}
