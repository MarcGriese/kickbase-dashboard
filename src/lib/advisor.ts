/**
 * Bewertungslogik - portiert aus kickbase_advisor.py.
 *
 * Ehrliche Einordnung: Die API gibt die versteckten Maximalgebote deiner
 * Mitspieler NICHT her. Der "ligauebliche Aufschlag" unten wird aus real
 * abgeschlossenen Transfers im Aktivitaets-Feed geschaetzt (gezahlter Preis
 * gegen damaligen Marktwert). Das ist eine Heuristik, keine Wahrheit - die
 * Oberflaeche sagt das auch so.
 */

import { pick, pct } from "./fields";

export type Verdict = "verkaufen" | "halten" | "stark-halten";
export type MarketVerdict = "kaufen" | "beobachten" | "finger-weg";

export interface RatedPlayer {
  id: string;
  name: string;
  pos: number;
  marketValue: number;
  dayDelta: number;
  dayPct: number;
  average: number;
  points: number;
  totalGain: number;
  status: number;
  image: string | null;
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
  ratios.sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  const factor =
    ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;
  return { factor, samples: ratios.length };
}

function base(raw: Record<string, any>) {
  const marketValue = Number(pick(raw, "marketValue", 0)) || 0;
  const dayDelta = Number(pick(raw, "dayDelta", 0)) || 0;
  return {
    id: String(pick(raw, "id", "")),
    name: String(pick(raw, "name", "Unbekannt")),
    pos: Number(pick(raw, "pos", 0)) || 0,
    marketValue,
    dayDelta,
    dayPct: pct(dayDelta, marketValue),
    average: Number(pick(raw, "average", 0)) || 0,
    points: Number(pick(raw, "points", 0)) || 0,
    status: Number(pick(raw, "status", 0)) || 0,
    image: (pick(raw, "image", null) as string | null) ?? null,
  };
}

/** Bewertet einen Spieler aus deinem Kader. */
export function rateOwn(raw: Record<string, any>): RatedPlayer {
  const b = base(raw);
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

  if (b.average >= 150) {
    score += 2;
    reasons.push(`Schnitt ${b.average.toFixed(0)}`);
  } else if (b.average <= 60) {
    score -= 2;
    reasons.push(`nur ${b.average.toFixed(0)} Punkte im Schnitt`);
  }

  if (totalGain > 0 && b.dayPct < 0) {
    reasons.push("Gewinn steht im Feuer");
  }

  if (b.status !== 0) {
    score -= 2;
    reasons.push("nicht einsatzbereit");
  }

  const verdict: Verdict =
    score <= -2 ? "verkaufen" : score >= 2 ? "stark-halten" : "halten";

  return { ...b, totalGain, verdict, score, reasons };
}

/** Bewertet einen Spieler vom Transfermarkt. */
export function rateMarket(
  raw: Record<string, any>,
  overpay: number,
  budget: number | null
): RatedMarketPlayer {
  const b = base(raw);
  const price = Number(pick(raw, "price", b.marketValue)) || b.marketValue;
  const reasons: string[] = [];
  let score = 0;

  if (b.average >= 140) {
    score += 2;
    reasons.push(`Schnitt ${b.average.toFixed(0)}`);
  } else if (b.average >= 100) {
    score += 1;
    reasons.push(`Schnitt ${b.average.toFixed(0)}`);
  }

  if (b.dayPct >= 0.5) {
    score += 1;
    reasons.push("Marktwert zieht an");
  } else if (b.dayPct <= -1.0) {
    score -= 1;
    reasons.push("Marktwert faellt");
  }

  if (b.marketValue && price < b.marketValue * 0.98) {
    score += 2;
    reasons.push("unter Marktwert angeboten");
  } else if (b.marketValue && price > b.marketValue * 1.1) {
    score -= 1;
    reasons.push("deutlich ueber Marktwert");
  }

  if (b.status !== 0) {
    score -= 2;
    reasons.push("nicht einsatzbereit");
  }

  let maxBid = b.marketValue * overpay;
  if (score >= 3) maxBid *= 1.03; // bei einem echten Ziel etwas mutiger
  if (budget !== null) maxBid = Math.min(maxBid, budget);

  const affordable = budget === null || price <= budget;
  const verdict: MarketVerdict =
    score >= 2 && affordable ? "kaufen" : score <= -1 ? "finger-weg" : "beobachten";

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
