import {
  eur,
  POSITIONS,
  STATUS,
  teamCrest,
  PROGNOSIS_LABELS,
  type StartProbability,
} from "@/lib/fields";
import type { Strength, Fixture } from "@/lib/fixtures";
import type { RatedPlayer, RatedMarketPlayer } from "@/lib/advisor";
import type { Change, PlayerTrend } from "@/lib/snapshot";
import { TeamCrest } from "./Media";
import { PlayerAvatar } from "./PlayerAvatar";
import { BrandLogo } from "./BrandLogo";

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
 *   Kaufen, Ausfall, ein Konto im Minus, ein schwerer Gegner. Auf einem
 *   normalen Spieltag faerbt das eine Handvoll Elemente - genau die
 *   Sparsamkeit, die die Guidelines fordern.
 *
 * KB Dark Grey kommt als Textfarbe NICHT vor. Auf KB Black erreicht es nur
 * 2,09:1 und faellt damit durch jede Lesbarkeitspruefung. Die Guidelines
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
  className = "",
}: {
  value: number;
  /** Bereits formatierter Wert, ohne Vorzeichen. */
  suffix: string;
  className?: string;
}) {
  const dir = direction(value);
  const sign = dir === "gain" ? "+" : dir === "loss" ? "−" : "±";
  return (
    <span
      className={`num inline-flex items-baseline gap-1 uppercase ${DIRECTION_TEXT[dir]} ${className}`}
    >
      <span aria-hidden className="text-[0.9em]">
        {sign}
      </span>
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ Marke */

/**
 * Hier stand eine selbstgezeichnete Marke - zwei gruene Balken, "der
 * Kickbase-Winkel". Das echte Zeichen ist ein Stern, und Gruen kommt in der
 * Marke ueberhaupt nicht vor.
 *
 * Jetzt liegt das Original aus dem Community Logo Kit in public/brand und
 * wird ueber BrandLogo eingebunden. Warum als Datei und nicht als Inline-SVG,
 * steht dort und in public/brand/README.md: die Policy verbietet Umfaerben,
 * und was nicht im Markup steht, kann keine CSS-Regel einfaerben.
 *
 * Guideline Placement: "The logomark should always be left-aligned."
 */
export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <BrandLogo variant="mark" height={18} />
      <span className="display text-sm">Kaderzentrale</span>
    </span>
  );
}

/* ------------------------------------------------------------------ Badge */

/**
 * Nur was Handlung verlangt, wird rot. "Halten" und "Beobachten" heissen
 * "tu nichts" und treten entsprechend zurueck; "Finger weg" tritt noch
 * weiter zurueck, statt wie bisher genauso laut zu sein wie "Verkaufen".
 */
