import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { LeagueTable, LeagueLead, type LeagueRow } from "@/components/LeagueTable";
import { getToken, getLeagueId } from "@/lib/session";
import {
  getRanking,
  getBudget,
  getManagerDashboard,
  getManagerSquad,
  mapLimit,
  KickbaseError,
} from "@/lib/kickbase";
import {
  calibrate,
  deriveBudget,
  parseRanking,
  rulesFromEnv,
  startCapital,
  sumUnrealized,
  type ManagerRow,
} from "@/lib/league";
import { budgetRoom, MAX_NEGATIVE_SHARE } from "@/lib/budget";
import { eur } from "@/lib/fields";

export const dynamic = "force-dynamic";

/** Gleichzeitige Anfragen an die Kickbase-API. */
const CONCURRENCY = 6;

export default async function LigaPage() {
  const token = getToken();
  const leagueId = getLeagueId();
  if (!token || !leagueId) redirect("/login");

  const rules = rulesFromEnv(process.env);

  let rankingRaw, myBudget;
  try {
    [rankingRaw, myBudget] = await Promise.all([
      getRanking(token, leagueId),
      getBudget(token, leagueId),
    ]);
  } catch (err) {
    if (err instanceof KickbaseError && err.status === 401) redirect("/login");
    throw err;
  }

  const managers = parseRanking(rankingRaw);

  // Pro Manager Dashboard (Transfergewinn) und Kader (stille Reserven).
  // Beides darf einzeln fehlschlagen - dann bleibt die Zeile unvollstaendig.
  const enriched: ManagerRow[] = await mapLimit(managers, CONCURRENCY, async (m) => {
    if (!m.id) return m;
    const [dash, squad] = await Promise.all([
      getManagerDashboard(token, leagueId, m.id),
      getManagerSquad(token, leagueId, m.id),
    ]);
    return {
      ...m,
      teamValue: m.teamValue ?? numOrNull(dash?.tv),
      profit: numOrNull(dash?.prft),
      unrealized: sumUnrealized(squad),
    };
  });

  // Der einzige Kontostand, den wir sicher kennen, ist der eigene. Er
  // entscheidet, welche Lesart von "prft" fuer alle gilt.
  const me = enriched.find((m) => m.isMe) ?? null;
  const calibration = calibrate(me, myBudget, rules);

  const rows: LeagueRow[] = enriched.map((m) => {
    // Beim eigenen Konto zaehlt der echte Wert, nicht die Herleitung.
    const budget =
      m.isMe && myBudget !== null
        ? myBudget
        : deriveBudget(m, rules, calibration.reading);

    const room =
      budget !== null && m.teamValue !== null
        ? budgetRoom(m.teamValue, budget)
        : null;

    return {
      id: m.id,
      name: m.name,
      points: m.points,
      matchdayPoints: m.matchdayPoints,
      teamValue: m.teamValue,
      profit: m.profit,
      budget,
      squadValue: room?.squadValue ?? null,
      maxNegative: room?.maxNegative ?? null,
      isMe: m.isMe,
    };
  });

  const matchday = numOrNull(rankingRaw?.day ?? rankingRaw?.cd ?? rankingRaw?.md);
  const derivedCount = rows.filter((r) => !r.isMe && r.budget !== null).length;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl animate-fade-up px-4 py-6">
        <section className="card overflow-hidden">
          <div className="flex items-baseline justify-between border-b border-kb-line px-4 py-3">
            <h2 className="kb-headline">Tabelle</h2>
            <span className="label">Rückstand auf Platz 1</span>
          </div>

          {managers.length ? (
            <ul>
              {managers.map((m, i) => {
                const gap = leader - m.points;
                return (
                  <li
                    key={m.id || i}
                    className={`flex items-center gap-3 border-b border-kb-line px-4 py-3 last:border-0 ${
                      m.isMe ? "border-l-2 border-l-kb-red bg-kb-raised" : ""
                    }`}
                  >
                    <span
                      className={`num w-7 shrink-0 text-center text-data-sm font-bold ${
                        i === 0 ? "text-kb-white" : "text-kb-grey"
                      }`}
                    >
                      {i + 1}
                    </span>

                    <span
                      className={`min-w-0 flex-1 truncate ${
                        m.isMe
                          ? "font-bold uppercase tracking-wide text-kb-white"
                          : "font-medium text-kb-grey-light"
                      }`}
                    >
                      {m.name}
                      {m.isMe && (
                        <span className="ml-2 text-data-xs font-bold uppercase tracking-wide text-kb-red">
                          du
                        </span>
                      )}
                    </span>

                    {m.teamValue !== null && (
                      <span className="num hidden w-24 text-right text-data-sm text-kb-grey sm:block">
                        {eur(m.teamValue)}
                      </span>
                    )}

                    <span className="num w-20 text-right text-data-sm font-semibold text-kb-white">
                      {m.points.toLocaleString("de-DE")}
                    </span>

                    <span className="num w-20 text-right text-data-sm text-kb-grey">
                      {i === 0 ? "–" : `−${gap.toLocaleString("de-DE")}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty
              title="Keine Tabelle verfügbar"
              hint="Die API hat für diese Liga keine Rangliste geliefert."
            />
          )}
        </section>
      </main>
    </>
  );
}

/**
 * Sagt vor der Tabelle, ob den hergeleiteten Kontostaenden zu trauen ist.
 * Ohne diese Zeile waeren es Zahlen ohne Herkunft.
 */
function CalibrationNote({
  trusted,
  error,
  reading,
  derivedCount,
  capital,
  hasOwnBudget,
}: {
  trusted: boolean;
  error: number | null;
  reading: string;
  derivedCount: number;
  capital: number;
  hasOwnBudget: boolean;
}) {
  if (!derivedCount) return null;

  if (trusted && error !== null) {
    return (
      <div className="mb-4 rounded-card border border-kb-line bg-kb-surface/90 px-4 py-3">
        <p className="text-data-sm text-kb-grey-light">
          <span className="font-bold uppercase tracking-wider text-kb-white">Geprüft:</span>{" "}
          Die Herleitung trifft dein eigenes Budget
          {error === 0
            ? " auf den Euro genau"
            : ` bis auf ${eur(Math.abs(error))}`}
          . Die {derivedCount} anderen Kontostände sind nach derselben Rechnung
          entstanden und damit belastbar.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-card border-l-2 border-kb-red bg-kb-surface/90 px-4 py-3">
      <p className="text-data-sm text-kb-grey-light">
        <span className="font-bold uppercase tracking-wider text-kb-red">
          Ungeprüft:
        </span>{" "}
        {hasOwnBudget && error !== null ? (
          <>
            Die Herleitung verfehlt dein eigenes Budget um {eur(Math.abs(error))} –
            mehr als das eine Prozent des Startkapitals ({eur(capital)}), das noch
            als Rundung durchgeht. Wahrscheinlich stimmen die Startwerte der Liga
            nicht, oder es werden doch Boni ausgezahlt.
          </>
        ) : (
          <>
            Ohne deinen eigenen Kontostand lässt sich die Rechnung nicht
            gegenprüfen. Die Zahlen sind eine Herleitung, keine Auskunft der API.
          </>
        )}{" "}
        Gelesen wurde der Transfergewinn als{" "}
        <span className="text-kb-white">{reading}</span>. Nimm die Budgets als grobe
        Richtung, nicht als Beleg.
      </p>
    </div>
  );
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
