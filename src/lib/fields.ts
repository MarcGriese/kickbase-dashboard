/**
 * Kickbase liefert extrem kurze Feldnamen ("mv", "ap", "sdmvt", ...).
 * Diese Datei ist die einzige Stelle, an der diese Kuerzel auftauchen.
 * Wenn Kickbase die API aendert, passt du nur FIELDS an - sonst nichts.
 *
 * Verifiziert gegen die v4-Doku (Squad-Beispielantwort):
 *   mv     aktueller Marktwert
 *   p      Gesamtpunkte
 *   ap     Punkteschnitt
 *   tfhmvt Marktwertaenderung der letzten 24 Stunden (twenty four hour)
 *   sdmvt  Marktwertaenderung der letzten 7 Tage (seven day)
 *   mvgl   Gewinn/Verlust seit deinem Kauf
 *   st     Status (0 = fit)
 *   pos    Position (1 TW, 2 ABW, 3 MIT, 4 STU)
 *   tid    Verein
 *   pim    Spielerbild
 *
 * Achtung, das war lange vertauscht: "sdmvt" ist der 7-Tage-Wert, nicht der
 * Tageswert. Wer beides in denselben Topf wirft, zeigt eine Wochenbewegung
 * als "heute" an.
 */

const FIELDS = {
  id: ["i", "id", "pi"],
  firstName: ["fn", "firstName"],
  name: ["n", "ln", "lastName"],
  pos: ["pos"],
  marketValue: ["mv", "marketValue"],
  points: ["p", "totalPoints"],
  average: ["ap", "averagePoints"],
  dayDelta: ["tfhmvt"],
  weekDelta: ["sdmvt"],
  totalGain: ["mvgl"],
  buyPrice: ["prs", "buyPrice"],
  status: ["st", "status"],
  teamId: ["tid", "teamId"],
  teamName: ["tn", "teamName"],
  trend: ["mvt"],
  image: ["pim", "im", "image"],
  price: ["prc", "price"],
  expiry: ["exs", "expiry"],
  seller: ["unm", "usnm"],
  offers: ["ofc"],
} as const;

export type FieldKey = keyof typeof FIELDS;

/** Holt den ersten vorhandenen Wert aus den moeglichen Kuerzeln. */
export function pick<T = unknown>(
  raw: Record<string, unknown> | null | undefined,
  key: FieldKey,
  fallback?: T
): T {
  if (!raw) return fallback as T;
  for (const k of FIELDS[key]) {
    const v = raw[k];
    if (v !== undefined && v !== null) return v as T;
  }
  return fallback as T;
}

export const POSITIONS: Record<number, string> = {
  1: "TW",
  2: "ABW",
  3: "MIT",
  4: "STU",
};

export const POSITION_LABELS: Record<number, string> = {
  1: "Torwart",
  2: "Abwehr",
  3: "Mittelfeld",
  4: "Sturm",
};

export const STATUS: Record<number, string> = {
  0: "Fit",
  1: "Verletzt",
  2: "Angeschlagen",
  4: "Aufbautraining",
  8: "Gesperrt",
  16: "Nicht im Kader",
};

/* ------------------------------------------------------------------ Bilder */

const CDN = "https://kickbase.b-cdn.net";

/**
 * Kickbase liefert "pim" mal als volle URL, mal nur als Dateinamen.
 * Beides landet hier und kommt als absolute URL wieder raus.
 */
export function playerImage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("/")) return CDN + v;
  return `${CDN}/pool/playersbig/${v}`;
}

/** Vereinswappen zur Kickbase-Team-ID. */
export function teamCrest(teamId: number | string | null | undefined): string | null {
  if (teamId === null || teamId === undefined || teamId === "") return null;
  return `${CDN}/pool/teamsg/${teamId}.png`;
}

/* --------------------------------------------------------------- Formate */

/** 10.973.197 -> "10,97 Mio" */
export function eur(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "–";
  const v = Number(n);
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000)
    return `${sign}${(a / 1_000_000).toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} Mio`;
  if (a >= 1_000) return `${sign}${Math.round(a / 1_000)}k`;
  return `${sign}${Math.round(a)}`;
}

/** Immer mit Vorzeichen - fuer Deltas. */
export function eurDelta(n: number | null | undefined): string {
  if (!n) return "±0";
  return (n > 0 ? "+" : "") + eur(n);
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return (part / whole) * 100;
}

/** "Sa. 15.03., 15:30" - kompakt, deutsch, ohne Bibliothek. */
export function shortDate(d: Date | null | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
