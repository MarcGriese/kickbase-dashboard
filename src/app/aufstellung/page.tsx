import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { LineupPlanner } from "@/components/LineupPlanner";
import { getToken, getLeagueId } from "@/lib/session";
import {
  getSquad,
  getMarket,
  getBudget,
  getFeed,
  getLineup,
  getMatchdays,
  getCompetitionTable,
  KickbaseError,
} from "@/lib/kickbase";
import { rateOwn, rateMarket, leagueOverpay, medianPpm } from "@/lib/advisor";
import { buildSchedule, buildTable } from "@/lib/fixtures";
import { daysUntil } from "@/lib/forecast";
import { pick } from "@/lib/fields";
import { compareWithHistory } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function AufstellungPage() {
  const token = getToken();
  const leagueId = getLeagueId();
  if (!token || !leagueId) redirect("/login");

  let squadRaw, marketRaw, budget, feed, lineupIds, matchdaysRaw, tableRaw;
  try {
    [squadRaw, marketRaw, budget, feed, lineupIds, matchdaysRaw, tableRaw] =
      await Promise.all([
        getSquad(token, leagueId),
        getMarket(token, leagueId).catch(() => [] as Record<string, any>[]),
        getBudget(token, leagueId),
        getFeed(token, leagueId),
        getLineup(token, leagueId),
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
  const ownReference = medianPpm(squadRaw);

  const squad = squadRaw.map((raw) =>
    rateOwn(raw, {
      fixturesByTeam: schedule.byTeam,
      forecastDays,
      medianPpm: ownReference,
      trends: history.byPlayer,
    })
  );

  const { factor } = leagueOverpay(feed);
  const marketReference = medianPpm(marketRaw);
  const market = marketRaw.map((m) =>
    rateMarket(m, factor, budget, { medianPpm: marketReference })
  );

  const horizonLabel = schedule.nextMatchday
    ? `${schedule.nextMatchday}. Spieltag`
    : "nächster Spieltag";

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl animate-fade-up px-4 py-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="display text-xl">Aufstellung</h1>
          <p className="text-data-sm text-kb-grey-light">
            Ausrichtung auf den{" "}
            <span className="font-semibold text-kb-white">{horizonLabel}</span>
          </p>
        </div>

        <LineupPlanner
          squad={squad}
          market={market}
          fixtures={Array.from(schedule.byTeam.entries())}
          budget={budget}
          leagueId={leagueId}
          realStarterIds={lineupIds}
        />

        <div className="mt-6 space-y-2 text-data-xs leading-relaxed text-kb-grey">
          <p>
            <span className="font-semibold text-kb-grey-light">Startwert:</span> der
            Punkteschnitt eines Spielers, halbiert bei „angeschlagen"/„Aufbautraining"
            und um 10 % je nach Stärke des nächsten Gegners justiert. Verletzte,
            gesperrte und nicht gemeldete Spieler fallen heraus. Eine nachvollziehbare
            Fortschreibung, keine Kickbase-Prognose.
          </p>
          <p>
            <span className="font-semibold text-kb-grey-light">Wechsel:</span> ein
            Marktspieler wird nur vorgeschlagen, wenn er einen Stammspieler auf
            derselben Position um mindestens 10 % im Startwert schlägt und der Kauf
            bezahlbar bleibt – der Preis darf dein Budget plus den Verkaufserlös des
            weichenden Spielers nicht übersteigen. „Netto nach Verkauf" ist der Preis
            abzüglich dieses Erlöses; ein Plus heißt, der Tausch spült Geld in die Kasse.
          </p>
          <p>
            <span className="font-semibold text-kb-grey-light">Aktuelle Aufstellung:</span>{" "}
            deine gesetzte Elf zeigt die App nur, wenn die Kickbase-API sie hergibt –
            sonst bleibt der Vergleich bei der oben berechneten besten Elf.
          </p>
        </div>
      </main>
    </>
  );
}
