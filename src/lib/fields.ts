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
  image: ["pim", "im", "pimg", "playerImage", "image"],
  teamImage: ["tim", "teamImage", "tlogo"],
  price: ["prc", "price"],
  expiry: ["exs", "expiry"],
  seller: ["unm", "usnm"],
  offers: ["ofc"],
  // Startelf-Prognose (blauer Stern / gruener Haken in der Kickbase-App).
  // Die Kuerzel sind NICHT bestaetigt - siehe prognosisFrom() weiter unten.
  prognosis: ["prg", "prob", "lineupProbability", "startProbability"],
  // Live-Punkte am laufenden Spieltag. Kuerzel NICHT bestaetigt; die
  // Oberflaeche zeigt sie nur, wenn wirklich ein Wert kommt und ein Spiel laeuft.
  livePoints: ["lp", "livePoints", "lpt"],
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

/* ---------------------------------------------------- Startelf-Prognose */

/**
 * Kickbases eigene Einschaetzung, ob ein Spieler auflaeuft - die Icons in der
 * App (blauer Stern = sichere Startelf, gruener Haken = wahrscheinlich, Bank,
 * fraglich, raus). Das ist etwas anderes als das Status-Feld (STATUS oben),
 * das nur Fitness/Verfuegbarkeit meint (fit, verletzt, gesperrt ...).
 */
export type StartProbability =
  | "start"
  | "wahrscheinlich"
  | "bank"
  | "fraglich"
  | "raus"
  | "unbekannt";

export const PROGNOSIS_LABELS: Record<Exclude<StartProbability, "unbekannt">, string> = {
  start: "Sichere Startelf",
  wahrscheinlich: "Wahrscheinlich",
  bank: "Bank",
  fraglich: "Fraglich",
  raus: "Draußen",
};

/** Bekannte Klartext-Werte auf die Prognose-Stufen abbilden. */
const PROGNOSIS_WORDS: Record<string, StartProbability> = {
  start: "start",
  starter: "start",
  startelf: "start",
  sure: "start",
  likely: "wahrscheinlich",
  probable: "wahrscheinlich",
  wahrscheinlich: "wahrscheinlich",
  bench: "bank",
  bank: "bank",
  doubtful: "fraglich",
  fraglich: "fraglich",
  questionable: "fraglich",
  out: "raus",
  raus: "raus",
};

/**
 * EHRLICHE EINSCHRAENKUNG: Ob die inoffizielle API die Startelf-Prognose
 * ueberhaupt herausgibt - und unter welchem Kuerzel und in welcher Kodierung -
 * ist nicht bestaetigt. Diese Funktion mappt deshalb nur Werte, die sie
 * zweifelsfrei erkennt (Klartext-Woerter), und gibt sonst "unbekannt" zurueck.
 * Die Oberflaeche zeigt bei "unbekannt" nichts an, statt eine geratene Zahl
 * als Stern oder Haken auszugeben.
 *
 * Sobald das echte Feld bekannt ist (z. B. per `python3 kickbase_advisor.py
 * --debug 2> raw.txt`), ist DIES die einzige Stelle, die angepasst werden
 * muss: das Kuerzel oben in FIELDS.prognosis ergaenzen und hier die numerische
 * Kodierung eintragen.
 */
export function prognosisFrom(raw: Record<string, unknown> | null | undefined): StartProbability {
  const v = pick<unknown>(raw, "prognosis", null);
  if (v === null || v === undefined) return "unbekannt";
  if (typeof v === "string") {
    const key = v.trim().toLowerCase();
    return PROGNOSIS_WORDS[key] ?? "unbekannt";
  }
  // Zahlencodes bewusst NICHT geraten - lieber nichts zeigen als Falsches.
  return "unbekannt";
}

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
  const id = Number(teamId);
  // teamId 0 / NaN kommt aus fehlgeschlagenem Parsen - dann lieber kein Bild
  // als eine sichere 404, die nur den Platzhalter flackern laesst.
  if (!Number.isFinite(id) || id <= 0) return null;
  // Einheitlich mit images.teamLogo (pool/teamsl); der frueher hier
  // hartkodierte Pfad "teamsg" wich davon ab und lud oft nichts.
  return `${CDN}/pool/teamsl/${id}.png`;
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

export function eurDelta(n: number | null | undefined): string {
  if (!n) return "±0";
  return (n > 0 ? "+" : "") + eur(n);
}

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
