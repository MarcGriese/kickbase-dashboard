import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import {
  SquadRow,
  StatTile,
  Empty,
  SnapshotNotice,
  ActionStrip,
} from "@/components/ui";
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

  let squadRaw, overview, matchdaysRaw, tableRaw;
  try {
    [squadRaw, overview, matchdaysRaw, tableRaw] = await Promise.all([
      getSquad(token, leagueId),
      getTeamOverview(token, leagueId),
      getMatchdays(token),
      getCompetitionTable(token),
    ]);
  } catch (err) {
    if (err instanceof KickbaseError && err.status === 401) redirect("/login");
    throw err;
  }

  const table = buildTable(tableRaw);
  const schedule = buildSchedule(matchdaysRaw, table);
  const forecastDays = daysUntil(schedule.nextKickoff);

  const history = compareWithHistory(
    leagueId,
    squadRaw.map((raw) => ({
      playerId: String(pick(raw, "id", "")),
      marketValue: Number(pick(raw, "marketValue", 0)) || 0,
    }))
  );
  const reference = medianPpm(squadRaw);

  const players = squadRaw.map((raw) =>
    rateOwn(raw, {
      fixturesByTeam: schedule.byTeam,
      forecastDays,
      medianPpm: reference,
      trends: history.byPlayer,
    })
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

  /* ------------------------------------------------------------ Kennzahlen */

  const summed = players.reduce((s, p) => s + p.marketValue, 0);
  // Kickbase fuehrt den Teamwert selbst - die Summe ist nur die Rueckfallebene.
  const teamValue = overview.teamValue ?? summed;
  const budget = overview.budget;

  const dayTotal = players.reduce((s, p) => s + p.dayDelta, 0);
  const weekTotal = players.reduce((s, p) => s + p.weekDelta, 0);
  const forecastTotal = players.reduce((s, p) => s + p.forecast.delta, 0);

  const room = budgetRoom(teamValue, budget);
  const sells = players.filter((p) => p.verdict === "verkaufen");
  const teamChange = compareTeamValue(leagueId, teamValue);

  const ref = history.reference;
  const refAge = ref ? daysBetween(ref.day, berlinDay()) : null;

  const horizonDate = schedule.nextKickoff;
  const horizonLabel = horizonDate
    ? shortDate(horizonDate)
    : `${forecastDays} Tage`;
  const matchdayLabel = schedule.nextMatchday
    ? `${schedule.nextMatchday}. Spieltag`
    : "nächster Spieltag";

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl animate-fade-up px-4 py-6">
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatTile label="Teamwert" value={eur(teamValue)} />
          <StatTile
            label="Heute"
            value={eur(Math.abs(dayTotal))}
            delta={dayTotal}
            hint="Marktwert über alle Spieler"
          />

          <StatTile
            label={teamChange ? `Seit ${teamChange.day.slice(5)}` : "Verlauf"}
            value={teamChange ? eur(Math.abs(teamChange.delta)) : "–"}
            delta={teamChange ? teamChange.delta : undefined}
            hint={
              teamChange
                ? `${Math.abs(teamChange.pct).toFixed(1)} % in ${teamChange.ageDays} Tagen`
                : "noch kein gespeicherter Stand"
            }
          />
          <StatTile
            label="Budget"
            value={budget !== null ? eur(budget) : "–"}
            tone={budget !== null && budget < 0 ? "alert" : "neutral"}
            hint={
              budget === null
                ? "von der API nicht geliefert"
                : `Bis ${eur(-room.maxNegative)} darfst du ins Minus (33 % des Kaderwerts) · Spielraum insgesamt ${eur(room.spendable)} · zum Spieltagsbeginn muss das Konto wieder im Plus stehen.`
            }
          />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label="Letzte 24 Stunden"
            value={eurDelta(dayTotal)}
            tone={dayTotal > 0 ? "up" : dayTotal < 0 ? "down" : "neutral"}
            hint="Marktwert über alle Spieler"
          />
          <StatTile
            label="Letzte 7 Tage"
            value={eurDelta(weekTotal)}
            tone={weekTotal > 0 ? "up" : weekTotal < 0 ? "down" : "neutral"}
            hint="Wochenbewegung des Kaders"
          />
          <StatTile
            label={`Prognose bis ${horizonLabel}`}
            value={eurDelta(forecastTotal)}
            tone={forecastTotal > 0 ? "up" : forecastTotal < 0 ? "down" : "neutral"}
            hint={`Kader dann rund ${eur(summed + forecastTotal)} – fortgeschriebener Trend, keine Kickbase-Formel.`}
          />
        </div>

        <SnapshotNotice
          day={ref?.day ?? null}
          ageDays={refAge}
          count={countSnapshots(leagueId)}
        />

        <ActionStrip title="Heute trennen" names={sells.map((p) => p.name)} />

        <section className="card overflow-hidden">
          <div className="flex items-baseline justify-between border-b border-kb-line px-4 py-3">
            <h2 className="kb-headline">Dein Kader</h2>
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

        <p className="mt-4 max-w-2xl text-data-xs leading-relaxed text-kb-grey">
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
