import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { LineupBoard, CurrentLineup, Replacements } from "@/components/Lineup";
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
import { pickBestEleven, suggestReplacements } from "@/lib/lineup";
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

  // Beste Elf aus dem Kader - immer berechenbar.
  const recommended = pickBestEleven(squad, schedule.byTeam);

  // Gesetzte Elf, falls die API sie hergibt.
  const byId = new Map(squad.map((p) => [p.id, p]));
  const realStarters =
    lineupIds && lineupIds.length
      ? lineupIds.map((id) => byId.get(id)).filter((p): p is (typeof squad)[number] => !!p)
      : null;

  // Wogegen die Wechsel gemessen werden: die echte Elf, sonst die empfohlene.
  const reference = realStarters ?? recommended?.starters ?? [];
  const swaps = suggestReplacements(reference, market, schedule.byTeam, { budget });

  const expectedLabel = recommended
    ? `rund ${Math.round(recommended.expectedPoints)} Ø-Punkte`
    : "";

  const horizonLabel = schedule.nextMatchday
    ? `${schedule.nextMatchday}. Spieltag`
    : "nächster Spieltag";

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl animate-fade-up space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="display text-xl">Aufstellung</h1>
          <p className="text-data-sm text-kb-grey-light">
            Ausrichtung auf den{" "}
            <span className="font-semibold text-kb-white">{horizonLabel}</span>
          </p>
        </div>

        {recommended ? (
          <LineupBoard lineup={recommended} expectedLabel={expectedLabel} />
        ) : (
          <p className="rounded-card border border-kb-line bg-kb-surface/90 px-4 py-3 text-data-sm text-kb-grey">
            Kein Kader geladen – melde dich neu an oder lege zuerst einen
            Schnappschuss an.
          </p>
        )}

        <CurrentLineup starters={realStarters} />

        <Replacements swaps={swaps} referenceIsReal={realStarters !== null} />

        <div className="space-y-2 text-data-xs leading-relaxed text-kb-grey">
          <p>
            <span className="font-semibold text-kb-grey-light">Startwert:</span> der
            Punkteschnitt eines Spielers, halbiert bei „angeschlagen"/„Aufbautraining"
            und um 10 % je nach Stärke des nächsten Gegners justiert. Verletzte,
            gesperrte und nicht gemeldete Spieler fallen heraus. Das ist eine
            nachvollziehbare Fortschreibung, keine Kickbase-Prognose.
          </p>
          <p>
            <span className="font-semibold text-kb-grey-light">Wechsel:</span> ein
            Marktspieler wird nur vorgeschlagen, wenn er einen Stammspieler auf
            derselben Position um mindestens 10 % im Startwert schlägt und der Tausch
            bezahlbar bleibt. „Netto nach Verkauf" ist das Maximalgebot abzüglich des
            Marktwerts, den der weichende Spieler wieder einbringt – ein Plus heißt,
            der Tausch spült Geld in die Kasse.
          </p>
          <p>
            <span className="font-semibold text-kb-grey-light">Startelf-Prognose</span>{" "}
            (★ / ✓): erscheint nur, wenn die API sie bestätigt liefert. Solange sie
            das nicht tut, bleibt der Hinweis aus – lieber nichts als eine geratene
            Angabe.
          </p>
        </div>
      </main>
    </>
  );
}
