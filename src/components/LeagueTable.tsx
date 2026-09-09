"use client";

import { useMemo, useState } from "react";
import { eur, eurDelta } from "@/lib/fields";
import { Delta, Empty } from "./ui";

export interface LeagueRow {
  id: string;
  name: string;
  points: number;
  matchdayPoints: number | null;
  teamValue: number | null;
  profit: number | null;
  /** Hergeleitet, nicht von der API geliefert. */
  budget: number | null;
  /** Teamwert + Budget. */
  squadValue: number | null;
  /** Betrag, bis zu dem das Konto ins Minus darf (positive Zahl). */
  maxNegative: number | null;
  isMe: boolean;
}

type SortKey =
  | "points"
  | "matchdayPoints"
  | "teamValue"
  | "profit"
  | "budget"
  | "squadValue";

const COLUMNS: { key: SortKey; label: string; short: string }[] = [
  { key: "points", label: "Gesamtpunkte", short: "Punkte" },
  { key: "matchdayPoints", label: "Punkte am letzten Spieltag", short: "Spieltag" },
  { key: "teamValue", label: "Teamwert", short: "Teamwert" },
  { key: "profit", label: "Transfergewinn", short: "Transfers" },
  { key: "budget", label: "Budget (hergeleitet)", short: "Budget" },
  { key: "squadValue", label: "Teamwert + Budget", short: "Max. Kader" },
];

/** Fehlende Werte sortieren immer ans Ende, egal in welche Richtung. */
function compare(a: LeagueRow, b: LeagueRow, key: SortKey, desc: boolean): number {
  const va = a[key];
  const vb = b[key];
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  const cmp = va - vb;
  return desc ? -cmp : cmp;
}

const GRID =
  "lg:grid lg:grid-cols-[2.5rem_minmax(8rem,1fr)_6rem_5.5rem_7rem_7rem_7rem_7rem_6rem] lg:items-center lg:gap-x-3";

function Num({
  value,
  hint,
  strong,
}: {
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className="text-right">
      <div className={`num text-data-sm ${strong ? "font-bold" : "font-semibold"}`}>
        {value}
      </div>
      {/* Ab lg traegt die Kopfzeile die Beschriftung. */}
      {hint && <div className="text-data-xs text-kb-grey lg:hidden">{hint}</div>}
    </div>
  );
}

function Head({
  col,
  sort,
  desc,
  onSort,
}: {
  col: (typeof COLUMNS)[number];
  sort: SortKey;
  desc: boolean;
  onSort: (k: SortKey) => void;
}) {
  const active = sort === col.key;
  return (
    <button
      type="button"
      onClick={() => onSort(col.key)}
      title={`Nach ${col.label} sortieren`}
      className={`label text-right transition-colors hover:text-kb-white ${
        active ? "text-kb-white" : ""
      }`}
    >
      {col.short}
      {active && <span aria-hidden>{desc ? " ↓" : " ↑"}</span>}
    </button>
  );
}

