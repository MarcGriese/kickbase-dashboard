import { eur, eurDelta, POSITIONS, STATUS, teamCrest } from "@/lib/fields";
import type { Strength, Fixture } from "@/lib/fixtures";
import type { RatedPlayer, RatedMarketPlayer } from "@/lib/advisor";
import type { Change, PlayerTrend } from "@/lib/snapshot";
import { TeamCrest } from "./Media";
import { PlayerAvatar } from "./PlayerAvatar";

/* ------------------------------------------------------------------ Marke */

/** Der Kickbase-Winkel: zwei Balken, gruen auf schwarz. */
export function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path d="M4 3h5v18H4z" className="fill-kb" />
      <path d="M20 3l-7 9 7 9h-6l-4-5.4V8.4L14 3z" className="fill-kb" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <BrandMark />
      <span className="display text-sm">Kaderzentrale</span>
    </span>
  );
}

/* ------------------------------------------------------------------ Badge */

const VERDICT_STYLES: Record<string, string> = {
  verkaufen: "bg-down/15 text-down border-down/30",
  halten: "bg-night-800 text-snow-muted border-night-600",
  "stark-halten": "bg-kb/15 text-kb border-kb/30",
  kaufen: "bg-kb/15 text-kb border-kb/30",
  beobachten: "bg-night-800 text-snow-muted border-night-600",
  "finger-weg": "bg-down/15 text-down border-down/30",
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
  const up = value > 0;
  const flat = value === 0;
  const color = flat ? "text-snow-faint" : up ? "text-kb" : "text-down";
  return (
    <span className={`num text-data-sm font-semibold ${color} ${className}`}>
      {eurDelta(value)}
      {pct !== undefined && !flat && (
        // Eigene Zeile: sonst bricht der Prozentwert in engen Spalten um und
        // reisst die Zahl auseinander.
        <span className="block text-data-xs opacity-70">
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
  tone = "neutral",
  big,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  tone?: "neutral" | "up" | "down";
  big?: boolean;
}) {
  const color =
    tone === "up"
      ? "text-kb"
      : tone === "down"
        ? "text-down"
        : accent
          ? "text-kb"
          : "text-snow";

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
        <div className="mt-1 text-data-xs leading-relaxed text-snow-faint">{hint}</div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Position */

export function PositionChip({ pos }: { pos: number }) {
  return (
    <span className="w-10 shrink-0 rounded bg-night-800 px-1.5 py-0.5 text-center text-data-xs font-bold uppercase tracking-wider text-snow-muted">
      {POSITIONS[pos] ?? "ÔÇô"}
    </span>
  );
}

export function StatusFlag({ status }: { status: number }) {
  if (status === 0) return null;
  return (
    <span className="shrink-0 rounded border border-down/30 bg-down/10 px-1.5 text-data-xs font-bold uppercase tracking-wider text-down">
      {STATUS[status] ?? "Ausfall"}
    </span>
  );
}

/* --------------------------------------------------------------- Spielplan */

const STRENGTH_STYLES: Record<Strength, string> = {
  hart: "border-down/40 bg-down/10 text-down",
  mittel: "border-warn/40 bg-warn/10 text-warn",
  leicht: "border-kb/40 bg-kb/10 text-kb",
};

const STRENGTH_WORDS: Record<Strength, string> = {
  hart: "schwerer Gegner",
  mittel: "ausgeglichen",
  leicht: "machbar",
};

/** Die naechsten Partien, rot/gelb/gruen nach Gegnerstaerke. */
export function FixtureStrip({ fixtures }: { fixtures: Fixture[] }) {
  if (!fixtures.length) {
    return <span className="text-data-xs text-snow-faint">kein Spielplan</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {fixtures.map((f) => (
        <span
          key={`${f.matchday}-${f.opponentId}`}
          title={`${f.home ? "Heim" : "Ausw├ñrts"} gegen ${f.opponentName} ┬À ${STRENGTH_WORDS[f.strength]} ┬À ${f.matchday}. Spieltag`}
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
    ? "text-snow-faint"
    : ppm >= median * 1.1
      ? "text-kb"
      : ppm <= median * 0.85
        ? "text-down"
        : "text-snow-muted";

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
  if (!trend) body = <span className="num text-data-sm text-snow-faint">–</span>;
  else if (!week) body = <span className="text-data-xs text-snow-faint">{trend.isNew ? "neu" : "–"}</span>;
  else {
    const color = week.delta > 0 ? "text-kb" : week.delta < 0 ? "text-down" : "text-snow-faint";
    body = <span className={`num text-data-sm font-semibold ${color}`}>{week.pct > 0 ? "+" : ""}{week.pct.toFixed(1)} %</span>;
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
      <p className="mb-6 rounded-card border border-night-600 bg-night-800/60 px-4 py-3 text-data-xs leading-relaxed text-snow-faint">
        Noch kein Schnappschuss gespeichert. Der Verlauf bleibt leer, bis der nächtliche Lauf zum ersten Mal durch ist.
      </p>
    );
  }
  const stale = ageDays !== null && ageDays > 2;
  return (
    <p className={`mb-6 rounded-card border px-4 py-3 text-data-xs leading-relaxed ${stale ? "border-down/25 bg-down/5 text-snow-muted" : "border-night-600 bg-night-800/60 text-snow-faint"}`}>
      Verglichen mit dem Stand vom <span className="num font-semibold text-snow">{day}</span>
      {ageDays !== null && ageDays > 0 && ` (${ageDays} Tage her)`}. {count} {count === 1 ? "Schnappschuss" : "Schnappschüsse"} im Speicher.
      {stale && " Der nächtliche Lauf scheint zu hängen."}
    </p>
  );
}

export function SquadRow({ p, median }: { p: RatedPlayer; median: number }) {
  return (
    <li className="flex items-center gap-3 border-b border-night-700/70 px-4 py-3 last:border-0 hover:bg-night-800/60">
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
    <p className="mt-1 text-data-xs text-snow-faint">{reasons.join(" ┬À ")}</p>
  );
}

export function MarketRow({ p, median = 0 }: { p: RatedMarketPlayer; median?: number }) {
  const bargain = p.marketValue > 0 && p.price < p.marketValue;
  return (
    <li className="flex items-center gap-3 border-b border-night-700/70 px-4 py-3 last:border-0 hover:bg-night-800/60">
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
        <div className="num text-data-sm text-snow-muted">{eur(p.marketValue)}</div>
        <div className="label">Marktwert</div>
      </div>

      <div className="w-24 text-right">
        <div
          className={`num text-data-sm font-semibold ${
            bargain ? "text-kb" : "text-snow"
          }`}
        >
          {eur(p.price)}
        </div>
        <div className="label">Preis</div>
      </div>

      <div className="w-24 text-right">
        <div className="num text-data-sm font-bold text-kb">{eur(p.maxBid)}</div>
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
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-data-sm text-snow-faint">{hint}</p>
    </div>
  );
}
