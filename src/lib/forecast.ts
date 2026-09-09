/**
 * Marktwert-Prognose bis zum naechsten Spieltagsbeginn.
 *
 * Ehrliche Einordnung: Kickbase gibt seine Marktwert-Formel nicht heraus.
 * Was hier passiert, ist eine Fortschreibung der beiden Bewegungen, die die
 * API liefert - die letzten 24 Stunden und die letzten 7 Tage. Mehr ist es
 * nicht, und die Oberflaeche sagt das auch so.
 *
 * Modell:
 *   Tagesrate = 60 % letzte 24 h + 40 % Wochenschnitt (7 Tage / 7)
 *   Jeder weitere Tag zaehlt nur noch mit 85 % des Vortags, weil sich
 *   Marktwerttrends erfahrungsgemaess totlaufen statt linear weiterzurennen.
 */

/** Gewichtung der letzten 24 Stunden gegen den Wochenschnitt. */
const DAY_WEIGHT = 0.6;
/** Wie stark der Trend pro Tag ausklingt. */
const DECAY = 0.85;
/** Ohne bekannten Spieltagsbeginn rechnen wir auf diesen Horizont. */
const FALLBACK_DAYS = 3;

export interface Forecast {
  /** Erwartete Veraenderung bis zum Horizont. */
  delta: number;
  /** Marktwert am Horizont. */
  value: number;
  /** Tage, ueber die gerechnet wurde. */
  days: number;
}

/** Volle Tage bis zum Anstoss, mindestens 1. */
export function daysUntil(target: Date | null, from: Date = new Date()): number {
  if (!target || Number.isNaN(target.getTime())) return FALLBACK_DAYS;
  const ms = target.getTime() - from.getTime();
  if (ms <= 0) return 1;
  return Math.max(1, Math.min(14, Math.ceil(ms / 86_400_000)));
}

export function forecast(
  marketValue: number,
  dayDelta: number,
  weekDelta: number,
  days: number
): Forecast {
  const daily = DAY_WEIGHT * dayDelta + (1 - DAY_WEIGHT) * (weekDelta / 7);

  // Summe der abklingenden Tagesbeitraege: 1 + 0.85 + 0.85^2 + ...
  let factor = 0;
  for (let i = 0; i < days; i++) factor += DECAY ** i;

  const delta = Math.round(daily * factor);
  return { delta, value: Math.max(0, marketValue + delta), days };
}
