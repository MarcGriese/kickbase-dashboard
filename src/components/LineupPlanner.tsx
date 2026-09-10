"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RatedPlayer, RatedMarketPlayer } from "@/lib/advisor";
import type { Fixture } from "@/lib/fixtures";
import { pickBestEleven, suggestReplacements } from "@/lib/lineup";
import { useMarks } from "@/lib/marks";
import { playerImage, POSITION_LABELS } from "@/lib/fields";
import { PlayerPhoto } from "./Media";
import { FixtureStrip, PrognosisFlag, StatusFlag } from "./ui";
import { CurrentLineup, Replacements } from "./Lineup";

/* ------------------------------------------------------------ Aktionsknopf */

function Action({
  onClick,
  active,
  children,
  accent,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider transition-colors ${
        active
          ? accent
            ? "border-kb-red bg-kb-red text-kb-black"
            : "border-kb-white bg-kb-white text-kb-black"
          : "border-kb-line-strong text-kb-grey-light hover:border-kb-white hover:text-kb-white"
      }`}
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- Kachel */

function Tile({
  p,
  isStarter,
  locked,
  sell,
  onToggleLock,
  onToggleSell,
  onBench,
  onField,
}: {
  p: RatedPlayer;
  isStarter: boolean;
  locked: boolean;
  sell: boolean;
  onToggleLock: () => void;
  onToggleSell: () => void;
  onBench: () => void;
  onField: () => void;
}) {
  return (
    <div
      className={`flex w-[8rem] flex-col items-center gap-1 rounded-card border bg-kb-surface/80 px-2 py-2 text-center ${
        sell ? "border-kb-red/60" : locked ? "border-kb-white/50" : "border-kb-line"
      }`}
    >
      <PlayerPhoto src={playerImage(p.image)} name={p.fullName} size={34} />
      <Link
        href={`/spieler/${p.id}`}
        className="w-full truncate text-data-sm font-semibold underline-offset-2 hover:underline"
      >
        {p.name}
      </Link>
      <div className="num text-data-xs text-kb-grey-light">
        Ø {p.average.toFixed(0)} · erw.{" "}
        <span className="font-semibold text-kb-white">{p.expectedPoints.toFixed(0)}</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <StatusFlag status={p.status} />
        <PrognosisFlag prognosis={p.prognosis} />
      </div>
      <FixtureStrip fixtures={p.fixtures.slice(0, 1)} />

      <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
        {isStarter ? (
          <Action onClick={onBench}>Bank</Action>
        ) : (
          <Action onClick={onField}>Aufstellen</Action>
        )}
        <Action onClick={onToggleLock} active={locked}>
          Fest
        </Action>
        <Action onClick={onToggleSell} active={sell} accent>
          Verkauf
        </Action>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Planer */

export function LineupPlanner({
  squad,
  market,
  fixtures,
  budget,
  leagueId,
  realStarterIds,
}: {
  squad: RatedPlayer[];
  market: RatedMarketPlayer[];
  /** [teamId, Fixtures] - Map ist nicht serialisierbar ueber die RSC-Grenze. */
  fixtures: [number, Fixture[]][];
  budget: number | null;
  leagueId: string;
  /** IDs der laut API gesetzten Elf, falls vorhanden. */
  realStarterIds: string[] | null;
}) {
  const { marks, toggle } = useMarks(leagueId);
  // Manuell auf die Bank gesetzt - nur fuer diese Sitzung, nicht gespeichert.
  const [benched, setBenched] = useState<string[]>([]);

  const byTeam = useMemo(() => new Map(fixtures), [fixtures]);
  const byId = useMemo(() => new Map(squad.map((p) => [p.id, p])), [squad]);

  const lockedSet = useMemo(() => new Set(marks.locked), [marks.locked]);
  const excluded = useMemo(
    () => new Set([...marks.sell, ...benched]),
    [marks.sell, benched]
  );

  const lineup = useMemo(
    () => pickBestEleven(squad, byTeam, { locked: lockedSet, excluded }),
    [squad, byTeam, lockedSet, excluded]
  );

  const swaps = useMemo(
    () =>
      lineup
        ? suggestReplacements(lineup.starters, market, byTeam, { budget, keep: lockedSet })
        : [],
    [lineup, market, byTeam, budget, lockedSet]
  );

  const realStarters = useMemo(
    () =>
      realStarterIds
        ? realStarterIds.map((id) => byId.get(id)).filter((p): p is RatedPlayer => !!p)
        : null,
    [realStarterIds, byId]
  );

  if (!lineup) {
    return (
      <p className="rounded-card border border-kb-line bg-kb-surface/90 px-4 py-3 text-data-sm text-kb-grey">
        Kein Kader geladen – melde dich neu an oder lege zuerst einen Schnappschuss an.
      </p>
    );
  }

  function tileFor(p: RatedPlayer, isStarter: boolean) {
    return (
      <Tile
        key={p.id}
        p={p}
        isStarter={isStarter}
        locked={lockedSet.has(p.id)}
        sell={marks.sell.includes(p.id)}
        onToggleLock={() => toggle("locked", p.id)}
        onToggleSell={() => toggle("sell", p.id)}
        onBench={() => setBenched((b) => (b.includes(p.id) ? b : [...b, p.id]))}
        onField={() => {
          // Aufstellen = fest setzen (erzwingt die Elf) und von der Bank holen.
          setBenched((b) => b.filter((x) => x !== p.id));
          if (!lockedSet.has(p.id)) toggle("locked", p.id);
        }}
      />
    );
  }

  const rows: { label: string; players: RatedPlayer[] }[] = [
    { label: POSITION_LABELS[4], players: lineup.att },
    { label: POSITION_LABELS[3], players: lineup.mid },
    { label: POSITION_LABELS[2], players: lineup.def },
    { label: POSITION_LABELS[1], players: lineup.gk ? [lineup.gk] : [] },
  ];

  const manualActive = benched.length > 0;

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-kb-line px-4 py-3">
          <h2 className="display text-base">Empfohlene Startelf</h2>
          <div className="flex items-center gap-3">
            <span className="label">
              {lineup.formation.name} · rund {Math.round(lineup.expectedPoints)} erwartete Punkte
            </span>
            {manualActive && (
              <button
                type="button"
                onClick={() => setBenched([])}
                className="rounded border border-kb-line-strong px-2 py-0.5 text-data-xs font-bold text-kb-grey-light transition-colors hover:border-kb-white hover:text-kb-white"
              >
                Bank zurücksetzen
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 px-4 py-5">
          {rows.map((r) =>
            r.players.length ? (
              <div key={r.label} className="flex flex-col items-center gap-1.5">
                <span className="label">{r.label}</span>
                <div className="flex flex-wrap items-start justify-center gap-2">
                  {r.players.map((p) => tileFor(p, true))}
                </div>
              </div>
            ) : null
          )}
        </div>

        {lineup.bench.length > 0 && (
          <div className="border-t border-kb-line px-4 py-3">
            <div className="label mb-2">Bank</div>
            <div className="flex flex-wrap gap-2">
              {lineup.bench.map((p) => tileFor(p, false))}
            </div>
          </div>
        )}

        <p className="border-t border-kb-line px-4 py-2.5 text-data-xs leading-relaxed text-kb-grey">
          <span className="font-semibold text-kb-grey-light">Fest</span> hält einen
          Spieler in der Elf, <span className="font-semibold text-kb-grey-light">Bank</span>{" "}
          setzt ihn heraus, <span className="font-semibold text-kb-red">Verkauf</span> nimmt
          ihn aus der Empfehlung und markiert ihn auch im Kader. „Fest" und „Verkauf" bleiben
          gespeichert, das Bank-Setzen gilt nur für diese Sitzung.
        </p>
      </section>

      <CurrentLineup starters={realStarters} />

      <Replacements swaps={swaps} referenceIsReal={false} />
    </div>
  );
}
