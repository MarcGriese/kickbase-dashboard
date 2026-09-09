import { eur, POSITIONS, STATUS } from "@/lib/fields";
import type { RatedPlayer, RatedMarketPlayer } from "@/lib/advisor";
import type { Change, PlayerTrend } from "@/lib/snapshot";
import { PlayerAvatar } from "./PlayerAvatar";

/**
 * Kickbase Corporate Design.
 *
 * Die wichtigste Entscheidung in dieser Datei: die Marke kennt kein Gruen.
 * Die Palette ist Schwarz, Weiss, drei Grautoene und KB Live Red - und Rot
 * bedeutet dort ausdruecklich NICHT "negativ", sondern "moments of
 * importance, excitement, and emphasis".
 *
 * Deshalb die Aufteilung:
 *
 *   Zahlen und Verlauf tragen die Richtung ueber HELLIGKEIT plus Vorzeichen:
 *   Gewinn KB White, Verlust KB Light Grey, Stillstand KB Grey. Drei klar
 *   getrennte Stufen, und das Plus/Minus nennt die Richtung ohnehin - damit
 *   ist die Tabelle auch ohne Farbunterscheidung lesbar.
 *
 *   KB Live Red bleibt dem vorbehalten, was HANDLUNG verlangt: Verkaufen,
 *   Kaufen, Ausfall, ein haengender Schnappschuss. Auf einem normalen
 *   Spieltag faerbt das eine Handvoll Elemente - genau die Sparsamkeit,
 *   die die Guidelines fordern.
 *
 * KB Dark Grey kommt hier als Textfarbe NICHT vor. Auf KB Black erreicht es
 * nur 2,09:1 und faellt damit durch jede Lesbarkeitspruefung. Die Guidelines
 * geben die Paarung ausdruecklich nur fuer "layering, depth, and background
 * structure" frei - also fuer Rahmen und Flaechen, nicht fuer Schrift.
 */

/* --------------------------------------------------------------- Richtung */

type Direction = "gain" | "loss" | "flat";

function direction(value: number): Direction {
  if (value > 0) return "gain";
  if (value < 0) return "loss";
  return "flat";
}

/** Drei Helligkeitsstufen, alle ueber der Lesbarkeitsschwelle auf KB Black. */
const DIRECTION_TEXT: Record<Direction, string> = {
  gain: "text-kb-white", // 14,4:1
  loss: "text-kb-grey-light", // 8,2:1
  flat: "text-kb-grey", // 4,7:1
};

/* -------------------------------------------------------------- Timestamp */

/**
 * Das Timestamp-Motiv der Guidelines: ein Plus/Minus-Zeichen, gepaart mit
 * Text in Versalien. Im Original markiert es Spielereignisse auf dem
 * Punktraster - hier markiert es die Bewegung eines Marktwerts, was
 * derselbe Gedanke ist: ein Moment, an dem sich etwas geaendert hat.
 *
 * Das Vorzeichen ist nicht Dekoration. Es traegt die Richtung, damit die
 * Farbe sie nicht allein tragen muss.
 */
export function Timestamp({
  value,
  suffix,
  emphasis = false,
}: {
  value: number;
  /** Bereits formatierter Wert, ohne Vorzeichen. */
  suffix: string;
  emphasis?: boolean;
}) {
  const dir = direction(value);
  const sign = dir === "gain" ? "+" : dir === "loss" ? "−" : "±";

  return (
    <span
      className={`num inline-flex items-baseline gap-1 uppercase ${DIRECTION_TEXT[dir]} ${
        emphasis ? "text-headline-sm font-bold" : "text-data-sm font-semibold"
      }`}
    >
      <span aria-hidden className={emphasis ? "" : "text-[0.9em]"}>
        {sign}
      </span>
      {suffix}
    </span>
  );
}

