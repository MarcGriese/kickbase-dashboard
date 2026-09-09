import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { SquadRow, StatTile, Empty, SnapshotNotice } from "@/components/ui";
import { getToken, getLeagueId } from "@/lib/session";
import { getSquad, getBudget, KickbaseError } from "@/lib/kickbase";
import { rateOwn, medianPpm } from "@/lib/advisor";
import { eur, pick } from "@/lib/fields";
import {
  compareWithHistory,
  compareTeamValue,
  countSnapshots,
  daysBetween,
  berlinDay,
} from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const token = getToken();
  const leagueId = getLeagueId();
  if (!token || !leagueId) redirect("/login");

  let squadRaw, budget;
  try {
    [squadRaw, budget] = await Promise.all([
      getSquad(token, leagueId),
      getBudget(token, leagueId),
    ]);
  } catch (err) {
    if (err instanceof KickbaseError && err.status === 401) redirect("/login");
    throw err;
  }

  // Hier trifft das Jetzt auf das Gedaechtnis: die eben geholten Marktwerte
  // werden gegen die gespeicherten Staende gehalten, bevor irgendetwas
  // bewertet wird. Ohne Datei bleibt `trends` leer und die App sagt das.
  const live = squadRaw.map((raw) => ({
    playerId: String(pick(raw, "id", "")),
    marketValue: Number(pick(raw, "marketValue", 0)) || 0,
  }));
  const history = compareWithHistory(leagueId, live);

  const reference = medianPpm(squadRaw);
  const players = squadRaw.map((raw) =>
    rateOwn(raw, { medianPpm: reference, trends: history.byPlayer })
  );

  const ORDER = { verkaufen: 0, halten: 1, "stark-halten": 2 } as const;
  players.sort(
    (a, b) => ORDER[a.verdict] - ORDER[b.verdict] || b.marketValue - a.marketValue
  );

  const teamValue = players.reduce((s, p) => s + p.marketValue, 0);
  const dayTotal = players.reduce((s, p) => s + p.dayDelta, 0);
  const sells = players.filter((p) => p.verdict === "verkaufen");
  const teamChange = compareTeamValue(leagueId, teamValue);

  const ref = history.reference;
  const refAge = ref ? daysBetween(ref.day, berlinDay()) : null;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl animate-fade-up px-4 py-6">
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatTile label="Teamwert" value={eur(teamValue)} />
          <StatTile
            label="Heute"
            value={(dayTotal > 0 ? "+" : "") + eur(dayTotal)}
            accent={dayTotal > 0}
            hint="Marktwert über alle Spieler"
          />
          <StatTile
            label={teamChange ? `Seit ${teamChange.day.slice(5)}` : "Verlauf"}
            value={
              teamChange
                ? (teamChange.delta > 0 ? "+" : "") + eur(teamChange.delta)
                : "–"
            }
            accent={!!teamChange && teamChange.delta > 0}
            hint={
              teamChange
                ? `${teamChange.pct > 0 ? "+" : ""}${teamChange.pct.toFixed(1)} % in ${teamChange.ageDays} Tagen`
                : "noch kein gespeicherter Stand"
            }
          />
          <StatTile
            label="Budget"
            value={budget !== null ? eur(budget) : "–"}
            hint={budget === null ? "von der API nicht geliefert" : undefined}
          />
          <StatTile
            label="Kader"
            value={String(players.length)}
            hint={`${sells.length} zum Verkauf vorgemerkt`}
          />
        </div>

        <SnapshotNotice
          day={ref?.day ?? null}
          ageDays={refAge}
          count={countSnapshots(leagueId)}
        />

        {sells.length > 0 && (
          <div className="mb-6 rounded-card border border-loss/25 bg-loss/5 px-4 py-3">
            <p className="text-data-sm">
              <span className="font-semibold text-loss">Heute trennen:</span>{" "}
              <span className="text-chalk-muted">
                {sells.map((p) => p.name).join(", ")}
              </span>
            </p>
          </div>
        )}

        <section className="card overflow-hidden">
          <div className="flex items-baseline justify-between border-b border-pitch-700 px-4 py-3">
            <h2 className="font-bold tracking-tight">Dein Kader</h2>
            <span className="label">Verkaufskandidaten zuerst</span>
          </div>

          {players.length ? (
            <ul>
              {players.map((p) => (
                <SquadRow key={p.id} p={p} median={reference} />
              ))}
            </ul>
          ) : (
            <Empty
              title="Noch kein Spieler im Kader"
              hint="Hol dir im Transfermarkt deine ersten Spieler."
            />
          )}
        </section>

        <p className="mt-4 text-data-xs leading-relaxed text-chalk-faint">
          Die Einschätzung gewichtet Marktwert-Verlauf, Punkte je Million und
          Einsatzfähigkeit. P/Mio wird gegen den Median deines eigenen Kaders
          gemessen, nicht gegen eine feste Zahl – was ein guter Gegenwert ist,
          hängt am Preisniveau der Saison. Sie ersetzt kein eigenes Urteil: bei
          Spielern kurz vor einem guten Spielplan kann Halten trotz fallendem
          Marktwert richtig sein.
        </p>
      </main>
    </>
  );
}
