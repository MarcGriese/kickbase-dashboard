import { eur, eurDelta, POSITIONS, STATUS } from "@/lib/fields";
import type { RatedPlayer, RatedMarketPlayer } from "@/lib/advisor";
import type { Change, PlayerTrend } from "@/lib/snapshot";
import { PlayerAvatar } from "./PlayerAvatar";

/* ------------------------------------------------------------------ Badge */

const VERDICT_STYLES: Record<string, string> = {
  verkaufen: "bg-loss/15 text-loss border-loss/30",
  halten: "bg-pitch-700/60 text-chalk-muted border-pitch-600",
  "stark-halten": "bg-neon/15 text-neon border-neon/30",
  kaufen: "bg-neon/15 text-neon border-neon/30",
  beobachten: "bg-pitch-700/60 text-chalk-muted border-pitch-600",
  "finger-weg": "bg-loss/15 text-loss border-loss/30",
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
      className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-data-xs font-bold uppercase tracking-wide ${VERDICT_STYLES[verdict]}`}
    >
      {VERDICT_LABELS[verdict]}
    </span>
  );
}

/* ------------------------------------------------------------------ Delta */

export function Delta({ value, pct }: { value: number; pct?: number }) {
  const up = value > 0;
  const flat = value === 0;
  const color = flat ? "text-chalk-faint" : up ? "text-neon" : "text-loss";
  return (
    <span className={`num text-data-sm font-semibold ${color}`}>
      {eurDelta(value)}
      {pct !== undefined && !flat && (
        <span className="ml-1 text-data-xs opacity-70">
          {pct > 0 ? "+" : ""}
          {pct.toFixed(1)} %
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
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div
        className={`num mt-1.5 text-2xl font-bold tracking-tight ${
          accent ? "text-neon" : "text-chalk"
        }`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-data-xs text-chalk-faint">{hint}</div>}
    </div>
  );
}

/* ------------------------------------------------------------ Player rows */

function PositionChip({ pos }: { pos: number }) {
  return (
    <span className="w-9 shrink-0 rounded bg-pitch-700 px-1.5 py-0.5 text-center text-data-xs font-bold text-chalk-muted">
      {POSITIONS[pos] ?? "–"}
    </span>
  );
}

function Reasons({ reasons }: { reasons: string[] }) {
  if (!reasons.length) return null;
  return (
    <p className="mt-1 text-data-xs text-chalk-faint">{reasons.join(" · ")}</p>
  );
}

/* ------------------------------------------------- Punkte pro Million */

/**
 * Der Gegenwert. Wird gegen den Median der Gruppe eingefaerbt, nicht gegen
 * eine feste Zahl - was "gut" ist, haengt am Preisniveau der Saison.
 */
export function PpmCell({ ppm, median }: { ppm: number; median: number }) {
  const rated = median > 0 && ppm > 0;
  const color = !rated
    ? "text-chalk-faint"
    : ppm >= median * 1.1
      ? "text-neon"
      : ppm <= median * 0.85
        ? "text-loss"
        : "text-chalk-muted";

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
    body = <span className="num text-data-sm text-chalk-faint">–</span>;
  } else if (!week) {
    body = (
      <span className="text-data-xs text-chalk-faint">
        {trend.isNew ? "neu" : "–"}
      </span>
    );
  } else {
    const color =
      week.delta > 0 ? "text-neon" : week.delta < 0 ? "text-loss" : "text-chalk-faint";
    body = (
      <span className={`num text-data-sm font-semibold ${color}`}>
        {week.pct > 0 ? "+" : ""}
        {week.pct.toFixed(1)} %
      </span>
    );
  }

  return (
    <div className="hidden w-20 text-right lg:block">
      <div>{body}</div>
      <div className="label">
        {week ? `${week.ageDays} Tage` : "Verlauf"}
      </div>
    </div>
  );
}

/* ------------------------------------------- Zustand des Speichers */

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
      <p className="mb-6 rounded-card border border-pitch-600 bg-pitch-800/60 px-4 py-3 text-data-xs leading-relaxed text-chalk-faint">
        Noch kein Schnappschuss gespeichert. Der Verlauf bleibt leer, bis der
        nächtliche Lauf zum ersten Mal durch ist – ab dann vergleicht die App
        jeden Aufruf gegen den gespeicherten Stand.
      </p>
    );
  }

  const stale = ageDays !== null && ageDays > 2;
  return (
    <p
      className={`mb-6 rounded-card border px-4 py-3 text-data-xs leading-relaxed ${
        stale
          ? "border-loss/25 bg-loss/5 text-chalk-muted"
          : "border-pitch-600 bg-pitch-800/60 text-chalk-faint"
      }`}
    >
      Verglichen mit dem Stand vom{" "}
      <span className="num font-semibold text-chalk">{day}</span>
      {ageDays !== null && ageDays > 0 && ` (${ageDays} Tage her)`}. {count}{" "}
      {count === 1 ? "Schnappschuss" : "Schnappschüsse"} im Speicher.
      {stale && " Der nächtliche Lauf scheint zu hängen."}
    </p>
  );
}

export function SquadRow({ p, median }: { p: RatedPlayer; median: number }) {
  return (
    <li className="flex items-center gap-3 border-b border-pitch-700/70 px-4 py-3 last:border-0 hover:bg-pitch-800/60">
      <PlayerAvatar name={p.name} photo={p.photo} logo={p.logo} />
      <PositionChip pos={p.pos} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{p.name}</span>
          {p.status !== 0 && (
            <span className="shrink-0 text-data-xs font-medium text-loss">
              {STATUS[p.status] ?? "Ausfall"}
            </span>
          )}
        </div>
        <Reasons reasons={p.reasons} />
      </div>

      <div className="hidden w-14 text-right sm:block">
        <div className="num text-data-sm font-semibold">{p.average.toFixed(0)}</div>
        <div className="label">Schnitt</div>
      </div>

      <PpmCell ppm={p.ppm} median={median} />
      <TrendCell trend={p.trend} />

      <div className="w-24 text-right">
        <div className="num text-data-sm font-semibold">{eur(p.marketValue)}</div>
        <Delta value={p.dayDelta} pct={p.dayPct} />
      </div>

      <VerdictBadge verdict={p.verdict} />
    </li>
  );
}

export function MarketRow({ p, median }: { p: RatedMarketPlayer; median: number }) {
  const bargain = p.marketValue > 0 && p.price < p.marketValue;
  return (
    <li className="flex items-center gap-3 border-b border-pitch-700/70 px-4 py-3 last:border-0 hover:bg-pitch-800/60">
      <PlayerAvatar name={p.name} photo={p.photo} logo={p.logo} />
      <PositionChip pos={p.pos} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{p.name}</span>
          {p.status !== 0 && (
            <span className="shrink-0 text-data-xs font-medium text-loss">
              {STATUS[p.status] ?? "Ausfall"}
            </span>
          )}
        </div>
        <Reasons reasons={p.reasons} />
      </div>

      <PpmCell ppm={p.ppm} median={median} />
      <TrendCell trend={p.trend} />

      <div className="hidden w-24 text-right sm:block">
        <div className="num text-data-sm text-chalk-muted">{eur(p.marketValue)}</div>
        <div className="label">Marktwert</div>
      </div>

      <div className="w-24 text-right">
        <div
          className={`num text-data-sm font-semibold ${
            bargain ? "text-neon" : "text-chalk"
          }`}
        >
          {eur(p.price)}
        </div>
        <div className="label">Preis</div>
      </div>

      <div className="w-24 text-right">
        <div className="num text-data-sm font-bold text-neon">{eur(p.maxBid)}</div>
        <div className="label">Bis max.</div>
      </div>

      <VerdictBadge verdict={p.verdict} />
    </li>
  );
}

/* ----------------------------------------------------------- Empty states */

export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="card px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-data-sm text-chalk-faint">{hint}</p>
    </div>
  );
}