const VERDICT_STYLES: Record<string, string> = {
  verkaufen: "bg-kb-red text-kb-black border-kb-red",
  kaufen: "bg-kb-red text-kb-black border-kb-red",
  "stark-halten": "bg-kb-white text-kb-black border-kb-white",
  halten: "bg-transparent text-kb-grey border-kb-line-strong",
  beobachten: "bg-transparent text-kb-grey border-kb-line-strong",
  "finger-weg": "bg-transparent text-kb-grey border-transparent",
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
      className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-data-xs font-bold uppercase tracking-wider ${VERDICT_STYLES[verdict]}`}
    >
      {VERDICT_LABELS[verdict]}
    </span>
  );
}

/* ------------------------------------------------------------------ Delta */

export function Delta({
  value,
  pct,
  className = "",
}: {
  value: number;
  pct?: number;
  className?: string;
}) {
  const dir = direction(value);
  return (
    <span className={`inline-block ${className}`}>
      <Timestamp
        value={value}
        suffix={eur(Math.abs(value))}
        className="text-data-sm font-semibold"
      />
      {pct !== undefined && dir !== "flat" && (
        // Eigene Zeile: sonst bricht der Prozentwert in engen Spalten um und
        // reisst die Zahl auseinander.
        <span className={`num block text-data-xs opacity-70 ${DIRECTION_TEXT[dir]}`}>
          {Math.abs(pct).toFixed(1)} %
        </span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------- Stat tile */

export function StatTile({
  label,
  value,
  hint,
  accent,
  tone = "neutral",
  big,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  tone?: "neutral" | "up" | "down" | "alert";
  big?: boolean;
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
      <div
        className={`num mt-1.5 font-extrabold tracking-tight ${
          big ? "text-2xl sm:text-[1.75rem]" : "text-xl"
        } ${color}`}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-data-xs leading-relaxed text-kb-grey">{hint}</div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Position */

export function PositionChip({ pos }: { pos: number }) {
  return (
    <span className="w-10 shrink-0 rounded bg-kb-raised px-1.5 py-0.5 text-center text-data-xs font-bold uppercase tracking-wider text-kb-grey-light">
      {POSITIONS[pos] ?? "–"}
    </span>
  );
}

export function StatusFlag({ status }: { status: number }) {
  if (status === 0) return null;
  return (
    /* Ausfall ist ein Moment, der Aufmerksamkeit verlangt - also Live Red. */
    <span className="shrink-0 rounded border border-kb-red px-1.5 text-data-xs font-bold uppercase tracking-wider text-kb-red">
      {STATUS[status] ?? "Ausfall"}
    </span>
  );
}

/* ----------------------------------------------------- Startelf-Prognose */

/**
 * Kickbases Startelf-Prognose. Wie beim Spielplan traegt die Helligkeit die
 * Bedeutung - die Marke kennt kein Gruen/Gelb. "Raus" ist das einzige, das
 * eine Reaktion verlangt, und bekommt deshalb den roten Akzent.
 *
 * Zeigt bewusst nichts bei "unbekannt": solange die API die Prognose nicht
 * bestaetigt herausgibt (siehe prognosisFrom in fields.ts), wird lieber keine
 * geratene Angabe gemacht als eine falsche.
 */
const PROGNOSIS_STYLES: Record<Exclude<StartProbability, "unbekannt">, string> = {
  start: "border-kb-line-strong text-kb-white",
  wahrscheinlich: "border-kb-line-strong text-kb-grey-light",
  bank: "border-kb-line text-kb-grey",
  fraglich: "border-kb-line text-kb-grey",
  raus: "border-kb-red text-kb-red",
};

const PROGNOSIS_GLYPH: Record<Exclude<StartProbability, "unbekannt">, string> = {
  start: "★",
  wahrscheinlich: "✓",
  bank: "▽",
  fraglich: "?",
  raus: "✕",
};

export function PrognosisFlag({ prognosis }: { prognosis: StartProbability }) {
  if (prognosis === "unbekannt") return null;
  return (
    <span
      title={`Startelf-Prognose: ${PROGNOSIS_LABELS[prognosis]}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 text-data-xs font-bold uppercase tracking-wider ${PROGNOSIS_STYLES[prognosis]}`}
    >
      <span aria-hidden>{PROGNOSIS_GLYPH[prognosis]}</span>
      {PROGNOSIS_LABELS[prognosis]}
    </span>
  );
}

/* --------------------------------------------------------------- Spielplan */

/**
 * Die Gegnerstaerke lief bisher auf einer Ampel: rot, gelb, gruen. Die Marke
 * hat weder Gruen noch Gelb, also traegt hier - wie bei den Zahlen - die
 * Helligkeit die Bedeutung:
 *
 *   leicht  KB White       hell, kein Grund hinzusehen
 *   mittel  KB Grey        zurueckgenommen
 *   hart    KB Live Red    das Spiel, das dir die Woche verderben kann
 *
 * Nur die harte Partie bekommt den Akzent, und das ist genau die, die eine
 * Entscheidung ausloest. Zusaetzlich steht in jedem Chip ohnehin "H" oder
 * "A" und im title-Attribut der Klartext, die Farbe ist also nicht der
 * einzige Traeger der Information.
 */
const STRENGTH_STYLES: Record<Strength, string> = {
  hart: "border-kb-red text-kb-red",
  mittel: "border-kb-line-strong text-kb-grey",
  leicht: "border-kb-line-strong text-kb-white",
};

const STRENGTH_WORDS: Record<Strength, string> = {
  hart: "schwerer Gegner",
  mittel: "ausgeglichen",
  leicht: "machbar",
};

/** Die naechsten Partien, rot/gelb/gruen nach Gegnerstaerke. */
export function FixtureStrip({ fixtures }: { fixtures: Fixture[] }) {
  if (!fixtures.length) {
    return <span className="text-data-xs text-kb-grey">kein Spielplan</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {fixtures.map((f) => (
        <span
          key={`${f.matchday}-${f.opponentId}`}
          title={`${f.home ? "Heim" : "Auswärts"} gegen ${f.opponentName} · ${STRENGTH_WORDS[f.strength]} · ${f.matchday}. Spieltag`}
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-data-xs font-semibold ${STRENGTH_STYLES[f.strength]}`}
        >
          <span className="opacity-60">{f.home ? "H" : "A"}</span>
          <TeamCrest
            src={teamCrest(f.opponentId)}
            name={f.opponentName}
            size={14}
            plain
          />
          {/* Eng: Kuerzel, sobald die Tabellenspalte greift; sonst der Name. */}
          <span className="hidden lg:inline">{f.opponentShort}</span>
          <span className="max-w-[6rem] truncate lg:hidden">{f.opponentName}</span>
        </span>
      ))}
    </div>
  );
}


/* ------------------------------------------------- Punkte pro Million */

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

/* ------------------------------------------------------------- Marktzeile */

function Reasons({ reasons }: { reasons: string[] }) {
  if (!reasons.length) return null;
  return (
    <p className="mt-1 text-data-xs text-kb-grey">{reasons.join(" · ")}</p>
  );
}

export function MarketRow({ p, median = 0 }: { p: RatedMarketPlayer; median?: number }) {
  const bargain = p.marketValue > 0 && p.price < p.marketValue;
  return (
    <li className="flex items-center gap-3 border-b border-kb-line/70 px-4 py-3 last:border-0 hover:bg-kb-raised/60">
      <PlayerAvatar name={p.fullName || p.name} photo={p.photo} logo={p.logo} />
      <PositionChip pos={p.pos} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{p.name}</span>
          <StatusFlag status={p.status} />
        </div>
        <Reasons reasons={p.reasons} />
      </div>

      <PpmCell ppm={p.ppm} median={median} />
      <TrendCell trend={p.trend} />

      <div className="hidden w-24 text-right sm:block">
        <div className="num text-data-sm text-kb-grey-light">{eur(p.marketValue)}</div>
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

/* ----------------------------------------------------------- Empty states */

export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="display text-base">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-body text-kb-grey">{hint}</p>
    </div>
  );
}
