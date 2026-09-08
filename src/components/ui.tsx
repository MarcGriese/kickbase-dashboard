import { eur, eurDelta, POSITIONS, STATUS } from "@/lib/fields";
import type { RatedPlayer, RatedMarketPlayer } from "@/lib/advisor";

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

export function SquadRow({ p }: { p: RatedPlayer }) {
  return (
    <li className="flex items-center gap-3 border-b border-pitch-700/70 px-4 py-3 last:border-0 hover:bg-pitch-800/60">
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

      <div className="hidden w-16 text-right sm:block">
        <div className="num text-data-sm font-semibold">{p.average.toFixed(0)}</div>
        <div className="label">Schnitt</div>
      </div>

      <div className="w-24 text-right">
        <div className="num text-data-sm font-semibold">{eur(p.marketValue)}</div>
        <Delta value={p.dayDelta} pct={p.dayPct} />
      </div>

      <VerdictBadge verdict={p.verdict} />
    </li>
  );
}

export function MarketRow({ p }: { p: RatedMarketPlayer }) {
  const bargain = p.marketValue > 0 && p.price < p.marketValue;
  return (
    <li className="flex items-center gap-3 border-b border-pitch-700/70 px-4 py-3 last:border-0 hover:bg-pitch-800/60">
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