export function LeagueTable({
  rows,
  matchday,
}: {
  rows: LeagueRow[];
  /** Nummer des zuletzt gewerteten Spieltags, falls bekannt. */
  matchday: number | null;
}) {
  // Die Tabelle steht nach Gesamtpunkten - so wird die Liga entschieden.
  const [sort, setSort] = useState<SortKey>("points");
  const [desc, setDesc] = useState(true);

  const sorted = useMemo(() => {
    const list = [...rows].sort((a, b) => compare(a, b, sort, desc));
    return list;
  }, [rows, sort, desc]);

  // Die Platzierung haengt an den Punkten, nicht an der gewaehlten Sortierung.
  const placeById = useMemo(() => {
    const byPoints = [...rows].sort((a, b) => b.points - a.points);
    return new Map(byPoints.map((r, i) => [r.id, i + 1]));
  }, [rows]);

  const leader = Math.max(0, ...rows.map((r) => r.points));

  function chooseSort(key: SortKey) {
    if (key === sort) {
      setDesc((d) => !d);
      return;
    }
    setSort(key);
    setDesc(true);
  }

  if (!sorted.length) {
    return (
      <section className="card overflow-hidden">
        <Empty
          title="Keine Tabelle verfügbar"
          hint="Die API hat für diese Liga keine Rangliste geliefert."
        />
      </section>
    );
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-kb-line px-4 py-3">
        <h2 className="display text-base">Tabelle</h2>
        <span className="label">
          nach Gesamtpunkten
          {matchday ? ` · Spieltagspunkte vom ${matchday}. Spieltag` : ""}
        </span>
      </div>

      {/* Kopfzeile ------------------------------------------------------ */}
      <div className={`hidden border-b border-kb-line bg-kb-surface/60 px-4 py-2 ${GRID}`}>
        <span className="label">#</span>
        <span className="label">Manager</span>
        {COLUMNS.map((c) => (
          <Head key={c.key} col={c} sort={sort} desc={desc} onSort={chooseSort} />
        ))}
        <span className="label text-right">Rückstand</span>
      </div>

      {/* Sortierung auf schmalen Schirmen ------------------------------- */}
      <div className="flex flex-wrap items-center gap-2 border-b border-kb-line px-4 py-2.5 lg:hidden">
        <span className="label">Sortieren</span>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as SortKey);
            setDesc(true);
          }}
          className="field w-auto py-1.5 pr-8"
        >
          {COLUMNS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setDesc((d) => !d)}
          aria-label={desc ? "Aufsteigend sortieren" : "Absteigend sortieren"}
          className="rounded-lg border border-kb-line-strong bg-kb-surface px-2.5 py-1.5 text-data-sm font-bold text-kb-grey-light transition-colors hover:border-kb-white hover:text-kb-white"
        >
          {desc ? "↓" : "↑"}
        </button>
      </div>

      <ul>
        {sorted.map((m) => {
          const place = placeById.get(m.id) ?? 0;
          const gap = leader - m.points;
          return (
            <li
              key={m.id}
              className={`grid grid-cols-2 gap-x-3 gap-y-2 border-b border-kb-line/70 px-4 py-3 last:border-0 sm:grid-cols-3 ${GRID} ${
                m.isMe ? "border-l-2 border-l-kb-red bg-kb-raised" : "hover:bg-kb-raised/50"
              }`}
            >
              <div className="col-span-2 flex items-center gap-3 sm:col-span-3 lg:contents">
                <span
                  className={`num w-7 shrink-0 text-center text-data-sm font-bold lg:w-auto ${
                    place === 1 ? "text-kb-white" : "text-kb-grey"
                  }`}
                >
                  {place}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate ${
                    m.isMe ? "font-bold uppercase tracking-wide text-kb-white" : "font-semibold text-kb-grey-light"
                  }`}
                >
                  {m.name}
                  {m.isMe && (
                    <span className="ml-2 text-data-xs font-normal text-kb-grey">
                      du
                    </span>
                  )}
                </span>
              </div>

              <Num strong value={m.points.toLocaleString("de-DE")} hint="Punkte" />
              <Num
                value={
                  m.matchdayPoints === null
                    ? "–"
                    : m.matchdayPoints.toLocaleString("de-DE")
                }
                hint="Spieltag"
              />
              <Num value={eur(m.teamValue)} hint="Teamwert" />

              <div className="text-right">
                <div className="text-data-xs text-kb-grey lg:hidden">Transfers</div>
                {m.profit === null ? (
                  <span className="num text-data-sm text-kb-grey">–</span>
                ) : (
                  <Delta value={m.profit} />
                )}
              </div>

              <div className="text-right">
                <div className="text-data-xs text-kb-grey lg:hidden">Budget</div>
                <div
                  className={`num text-data-sm font-bold ${
                    m.budget === null
                      ? "text-kb-grey"
                      : m.budget < 0
                        ? "text-kb-red"
                        : "text-kb-white"
                  }`}
                >
                  {m.budget === null ? "–" : eur(m.budget)}
                </div>
                {m.maxNegative !== null && (
                  <div className="text-data-xs text-kb-grey">
                    bis {eur(-m.maxNegative)}
                  </div>
                )}
              </div>

              <Num
                strong
                value={m.squadValue === null ? "–" : eur(m.squadValue)}
                hint="max. Kader"
              />

              <Num
                value={place === 1 ? "–" : `−${gap.toLocaleString("de-DE")}`}
                hint="Rückstand"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Kurze Zusammenfassung ueber der Tabelle. */
export function LeagueLead({ rows }: { rows: LeagueRow[] }) {
  const me = rows.find((r) => r.isMe);
  if (!me) return null;
  const richest = rows.reduce<LeagueRow | null>(
    (best, r) =>
      r.squadValue !== null && (best === null || r.squadValue > (best.squadValue ?? 0))
        ? r
        : best,
    null
  );

  return (
    <p className="text-data-sm text-kb-grey-light">
      Du stehst bei {me.points.toLocaleString("de-DE")} Punkten
      {me.budget !== null && (
        <>
          {" "}
          und rund <span className="font-semibold text-kb-white">{eur(me.budget)}</span>{" "}
          Budget
        </>
      )}
      {richest && !richest.isMe && richest.squadValue !== null && (
        <>
          . Den größten möglichen Kader hätte{" "}
          <span className="font-semibold text-kb-white">{richest.name}</span> mit{" "}
          {eur(richest.squadValue)}
        </>
      )}
      {me.profit !== null && (
        <>
          . Dein Transfergewinn:{" "}
          <span className="font-semibold text-kb-white">{eurDelta(me.profit)}</span>
        </>
      )}
      .
    </p>
  );
}
