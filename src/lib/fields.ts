/**
 * Kickbase liefert extrem kurze Feldnamen ("mv", "ap", "sdmvt", ...).
 * Diese Datei ist die einzige Stelle, an der diese Kuerzel auftauchen.
 * Wenn Kickbase die API aendert, passt du nur FIELDS an - sonst nichts.
 *
 * Verifiziert gegen die v4-Doku (Squad-Beispielantwort):
 *   mv    aktueller Marktwert
 *   p     Gesamtpunkte
 *   ap    Punkteschnitt
 *   sdmvt Marktwertaenderung seit gestern
 *   mvgl  Gewinn/Verlust seit deinem Kauf
 *   st    Status (0 = fit)
 *   pos   Position (1 TW, 2 ABW, 3 MIT, 4 STU)
 */

const FIELDS = {
  id: ["i", "id", "pi"],
  firstName: ["fn"],
  name: ["n", "ln", "lastName"],
  pos: ["pos"],
  marketValue: ["mv", "marketValue"],
  points: ["p", "totalPoints"],
  average: ["ap", "averagePoints"],
  dayDelta: ["sdmvt", "tfhmvt"],
  totalGain: ["mvgl"],
  status: ["st", "status"],
  teamId: ["tid", "teamId"],
  trend: ["mvt"],
  image: ["pim", "im", "pimg", "playerImage"],
  teamImage: ["tim", "teamImage", "tlogo"],
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

export const STATUS: Record<number, string> = {
  0: "Fit",
  1: "Verletzt",
  2: "Angeschlagen",
  4: "Aufbautraining",
  8: "Gesperrt",
  16: "Nicht im Kader",
};

/** 10.973.197 -> "10,97 Mio" */
export function eur(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "–";
  const v = Number(n);
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(2)} Mio`;
  if (a >= 1_000) return `${sign}${Math.round(a / 1_000)}k`;
  return `${sign}${Math.round(a)}`;
}

/*
 * eurDelta() ist mit dem Corporate Design entfallen. Das Vorzeichen ist dort
 * kein Textzeichen mehr, sondern das Plus/Minus-Motiv der Timestamps - es
 * wird in <Timestamp> getrennt vom Wert gesetzt. Wer ein vorzeichenbehaftetes
 * Textformat braucht, nimmt eur(Math.abs(n)) und setzt das Zeichen selbst.
 */

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return (part / whole) * 100;
}
