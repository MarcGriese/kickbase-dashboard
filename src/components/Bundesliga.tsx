import Link from "next/link";
import type { BLTeam, Match } from "@/lib/bundesliga";
import type { RatedPlayer } from "@/lib/advisor";
import { POSITIONS, playerImage, teamCrest } from "@/lib/fields";
import { teamName } from "@/lib/fixtures";
import { PlayerPhoto, TeamCrest } from "./Media";
import { Empty, StatusFlag } from "./ui";

/* --------------------------------------------------------------- Tabelle */

const FORM_STYLE: Record<string, string> = {
  S: "bg-kb-white text-kb-black",
  U: "bg-kb-raised text-kb-grey-light",
  N: "border border-kb-red text-kb-red",
};

const FORM_WORD: Record<string, string> = { S: "Sieg", U: "Unentschieden", N: "Niederlage" };

function Form({ form }: { form: string[] }) {
  if (!form.length) return <span className="text-data-xs text-kb-grey">–</span>;
  return (
    <div className="flex items-center justify-end gap-1">
      {form.map((f, i) => (
        <span
          key={i}
          title={FORM_WORD[f]}
          className={`inline-flex h-4 w-4 items-center justify-center rounded-sm text-[0.6rem] font-bold ${FORM_STYLE[f] ?? ""}`}
        >
          {f}
        </span>
      ))}
    </div>
  );
}

const TABLE_GRID =
  "lg:grid lg:grid-cols-[1.75rem_minmax(6rem,1fr)_2.5rem_3rem_3rem_5rem] lg:items-center lg:gap-x-3";

