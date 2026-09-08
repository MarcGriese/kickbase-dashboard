"use client";

import { useMemo, useState } from "react";
import type { RatedPlayer } from "@/lib/advisor";
import {
  eur,
  playerImage,
  teamCrest,
  POSITIONS,
  POSITION_LABELS,
} from "@/lib/fields";
import { teamName } from "@/lib/fixtures";
import { PlayerPhoto, TeamCrest } from "./Media";
import {
  Delta,
  FixtureStrip,
  PositionChip,
  StatusFlag,
  VerdictBadge,
  Empty,
} from "./ui";

/* ------------------------------------------------------------- Sortierung */

type SortKey =
  | "marketValue"
  | "dayDelta"
  | "weekDelta"
  | "totalGain"
  | "forecast"
  | "average"
  | "points"
  | "name"
  | "pos";

const SORTS: { key: SortKey; label: string; defaultDesc: boolean }[] = [
  { key: "marketValue", label: "Marktwert", defaultDesc: true },
  { key: "dayDelta", label: "24 Stunden", defaultDesc: true },
  { key: "weekDelta", label: "7 Tage", defaultDesc: true },
  { key: "totalGain", label: "Gewinn/Verlust", defaultDesc: false },
  { key: "forecast", label: "Prognose", defaultDesc: true },
  { key: "average", label: "Schnitt", defaultDesc: true },
  { key: "points", label: "Punkte", defaultDesc: true },
  { key: "name", label: "Name", defaultDesc: false },
  { key: "pos", label: "Position", defaultDesc: false },
];

function valueOf(p: RatedPlayer, key: SortKey): number | string {
  switch (key) {
    case "forecast":
      return p.forecast.delta;
    case "name":
      return p.name.toLocaleLowerCase("de-DE");
    default:
      return p[key];
  }
}

/* ------------------------------------------------------------------ Zelle */

