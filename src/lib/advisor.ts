/** Bewertungslogik: Design-/Spielplan-Logik plus Snapshot-Verlauf und P/Mio. */
import { pick, pct, prognosisFrom, type StartProbability } from "./fields";
import { forecast, type Forecast } from "./forecast";
import type { Fixture } from "./fixtures";
import { startScore } from "./lineup";
import { playerImage, teamLogo } from "./images";
import type { PlayerTrend } from "./snapshot";

export type Verdict = "verkaufen" | "halten" | "stark-halten";
export type MarketVerdict = "kaufen" | "beobachten" | "finger-weg";

export interface RatedPlayer {
  id: string;
  name: string;
  fullName: string;
  pos: number;
  teamId: number;
  teamName: string;
  photo: string | null;
  logo: string | null;
  marketValue: number;
  dayDelta: number;
  dayPct: number;
  weekDelta: number;
  weekPct: number;
  average: number;
  points: number;
  ppm: number;
  totalGain: number;
  /** Erwartete Punkte am naechsten Spieltag (startScore aus lineup.ts). */
  expectedPoints: number;
  status: number;
  prognosis: StartProbability;
  /** Live-Punkte am laufenden Spieltag, falls die API sie liefert. */
  livePoints: number | null;
  image: string | null;
  trend: PlayerTrend | null;
  verdict: Verdict;
  score: number;
  reasons: string[];
  forecast: Forecast;
  fixtures: Fixture[];
}

export interface RatedMarketPlayer
  extends Omit<
    RatedPlayer,
    "verdict" | "totalGain" | "forecast" | "fixtures" | "expectedPoints"
  > {
  price: number;
  maxBid: number;
  verdict: MarketVerdict;
  expiry: number | null;
}

