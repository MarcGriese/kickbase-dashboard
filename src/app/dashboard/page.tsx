import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { SquadRow, StatTile, Empty } from "@/components/ui";
import { getToken, getLeagueId } from "@/lib/session";
import { getSquad, getBudget, KickbaseError } from "@/lib/kickbase";
import { rateOwn } from "@/lib/advisor";
import { eur } from "@/lib/fields";

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

  const players = squadRaw.map(rateOwn);

  const ORDER = { verkaufen: 0, halten: 1, "stark-halten": 2 } as const;
  players.sort(
    (a, b) => ORDER[a.verdict] - ORDER[b.verdict] || b.marketValue - a.marketValue
  );

  const teamValue = players.reduce((s, p) => s + p.marketValue, 0);
  const dayTotal = players.reduce((s, p) => s + p.dayDelta, 0);
  const sells = players.filter((p) => p.verdict === "verkaufen");

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl animate-fade-up px-4 py-6">
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Teamwert" value={eur(teamValue)} />
          <StatTile
            label="Heute"
            value={(dayTotal > 0 ? "+" : "") + eur(dayTotal)}
            accent={dayTotal > 0}
            hint="Marktwert über alle Spieler"
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
                <SquadRow key={p.id} p={p} />
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
          Die Einschätzung gewichtet Marktwert-Trend, Punkteschnitt und
          Einsatzfähigkeit. Sie ersetzt kein eigenes Urteil – bei Spielern kurz
          vor einem guten Spielplan kann Halten trotz fallendem Marktwert richtig
          sein.
        </p>
      </main>
    </>
  );
}