/** Marktwert-Delta als Timestamp, mit optionalem Prozentwert dahinter. */
export function Delta({ value, pct }: { value: number; pct?: number }) {
  const dir = direction(value);
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <Timestamp value={value} suffix={eur(Math.abs(value))} />
      {pct !== undefined && dir !== "flat" && (
        <span className={`num text-data-xs ${DIRECTION_TEXT[dir]} opacity-60`}>
          {Math.abs(pct).toFixed(1)} %
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ Badge */

/**
 * Nur was Handlung verlangt, wird rot. "Halten" und "Beobachten" heissen
 * "tu nichts" und treten entsprechend zurueck.
 */
const VERDICT_STYLES: Record<string, string> = {
  verkaufen: "bg-kb-red text-kb-black border-kb-red",
  kaufen: "bg-kb-red text-kb-black border-kb-red",
  "stark-halten": "bg-kb-white text-kb-black border-kb-white",
  halten: "border-kb-line-strong text-kb-grey",
  beobachten: "border-kb-line-strong text-kb-grey",
  "finger-weg": "border-transparent text-kb-grey",
};

const VERDICT_LABELS: Record<string, string> = {
  verkaufen: "Verkaufen",
  halten: "Halten",
  "stark-halten": "Halten",
  kaufen: "Kaufen",
  beobachten: "Beobachten",
  "finger-weg": "Finger weg",
};

export function VerdictBadge({ verdict }: { verdict: string }) {
  return (
    <span
      className={`inline-flex w-[5.5rem] shrink-0 justify-center rounded border px-2 py-1 text-data-xs font-bold uppercase tracking-wide ${VERDICT_STYLES[verdict]}`}
    >
      {VERDICT_LABELS[verdict]}
    </span>
  );
}

/* -------------------------------------------------------------- Stat tile */

export function StatTile({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Wenn gesetzt, wird der Wert als Timestamp gesetzt statt als Text. */
  delta?: number;
}) {
  /**
   * "up" und "down" sind Richtungen, keine Warnungen - sie laufen deshalb
   * ueber dieselbe Helligkeitsstufe wie die Zahlen in der Tabelle, nicht
   * ueber den Akzent. Einzige Ausnahme ist ein Konto im Minus, das die
   * aufrufende Seite ausdruecklich als "alert" kennzeichnet: das ist eine
   * Regelverletzung und damit ein Fall fuer KB Live Red.
   */
  const color =
    tone === "alert"
      ? "text-kb-red"
      : tone === "up"
        ? "text-kb-white"
        : tone === "down"
          ? "text-kb-grey-light"
          : accent
            ? "text-kb-white"
            : "text-kb-white";

  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="mt-2">
        {delta !== undefined ? (
          <Timestamp value={delta} suffix={value} emphasis />
        ) : (
          <span className="num text-headline-sm font-bold tracking-tight text-kb-white">
            {value}
          </span>
        )}
      </div>
      {hint && <div className="mt-1.5 text-data-xs text-kb-grey">{hint}</div>}
    </div>
  );
}

/* --------------------------------------------------------------- Position */

export function PositionChip({ pos }: { pos: number }) {
  return (
    <span className="w-9 shrink-0 rounded border border-kb-line-strong px-1.5 py-0.5 text-center text-data-xs font-bold uppercase text-kb-grey">
      {POSITIONS[pos] ?? "–"}
    </span>
  );
}

export function StatusFlag({ status }: { status: number }) {
  if (status === 0) return null;
  return (
    <p className="mt-1 text-data-xs text-kb-grey">{reasons.join(" · ")}</p>
  );
}

/** Ausfall ist ein Moment, der Aufmerksamkeit verlangt - also Live Red. */
function StatusFlag({ status }: { status: number }) {
  if (status === 0) return null;
  return (
    <span className="shrink-0 text-data-xs font-bold uppercase tracking-wide text-kb-red">
      {STATUS[status] ?? "Ausfall"}
    </span>
  );
}

/* ------------------------------------------------- Punkte pro Million */

/**
 * Der Gegenwert, gemessen am Median der Gruppe. Bewusst ohne Rot: das ist
 * eine Kennzahl, keine Handlungsaufforderung.
 */
export function PpmCell({ ppm, median }: { ppm: number; median: number }) {
  const rated = median > 0 && ppm > 0;
  const color = !rated
    ? "text-kb-grey"
    : ppm >= median * 1.1
      ? "text-kb-white"
      : ppm <= median * 0.85
        ? "text-kb-grey"
        : "text-kb-grey-light";

  return (
    <div className="hidden w-16 text-right md:block">
      <div className={`num text-data-sm font-semibold ${color}`}>
        {ppm > 0 ? ppm.toFixed(1) : "–"}
      </div>
      <div className="label">P/Mio</div>
    </div>
  );
}

/* ------------------------------------------------------------- Verlauf */

/**
 * Der Wochenverlauf aus dem Schnappschuss-Speicher. Ohne gespeicherte
 * Staende steht hier bewusst ein Strich und keine Null - die App soll nicht
 * so tun, als wuesste sie etwas, das sie noch nicht weiss.
 */
export function TrendCell({ trend }: { trend: PlayerTrend | null }) {
  const week: Change | null = trend?.d7 ?? trend?.since ?? null;

  let body;
  if (!trend) {
    body = <span className="num text-data-sm text-kb-grey">–</span>;
  } else if (!week) {
    body = (
      <span className="text-data-xs uppercase text-kb-grey">
        {trend.isNew ? "neu" : "–"}
      </span>
    );
  } else {
    body = <Timestamp value={week.delta} suffix={`${Math.abs(week.pct).toFixed(1)} %`} />;
  }

  return (
    <div className="hidden w-24 text-right lg:block">
      <div>{body}</div>
      <div className="label">{week ? `${week.ageDays} Tage` : "Verlauf"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ Rows */

export function SquadRow({ p, median }: { p: RatedPlayer; median: number }) {
  return (
    <li className="flex items-center gap-3 border-b border-kb-line px-4 py-3 last:border-0 hover:bg-kb-raised">
      <PlayerAvatar name={p.name} photo={p.photo} logo={p.logo} />
      <PositionChip pos={p.pos} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-kb-white">{p.name}</span>
          <StatusFlag status={p.status} />
        </div>
        <Reasons reasons={p.reasons} />
      </div>

      <div className="hidden w-14 text-right sm:block">
        <div className="num text-data-sm font-semibold text-kb-grey-light">
          {p.average.toFixed(0)}
        </div>
        <div className="label">Schnitt</div>
      </div>

      <PpmCell ppm={p.ppm} median={median} />
      <TrendCell trend={p.trend} />

      <div className="w-28 text-right">
        <div className="num text-data-sm font-semibold text-kb-white">
          {eur(p.marketValue)}
        </div>
        <Delta value={p.dayDelta} pct={p.dayPct} />
      </div>
      <div className="label">P/Mio</div>
    </div>
  );
}

export function TrendCell({ trend }: { trend: PlayerTrend | null }) {
  const week: Change | null = trend?.d7 ?? trend?.since ?? null;
  let body;
  if (!trend) body = <span className="num text-data-sm text-kb-grey">–</span>;
  else if (!week) body = <span className="text-data-xs text-kb-grey">{trend.isNew ? "neu" : "–"}</span>;
  else {
    body = (
      <Timestamp
        value={week.delta}
        suffix={`${Math.abs(week.pct).toFixed(1)} %`}
        className="text-data-sm font-semibold"
      />
    );
  }
  return (
    <div className="hidden w-20 text-right lg:block">
      <div>{body}</div>
      <div className="label">{week ? `${week.ageDays} Tage` : "Verlauf"}</div>
    </div>
  );
}

export function SnapshotNotice({ day, ageDays, count }: { day: string | null; ageDays: number | null; count: number }) {
  if (!day) {
    return (
      <p className="mb-6 rounded-card border border-kb-line bg-kb-surface/90 px-4 py-3 text-data-xs leading-relaxed text-kb-grey">
        Noch kein Schnappschuss gespeichert. Der Verlauf bleibt leer, bis der nächtliche Lauf zum ersten Mal durch ist.
      </p>
    );
  }
  const stale = ageDays !== null && ageDays > 2;
  return (
    <p className={`mb-6 rounded-card px-4 py-3 text-data-xs leading-relaxed ${stale ? "border-l-2 border-kb-red bg-kb-surface/90 text-kb-grey-light" : "border border-kb-line bg-kb-surface/90 text-kb-grey"}`}>
      Verglichen mit dem Stand vom <span className="num font-semibold text-kb-white">{day}</span>
      {ageDays !== null && ageDays > 0 && ` (${ageDays} Tage her)`}. {count} {count === 1 ? "Schnappschuss" : "Schnappschüsse"} im Speicher.
      {stale && " Der nächtliche Lauf scheint zu hängen."}
    </p>
  );
}

export function SquadRow({ p, median }: { p: RatedPlayer; median: number }) {
  return (
    <li className="flex items-center gap-3 border-b border-kb-line/70 px-4 py-3 last:border-0 hover:bg-kb-raised/60">
      <PlayerAvatar name={p.fullName || p.name} photo={p.photo} logo={p.logo} />
      <PositionChip pos={p.pos} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><span className="truncate font-semibold">{p.fullName || p.name}</span><StatusFlag status={p.status} /></div>
        <Reasons reasons={p.reasons} />
      </div>
      <div className="hidden w-14 text-right sm:block"><div className="num text-data-sm font-semibold">{p.average.toFixed(0)}</div><div className="label">Schnitt</div></div>
      <PpmCell ppm={p.ppm} median={median} />
      <TrendCell trend={p.trend} />
      <div className="w-24 text-right"><div className="num text-data-sm font-semibold">{eur(p.marketValue)}</div><Delta value={p.dayDelta} pct={p.dayPct} /></div>
      <VerdictBadge verdict={p.verdict} />
    </li>
  );
}

export function MarketRow({ p, median }: { p: RatedMarketPlayer; median: number }) {
  const bargain = p.marketValue > 0 && p.price < p.marketValue;
  return (
    <li className="flex items-center gap-3 border-b border-kb-line px-4 py-3 last:border-0 hover:bg-kb-raised">
      <PlayerAvatar name={p.name} photo={p.photo} logo={p.logo} />
      <PositionChip pos={p.pos} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-kb-white">{p.name}</span>
          <StatusFlag status={p.status} />
        </div>
        <Reasons reasons={p.reasons} />
      </div>

      <PpmCell ppm={p.ppm} median={median} />
      <TrendCell trend={p.trend} />

      <div className="hidden w-24 text-right sm:block">
        <div className="num text-data-sm text-kb-grey">{eur(p.marketValue)}</div>
        <div className="label">Marktwert</div>
      </div>

      <div className="w-24 text-right">
        <div
          className={`num text-data-sm font-semibold ${
            bargain ? "text-kb-white" : "text-kb-grey-light"
          }`}
        >
          {eur(p.price)}
        </div>
        <div className="label">Preis</div>
      </div>

      <div className="w-24 text-right">
        <div className="num text-data-sm font-bold text-kb-white">{eur(p.maxBid)}</div>
        <div className="label">Bis max.</div>
      </div>

      <VerdictBadge verdict={p.verdict} />
    </li>
  );
}

/* ------------------------------------------------------------- Hinweise */

/**
 * Der Handlungsstreifen. Das einzige grossflaechig rote Element der Seite,
 * und nur dann sichtbar, wenn es wirklich etwas zu tun gibt.
 */
export function ActionStrip({
  title,
  names,
}: {
  title: string;
  names: string[];
}) {
  if (!names.length) return null;
  return (
    <div className="mb-6 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-card border-l-2 border-kb-red bg-kb-surface/90 px-4 py-3">
      <span className="text-data-xs font-bold uppercase tracking-wide text-kb-red">
        {title}
      </span>
      <span className="text-body text-kb-grey-light">{names.join(", ")}</span>
    </div>
  );
}

/** Sagt in einer Zeile, wie alt der gespeicherte Vergleichsstand ist. */
export function SnapshotNotice({
  day,
  ageDays,
  count,
}: {
  day: string | null;
  ageDays: number | null;
  count: number;
}) {
  if (!day) {
    return (
      <p className="mb-6 rounded-card border border-kb-line bg-kb-surface/90 px-4 py-3 text-data-xs leading-relaxed text-kb-grey">
        Noch kein Schnappschuss gespeichert. Der Verlauf bleibt leer, bis der
        nächtliche Lauf zum ersten Mal durch ist – ab dann vergleicht die App
        jeden Aufruf gegen den gespeicherten Stand.
      </p>
    );
  }

  const stale = ageDays !== null && ageDays > 2;
  return (
    <p
      className={`mb-6 rounded-card bg-kb-surface/90 px-4 py-3 text-data-xs leading-relaxed text-kb-grey ${
        stale ? "border-l-2 border-kb-red" : "border border-kb-line"
      }`}
    >
      Verglichen mit dem Stand vom{" "}
      <span className="num font-semibold text-kb-white">{day}</span>
      {ageDays !== null && ageDays > 0 && ` (${ageDays} Tage her)`}. {count}{" "}
      {count === 1 ? "Schnappschuss" : "Schnappschüsse"} im Speicher.
      {stale && " Der nächtliche Lauf scheint zu hängen."}
    </p>
  );
}

/* ----------------------------------------------------------- Empty states */

export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="kb-headline text-kb-white">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-body text-kb-grey">{hint}</p>
    </div>
  );
}
