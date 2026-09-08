import { eur, eurDelta, POSITIONS, STATUS, teamCrest } from "@/lib/fields";
import type { Strength, Fixture } from "@/lib/fixtures";
import type { RatedMarketPlayer } from "@/lib/advisor";
import { TeamCrest } from "./Media";

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
      {POSITIONS[pos] ?? "–"}
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

/* ------------------------------------------------------------- Marktzeile */

function Reasons({ reasons }: { reasons: string[] }) {
  if (!reasons.length) return null;
  return (
    <p className="mt-1 text-data-xs text-snow-faint">{reasons.join(" · ")}</p>
  );
}

export function MarketRow({ p }: { p: RatedMarketPlayer }) {
  const bargain = p.marketValue > 0 && p.price < p.marketValue;
  return (
    <li className="flex items-center gap-3 border-b border-night-700/70 px-4 py-3 last:border-0 hover:bg-night-800/60">
      <PositionChip pos={p.pos} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{p.name}</span>
          <StatusFlag status={p.status} />
        </div>
        <Reasons reasons={p.reasons} />
      </div>

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