export interface RatingContext {
  fixturesByTeam?: Map<number, Fixture[]>;
  forecastDays?: number;
  medianPpm?: number;
  trends?: Map<string, PlayerTrend>;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function leagueOverpay(feed: Record<string, any>): { factor: number; samples: number } {
  const items: any[] = feed?.af ?? feed?.it ?? feed?.items ?? [];
  const ratios: number[] = [];
  for (const it of items) {
    const blob = it?.data ?? it;
    const price = Number(blob?.trp ?? blob?.prc ?? blob?.price);
    const mv = Number(blob?.mv ?? blob?.marketValue);
    if (mv > 0 && price > 0) {
      const r = price / mv;
      if (r > 0.3 && r < 5) ratios.push(r);
    }
  }
  if (ratios.length < 3) return { factor: 1.05, samples: 0 };
  return { factor: median(ratios), samples: ratios.length };
}

export function pointsPerMillion(average: number, marketValue: number): number {
  if (!marketValue || marketValue <= 0) return 0;
  return average / (marketValue / 1_000_000);
}

export function medianPpm(rows: Record<string, any>[]): number {
  const values = rows
    .map((r) => {
      const mv = Number(pick(r, "marketValue", 0)) || 0;
      const avg = Number(pick(r, "average", 0)) || 0;
      return avg > 0 && mv > 0 ? pointsPerMillion(avg, mv) : null;
    })
    .filter((v): v is number => v !== null);
  return median(values);
}

function scorePpm(ppm: number, average: number, reference: number, reasons: string[]): number {
  if (!reference || average <= 0 || ppm <= 0) {
    if (average <= 0) reasons.push("noch keine Punkte");
    return 0;
  }
  const ratio = ppm / reference;
  if (ratio >= 1.3) { reasons.push(`${ppm.toFixed(1)} Punkte je Mio – starker Gegenwert`); return 2; }
  if (ratio >= 1.1) { reasons.push(`${ppm.toFixed(1)} Punkte je Mio`); return 1; }
  if (ratio <= 0.6) { reasons.push(`nur ${ppm.toFixed(1)} Punkte je Mio – teuer für den Ertrag`); return -2; }
  if (ratio <= 0.85) { reasons.push(`${ppm.toFixed(1)} Punkte je Mio – unterdurchschnittlich`); return -1; }
  return 0;
}

function base(raw: Record<string, any>, trends?: Map<string, PlayerTrend>) {
  const marketValue = Number(pick(raw, "marketValue", 0)) || 0;
  const dayDelta = Number(pick(raw, "dayDelta", 0)) || 0;
  const weekDelta = Number(pick(raw, "weekDelta", 0)) || 0;
  const average = Number(pick(raw, "average", 0)) || 0;
  const id = String(pick(raw, "id", ""));
  const last = String(pick(raw, "name", "Unbekannt"));
  const first = String(pick(raw, "firstName", "")).trim();
  const teamId = Number(pick(raw, "teamId", 0)) || 0;
  const photo = playerImage(raw);
  return {
    id,
    name: last,
    fullName: first ? `${first} ${last}` : last,
    pos: Number(pick(raw, "pos", 0)) || 0,
    teamId,
    teamName: String(pick(raw, "teamName", "")).trim(),
    photo,
    logo: teamLogo(raw, teamId),
    marketValue,
    dayDelta,
    dayPct: pct(dayDelta, marketValue),
    weekDelta,
    weekPct: pct(weekDelta, marketValue),
    average,
    points: Number(pick(raw, "points", 0)) || 0,
    ppm: pointsPerMillion(average, marketValue),
    status: Number(pick(raw, "status", 0)) || 0,
    prognosis: prognosisFrom(raw),
    livePoints: (() => {
      const v = pick<number | null>(raw, "livePoints", null);
      return v === null || v === undefined ? null : Number(v);
    })(),
    image: photo,
    trend: trends?.get(id) ?? null,
  };
}

function fixtureNote(fixtures: Fixture[]): { points: number; reason: string | null } {
  if (!fixtures.length) return { points: 0, reason: null };
  const hard = fixtures.filter((f) => f.strength === "hart").length;
  const easy = fixtures.filter((f) => f.strength === "leicht").length;
  if (hard >= 2) return { points: -1, reason: `${hard} schwere Gegner` };
  if (easy >= 2) return { points: 1, reason: `${easy} dankbare Gegner` };
  return { points: 0, reason: null };
}

function scoreTrend(trend: PlayerTrend | null, dayPct: number, reasons: string[]): number {
  const week = trend?.d7;
  if (!week) return 0;
  let s = 0;
  if (week.pct <= -3) { s -= 2; reasons.push(`${week.pct.toFixed(1)} % in ${week.ageDays} Tagen`); }
  else if (week.pct <= -1) { s -= 1; reasons.push(`seit ${week.ageDays} Tagen leicht fallend`); }
  else if (week.pct >= 3) { s += 2; reasons.push(`+${week.pct.toFixed(1)} % in ${week.ageDays} Tagen`); }
  else if (week.pct >= 1) { s += 1; reasons.push(`seit ${week.ageDays} Tagen steigend`); }
  if (week.pct < -1 && dayPct > 0.3) reasons.push("dreht heute nach oben");
  if (week.pct > 1 && dayPct < -0.3) reasons.push("knickt heute ein");
  return s;
}

export function rateOwn(raw: Record<string, any>, context: RatingContext = {}): RatedPlayer {
  const b = base(raw, context.trends);
  const totalGain = Number(pick(raw, "totalGain", 0)) || 0;
  const fixtures = context.fixturesByTeam?.get(b.teamId) ?? [];
  const fc = forecast(b.marketValue, b.dayDelta, b.weekDelta, context.forecastDays ?? 3);
  const reasons: string[] = [];
  let score = 0;

  if (b.dayPct <= -0.8) { score -= 2; reasons.push(`verliert heute ${b.dayPct.toFixed(1)} %`); }
  else if (b.dayPct >= 0.8) { score += 2; reasons.push(`gewinnt heute ${b.dayPct.toFixed(1)} %`); }

  score += scoreTrend(b.trend, b.dayPct, reasons);
  score += scorePpm(b.ppm, b.average, context.medianPpm ?? 0, reasons);

  if (b.average >= 150) { score += 1; reasons.push(`Schnitt ${b.average.toFixed(0)}`); }
  else if (b.average <= 60 && b.average > 0) { score -= 1; reasons.push(`nur ${b.average.toFixed(0)} Punkte im Schnitt`); }

  if (totalGain > 0 && b.dayPct < 0) reasons.push("Gewinn steht im Feuer");
  if (b.status !== 0) { score -= 2; reasons.push("nicht einsatzbereit"); }

  const fx = fixtureNote(fixtures);
  score += fx.points;
  if (fx.reason) reasons.push(fx.reason);

  const verdict: Verdict = score <= -3 ? "verkaufen" : score >= 3 ? "stark-halten" : "halten";
  const expectedPoints = startScore(
    { id: b.id, pos: b.pos, teamId: b.teamId, average: b.average, status: b.status },
    context.fixturesByTeam ?? new Map()
  );
  return { ...b, totalGain, expectedPoints, verdict, score, reasons, forecast: fc, fixtures };
}

export function rateMarket(
  raw: Record<string, any>, overpay: number, budget: number | null, context: RatingContext = {}
): RatedMarketPlayer {
  const b = base(raw, context.trends);
  const price = Number(pick(raw, "price", b.marketValue)) || b.marketValue;
  const reasons: string[] = [];
  let score = 0;

  if (b.average >= 140) { score += 1; reasons.push(`Schnitt ${b.average.toFixed(0)}`); }
  score += scorePpm(pointsPerMillion(b.average, price), b.average, context.medianPpm ?? 0, reasons);
  score += scoreTrend(b.trend, b.dayPct, reasons);

  if (b.dayPct >= 0.5) { score += 1; reasons.push("Marktwert zieht an"); }
  else if (b.dayPct <= -1.0) { score -= 1; reasons.push("Marktwert fällt"); }
  if (b.marketValue && price < b.marketValue * 0.98) { score += 2; reasons.push("unter Marktwert angeboten"); }
  else if (b.marketValue && price > b.marketValue * 1.1) { score -= 1; reasons.push("deutlich über Marktwert"); }
  if (b.status !== 0) { score -= 2; reasons.push("nicht einsatzbereit"); }

  let maxBid = b.marketValue * overpay;
  if (score >= 4) maxBid *= 1.03;
  if (budget !== null) maxBid = Math.min(maxBid, budget);
  const affordable = budget === null || price <= budget;
  const verdict: MarketVerdict = score >= 3 && affordable ? "kaufen" : score <= -1 ? "finger-weg" : "beobachten";
  return { ...b, price, maxBid, verdict, score, reasons, expiry: (pick(raw, "expiry", null) as number | null) ?? null };
}