function Cell({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-right ${className}`}>
      {/* Auf schmalen Schirmen steht die Spaltenueberschrift an der Zahl,
          ab lg traegt sie die Kopfzeile der Tabelle. */}
      <div className="label lg:hidden">{label}</div>
      <div className="mt-0.5 lg:mt-0">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ Table */

// Foto | Name | Spielplan | Ø | MW | 24h | 7d | seit Kauf | Prognose | Rat.
// Die Spielplanspalte ist so bemessen, dass drei Gegner-Chips nebeneinander
// passen, ohne umzubrechen.
const GRID =
  "lg:grid lg:grid-cols-[2.75rem_minmax(10rem,1.2fr)_minmax(14.5rem,1fr)_3.5rem_6rem_6.5rem_6.5rem_6.5rem_6.5rem_6rem] lg:items-center lg:gap-x-3";

export function SquadTable({
  players,
  horizon,
}: {
  players: RatedPlayer[];
  /** Beschriftung des Prognose-Horizonts, z. B. "Sa. 15.03." */
  horizon: string;
}) {
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState(0); // 0 = alle
  const [sort, setSort] = useState<SortKey>("marketValue");
  const [desc, setDesc] = useState(true);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("de-DE");

    const filtered = players.filter((p) => {
      if (pos && p.pos !== pos) return false;
      if (!q) return true;
      const club = p.teamName || teamName(p.teamId);
      return (
        p.fullName.toLocaleLowerCase("de-DE").includes(q) ||
        club.toLocaleLowerCase("de-DE").includes(q)
      );
    });

    return filtered.sort((a, b) => {
      const va = valueOf(a, sort);
      const vb = valueOf(b, sort);
      let cmp: number;
      if (typeof va === "string" || typeof vb === "string") {
        cmp = String(va).localeCompare(String(vb), "de-DE");
      } else {
        cmp = va - vb;
      }
      // Gleichstand: der teurere Spieler zuerst, damit die Reihenfolge stabil ist.
      if (cmp === 0) cmp = a.marketValue - b.marketValue;
      return desc ? -cmp : cmp;
    });
  }, [players, query, pos, sort, desc]);

  const sumValue = visible.reduce((s, p) => s + p.marketValue, 0);
  const sumGain = visible.reduce((s, p) => s + p.totalGain, 0);

  function chooseSort(key: SortKey) {
    const preset = SORTS.find((s) => s.key === key);
    setSort(key);
    setDesc(preset?.defaultDesc ?? true);
  }

  return (
    <section className="card overflow-hidden">
      {/* --------------------------------------------------------- Werkzeug */}
      <div className="border-b border-night-700 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="display mr-auto text-base">Kader</h2>

          <label className="relative">
            <span className="sr-only">Spieler suchen</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name oder Verein …"
              className="field w-56 py-1.5"
            />
          </label>

          <label className="flex items-center gap-2">
            <span className="label">Sortieren</span>
            <select
              value={sort}
              onChange={(e) => chooseSort(e.target.value as SortKey)}
              className="field w-auto py-1.5 pr-8"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setDesc((d) => !d)}
            aria-label={desc ? "Aufsteigend sortieren" : "Absteigend sortieren"}
            title={desc ? "Größte zuerst" : "Kleinste zuerst"}
            className="rounded-lg border border-night-600 bg-night-900 px-2.5 py-1.5 text-data-sm font-bold text-snow-muted transition-colors hover:border-kb hover:text-kb"
          >
            {desc ? "↓" : "↑"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {[0, 1, 2, 3, 4].map((p) => {
            const active = pos === p;
            const count = p ? players.filter((x) => x.pos === p).length : players.length;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPos(p)}
                aria-pressed={active}
                className={`rounded-md border px-2.5 py-1 text-data-xs font-bold uppercase tracking-wider transition-colors ${
                  active
                    ? "border-kb/40 bg-kb/15 text-kb"
                    : "border-night-700 bg-night-800 text-snow-muted hover:text-snow"
                }`}
              >
                {p ? POSITION_LABELS[p] : "Alle"}
                <span className="ml-1.5 opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------- Kopfzeile */}
      <div
        className={`hidden border-b border-night-700 bg-night-900/60 px-4 py-2 ${GRID}`}
      >
        <span />
        <span className="label">Spieler</span>
        <span className="label">Nächste 3 Spiele</span>
        <span className="label text-right">Ø</span>
        <span className="label text-right">Marktwert</span>
        <span className="label text-right">24 Std.</span>
        <span className="label text-right">7 Tage</span>
        <span className="label text-right">Seit Kauf</span>
        <span className="label text-right" title={`Fortschreibung bis ${horizon}`}>
          Prognose
        </span>
        <span className="label text-right">Rat</span>
      </div>

      {/* ------------------------------------------------------------ Liste */}
      {visible.length ? (
        <ul>
          {visible.map((p) => (
            <li
              key={p.id}
              className={`grid grid-cols-2 gap-x-3 gap-y-2 border-b border-night-700/70 px-4 py-3 last:border-0 hover:bg-night-800/50 sm:grid-cols-3 ${GRID}`}
            >
              {/* Spieler ---------------------------------------------- */}
              {/* Ab lg loesen sich Foto und Name in eigene Rasterspalten auf. */}
              <div className="col-span-2 flex items-center gap-3 sm:col-span-3 lg:contents">
                <PlayerPhoto src={playerImage(p.image)} name={p.fullName} size={40} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold">{p.fullName}</span>
                    <StatusFlag status={p.status} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-data-xs text-snow-faint">
                    <TeamCrest
                      src={teamCrest(p.teamId)}
                      name={p.teamName || teamName(p.teamId)}
                      size={14}
                    />
                    <span className="truncate">
                      {p.teamName || teamName(p.teamId)}
                    </span>
                    <span className="opacity-50">·</span>
                    <span>{POSITIONS[p.pos] ?? "–"}</span>
                  </div>
                </div>

                <div className="lg:hidden">
                  <VerdictBadge verdict={p.verdict} />
                </div>
              </div>

              {/* Spielplan -------------------------------------------- */}
              <div className="col-span-2 sm:col-span-3 lg:col-span-1">
                <div className="label mb-1 lg:hidden">Nächste 3 Spiele</div>
                <FixtureStrip fixtures={p.fixtures} />
              </div>

              {/* Zahlen ------------------------------------------------ */}
              <Cell label="Schnitt" className="hidden lg:block">
                <span className="num text-data-sm font-semibold">
                  {p.average.toFixed(0)}
                </span>
              </Cell>

              <Cell label="Marktwert">
                <span className="num text-data-sm font-bold">{eur(p.marketValue)}</span>
              </Cell>

              <Cell label="24 Std.">
                <Delta value={p.dayDelta} pct={p.dayPct} />
              </Cell>

              <Cell label="7 Tage">
                <Delta value={p.weekDelta} pct={p.weekPct} />
              </Cell>

              <Cell label="Seit Kauf">
                <Delta value={p.totalGain} />
              </Cell>

              <Cell label={`Prognose ${horizon}`}>
                <div className="num text-data-sm font-semibold">
                  {eur(p.forecast.value)}
                </div>
                <Delta value={p.forecast.delta} className="opacity-80" />
              </Cell>

              <div className="hidden justify-end lg:flex">
                <VerdictBadge verdict={p.verdict} />
              </div>

              {/* Begruendung ------------------------------------------- */}
              {/* "Schnitt 212" steht schon in der Ø-Spalte - hier raus. */}
              {(() => {
                const reasons = p.reasons.filter((r) => !/^Schnitt \d+$/.test(r));
                if (!reasons.length) return null;
                return (
                  <p className="col-span-2 text-data-xs text-snow-faint sm:col-span-3 lg:col-span-10 lg:pl-[3.5rem]">
                    {reasons.join(" · ")}
                  </p>
                );
              })()}
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          title="Kein Spieler passt zum Filter"
          hint="Suche leeren oder eine andere Position wählen."
        />
      )}

      {/* ------------------------------------------------------------ Fuss */}
      {visible.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-night-700 bg-night-900/60 px-4 py-2.5">
          <span className="label">
            {visible.length} von {players.length} Spielern
          </span>
          <span className="num text-data-sm text-snow-muted">
            Marktwert der Auswahl:{" "}
            <span className="font-bold text-snow">{eur(sumValue)}</span>
          </span>
          <span className="num text-data-sm text-snow-muted">
            Seit Kauf: <Delta value={sumGain} />
          </span>
        </div>
      )}
    </section>
  );
}
