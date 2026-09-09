/**
 * Kickbase liefert extrem kurze Feldnamen ("mv", "ap", "sdmvt", ...).
 * Diese Datei ist die einzige Stelle, an der diese Kuerzel auftauchen.
 */

const FIELDS = {
  id: ["i", "id", "pi"],
  firstName: ["fn", "firstName"],
  name: ["n", "ln", "lastName"],
  pos: ["pos"],
  marketValue: ["mv", "marketValue"],
  points: ["p", "totalPoints"],
  average: ["ap", "averagePoints"],
  // v4: tfhmvt = 24h, sdmvt = 7 Tage.
  dayDelta: ["tfhmvt"],
  weekDelta: ["sdmvt"],
  totalGain: ["mvgl"],
  buyPrice: ["prs", "buyPrice"],
  status: ["st", "status"],
  teamId: ["tid", "teamId"],
  teamName: ["tn", "teamName"],
  trend: ["mvt"],
  image: ["pim", "im", "pimg", "playerImage"],
  teamImage: ["tim", "teamImage", "tlogo"],
  price: ["prc", "price"],
  expiry: ["exs", "expiry"],
  seller: ["unm", "usnm"],
  offers: ["ofc"],
} as const;

export type FieldKey = keyof typeof FIELDS;

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

const CDN = "https://kickbase.b-cdn.net";

export function playerImage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("/")) return CDN + v;
  return `${CDN}/pool/playersbig/${v}`;
}

export function teamCrest(teamId: number | string | null | undefined): string | null {
  if (teamId === null || teamId === undefined || teamId === "") return null;
  return `${CDN}/pool/teamsg/${teamId}.png`;
}

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
