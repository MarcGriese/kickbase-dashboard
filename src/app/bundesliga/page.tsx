import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import {
  BundesligaTable,
  MatchdayFixtures,
  MyPlayersMatchday,
  type PlayerOnMatchday,
} from "@/components/Bundesliga";
import { getToken, getLeagueId } from "@/lib/session";
import {
  getSquad,
  getMatchdays,
  getCompetitionTable,
  KickbaseError,
} from "@/lib/kickbase";
import { rateOwn } from "@/lib/advisor";
import {
  parseBundesligaTable,
  parseMatches,
  currentMatchday,
  matchesOf,
  matchByTeam,
} from "@/lib/bundesliga";
import { teamName } from "@/lib/fixtures";

export const dynamic = "force-dynamic";

export default async function BundesligaPage() {
  const token = getToken();
  const leagueId = getLeagueId();
  if (!token || !leagueId) redirect("/login");

  let squadRaw, matchdaysRaw, tableRaw;
  try {
    [squadRaw, matchdaysRaw, tableRaw] = await Promise.all([
      getSquad(token, leagueId).catch(() => [] as Record<string, any>[]),
      getMatchdays(token),
      getCompetitionTable(token),
    ]);
  } catch (err) {
    if (err instanceof KickbaseError && err.status === 401) redirect("/login");
    throw err;
  }

  const table = parseBundesligaTable(tableRaw);
  const matches = parseMatches(matchdaysRaw);
  const matchday = currentMatchday(matches);
  const dayMatches = matchday !== null ? matchesOf(matches, matchday) : [];
  const byTeam = matchByTeam(dayMatches);

  const squad = squadRaw.map((raw) => rateOwn(raw, {}));
  const entries: PlayerOnMatchday[] = [];
  for (const p of squad) {
    const match = byTeam.get(p.teamId);
    if (!match) continue;
    const home = match.home.teamId === p.teamId;
    const opponent = home ? match.away : match.home;
    entries.push({
      player: p,
      match,
      home,
      opponent: { teamId: opponent.teamId, name: teamName(opponent.teamId, opponent.name) },
    });
  }
  entries.sort((a, b) => {
    const ka = a.match.kickoff ? Date.parse(a.match.kickoff) : Number.MAX_SAFE_INTEGER;
    const kb = b.match.kickoff ? Date.parse(b.match.kickoff) : Number.MAX_SAFE_INTEGER;
    return ka - kb;
  });
  const anyLivePoints = entries.some((e) => e.player.livePoints !== null);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl animate-fade-up px-4 py-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="display text-xl">Bundesliga</h1>
          <p className="text-data-sm text-kb-grey-light">
            Die echte Liga hinter deinem Kader
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <MyPlayersMatchday entries={entries} anyLivePoints={anyLivePoints} />
            <MatchdayFixtures matches={dayMatches} matchday={matchday} />
          </div>
          <BundesligaTable table={table} />
        </div>

        <p className="mt-4 text-data-xs leading-relaxed text-kb-grey">
          Spielplan und Tabelle kommen aus den inoffiziellen Zusatzendpunkten der
          Kickbase-API. Ergebnisse, Live-Status und Live-Punkte erscheinen nur,
          soweit die API sie hergibt – fehlt ein Feld, steht dort ein Strich statt
          einer geratenen Zahl.
        </p>
      </main>
    </>
  );
}
