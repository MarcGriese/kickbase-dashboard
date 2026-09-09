import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { MarketRow, Empty, ActionStrip } from "@/components/ui";
import { getToken, getLeagueId } from "@/lib/session";
import { getMarket, getBudget, getFeed, KickbaseError } from "@/lib/kickbase";
import { rateMarket, leagueOverpay, medianPpm } from "@/lib/advisor";
import { eur, pick } from "@/lib/fields";
import { compareWithHistory } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function MarktPage() {
  const token = getToken();
  const leagueId = getLeagueId();
  if (!token || !leagueId) redirect("/login");

  let marketRaw, budget, feed;
  try {
    [marketRaw, budget, feed] = await Promise.all([
      getMarket(token, leagueId),
      getBudget(token, leagueId),
      getFeed(token, leagueId),
    ]);
  } catch (err) {
    if (err instanceof KickbaseError && err.status === 401) redirect("/login");
    throw err;
  }

  const { factor, samples } = leagueOverpay(feed);

  // Auch der Markt wird gegen den Speicher gehalten: ein Spieler, der seit
  // einer Woche faellt, sieht am Tagesschritt allein oft harmlos aus.
  const history = compareWithHistory(
    leagueId,
    marketRaw.map((raw) => ({
      playerId: String(pick(raw, "id", "")),
      marketValue: Number(pick(raw, "marketValue", 0)) || 0,
    }))
  );

  const reference = medianPpm(marketRaw);
  const players = marketRaw
    .map((m) =>
      rateMarket(m, factor, budget, { medianPpm: reference, trends: history.byPlayer })
    )
    .sort((a, b) => b.score - a.score);

  const buys = players.filter((p) => p.verdict === "kaufen");

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl animate-fade-up px-4 py-6">
        <div className="card mb-6 p-4">
          <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
            <div>
              <div className="label">Aufschlag in deiner Liga</div>
              <div className="num mt-1.5 text-headline-sm font-bold text-kb-white">
                {factor >= 1 ? "+" : "−"}
                {Math.abs((factor - 1) * 100).toFixed(1)} %
              </div>
            </div>
            <div>
              <div className="label">Grundlage</div>
              <div className="mt-1.5 text-subhead text-kb-grey-light">
                {samples > 0
                  ? `${samples} echte Transfers`
                  : "zu wenige Transfers – Schätzwert +5 %"}
              </div>
            </div>
            <div>
              <div className="label">Verfügbar</div>
              <div className="num mt-1.5 text-subhead text-kb-grey-light">
                {budget !== null ? eur(budget) : "unbekannt"}
              </div>
            </div>
          </div>

          <p className="mt-4 max-w-2xl border-t border-kb-line pt-3 text-data-xs leading-relaxed text-kb-grey">
            So viel über Marktwert wurde in deiner Liga zuletzt wirklich gezahlt.
            Das Maximalgebot leitet sich daraus ab. Die verdeckten Gebote deiner
            Mitspieler kennt niemand – auch diese App nicht.
          </p>
        </div>

        <ActionStrip title="Lohnt sich heute" names={buys.map((p) => p.name)} />

        <section className="card overflow-hidden">
          <div className="flex items-baseline justify-between border-b border-kb-line px-4 py-3">
            <h2 className="kb-headline">Transfermarkt</h2>
            <span className="label">Beste Ziele zuerst</span>
          </div>

          {players.length ? (
            <ul>
              {players.map((p) => (
                <MarketRow key={p.id} p={p} median={reference} />
              ))}
            </ul>
          ) : (
            <Empty
              title="Der Markt ist leer"
              hint="Kickbase stellt über Nacht neue Spieler ein. Schau später wieder rein."
            />
          )}
        </section>
      </main>
    </>
  );
}