export function BundesligaTable({ table }: { table: BLTeam[] }) {
  if (!table.length) {
    return (
      <section className="card overflow-hidden">
        <Empty
          title="Keine Bundesliga-Tabelle"
          hint="Die inoffizielle API hat die Tabelle gerade nicht geliefert."
        />
      </section>
    );
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-kb-line px-4 py-3">
        <h2 className="display text-base">Bundesliga-Tabelle</h2>
        <span className="label">echte Liga</span>
      </div>

      <div className={`hidden border-b border-kb-line bg-kb-surface/60 px-4 py-2 ${TABLE_GRID}`}>
        <span className="label">#</span>
        <span className="label">Verein</span>
        <span className="label text-right">Sp</span>
        <span className="label text-right">Diff</span>
        <span className="label text-right">Pkt</span>
        <span className="label text-right">Form</span>
      </div>

      <ul>
        {table.map((t) => {
          const cl = t.place <= 4 ? "text-kb-white" : t.place >= 16 ? "text-kb-red" : "text-kb-grey";
          const name = teamName(t.teamId, t.name);
          return (
            <li
              key={t.teamId}
              className={`border-b border-kb-line/70 px-4 py-2.5 last:border-0 hover:bg-kb-raised/50 ${TABLE_GRID}`}
            >
              <div className="flex items-center gap-3 lg:contents">
                <span className={`num w-6 shrink-0 text-center text-data-sm font-bold ${cl}`}>
                  {t.place}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <TeamCrest src={teamCrest(t.teamId)} name={name} size={18} />
                  <span className="truncate font-semibold">{name}</span>
                </span>
                {/* Kompaktzahlen auf schmalen Schirmen direkt hinter dem Namen. */}
                <span className="num shrink-0 text-data-sm font-bold text-kb-white lg:hidden">
                  {t.points ?? "–"}
                </span>
              </div>

              <span className="num hidden text-right text-data-sm text-kb-grey-light lg:block">
                {t.played ?? "–"}
              </span>
              <span className="num hidden text-right text-data-sm text-kb-grey-light lg:block">
                {t.goalDiff === null ? "–" : t.goalDiff > 0 ? `+${t.goalDiff}` : t.goalDiff}
              </span>
              <span className="num hidden text-right text-data-sm font-bold text-kb-white lg:block">
                {t.points ?? "–"}
              </span>
              <div className="mt-1 lg:mt-0 lg:block">
                <Form form={t.form} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------------- Spieltag */

function kickoffLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Score({ match }: { match: Match }) {
  const { home, away, status } = match;
  if (status === "geplant" || (home.goals === null && away.goals === null)) {
    return <span className="num text-data-xs text-kb-grey">{kickoffLabel(match.kickoff) || "–:–"}</span>;
  }
  return (
    <span className="num text-data-sm font-bold text-kb-white">
      {home.goals ?? 0}
      <span className="mx-0.5 text-kb-grey">:</span>
      {away.goals ?? 0}
    </span>
  );
}

export function MatchdayFixtures({
  matches,
  matchday,
}: {
  matches: Match[];
  matchday: number | null;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-kb-line px-4 py-3">
        <h2 className="display text-base">
          {matchday ? `${matchday}. Spieltag` : "Spieltag"}
        </h2>
        <span className="label">Ergebnisse</span>
      </div>

      {matches.length ? (
        <ul className="divide-y divide-kb-line/70">
          {matches.map((m, i) => {
            const homeName = teamName(m.home.teamId, m.home.name);
            const awayName = teamName(m.away.teamId, m.away.name);
            return (
              <li key={i} className="flex items-center gap-2 px-4 py-2.5">
                <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right">
                  <span className="truncate text-data-sm">{homeName}</span>
                  <TeamCrest src={teamCrest(m.home.teamId)} name={homeName} size={16} />
                </span>

                <span className="flex w-24 shrink-0 flex-col items-center">
                  <Score match={m} />
                  {m.status === "live" && (
                    <span className="mt-0.5 rounded-sm bg-kb-red px-1 text-[0.55rem] font-bold uppercase tracking-wider text-kb-black">
                      Live
                    </span>
                  )}
                </span>

                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <TeamCrest src={teamCrest(m.away.teamId)} name={awayName} size={16} />
                  <span className="truncate text-data-sm">{awayName}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty title="Kein Spielplan" hint="Die API hat für diesen Spieltag keine Paarungen geliefert." />
      )}
    </section>
  );
}

/* ---------------------------------------------------- Meine Spieler heute */

export interface PlayerOnMatchday {
  player: RatedPlayer;
  match: Match;
  home: boolean;
  opponent: { teamId: number; name: string };
}

export function MyPlayersMatchday({
  entries,
  anyLivePoints,
}: {
  entries: PlayerOnMatchday[];
  /** Ob überhaupt ein Live-Punktewert von der API kam. */
  anyLivePoints: boolean;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-kb-line px-4 py-3">
        <h2 className="display text-base">Deine Spieler am Spieltag</h2>
        <span className="label">{entries.length} im Einsatz</span>
      </div>

      {entries.length ? (
        <ul className="divide-y divide-kb-line/70">
          {entries.map(({ player: p, match, home, opponent }) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
              <PlayerPhoto src={playerImage(p.image)} name={p.fullName} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/spieler/${p.id}`}
                    className="truncate font-semibold underline-offset-2 hover:underline"
                  >
                    {p.fullName}
                  </Link>
                  <StatusFlag status={p.status} />
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-data-xs text-kb-grey">
                  <span>{POSITIONS[p.pos] ?? "–"}</span>
                  <span className="opacity-50">·</span>
                  <span>{home ? "gegen" : "bei"}</span>
                  <TeamCrest src={teamCrest(opponent.teamId)} name={opponent.name} size={13} />
                  <span className="truncate">{opponent.name}</span>
                </div>
              </div>

              <div className="shrink-0 text-right">
                {p.livePoints !== null ? (
                  <>
                    <div className="num text-data-sm font-bold text-kb-white">{p.livePoints}</div>
                    <div className="label">Live-Pkt</div>
                  </>
                ) : (
                  <div className="num text-data-xs text-kb-grey">
                    {match.status === "live" ? "läuft" : kickoffShort(match.kickoff)}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          title="Keiner deiner Spieler ist an diesem Spieltag dabei"
          hint="Sobald Paarungen zu deinen Vereinen vorliegen, tauchen sie hier auf."
        />
      )}

      {!anyLivePoints && entries.length > 0 && (
        <p className="border-t border-kb-line px-4 py-2.5 text-data-xs leading-relaxed text-kb-grey">
          Live-Punkte erscheinen hier, sobald die API sie während eines laufenden
          Spiels liefert – bis dahin steht die Anstoßzeit.
        </p>
      )}
    </section>
  );
}

function kickoffShort(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}
