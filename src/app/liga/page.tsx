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
      <main className="mx-auto max-w-7xl animate-fade-up px-4 py-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h1 className="display text-xl">Liga</h1>
          <LeagueLead rows={rows} />
        </div>

        {/* Wie verlaesslich die hergeleiteten Konten sind, gehoert ueber die
            Tabelle und nicht ins Kleingedruckte. */}
        <CalibrationNote
          trusted={calibration.trusted}
          error={calibration.error}
          reading={calibration.reading}
          derivedCount={derivedCount}
          capital={startCapital(rules)}
          hasOwnBudget={myBudget !== null}
        />

        <LeagueTable rows={rows} matchday={matchday} />

        <div className="mt-4 space-y-2 text-data-xs leading-relaxed text-kb-grey">
          <p>
            <span className="font-semibold text-kb-grey-light">
              Woher das Budget kommt:
            </span>{" "}
            Kickbase zeigt die Kontostände deiner Mitspieler nicht an. Sie lassen
            sich aber ausrechnen, solange ohne Boni gespielt wird: Startkapital
            ({eur(rules.startTeamValue)} Startkader + {eur(rules.startBudget)}{" "}
            Budget) + Transfergewinn + stille Reserven des Kaders − aktueller
            Teamwert. Die stillen Reserven sind die Summe der Gewinne und
            Verluste seit Kauf über alle Spieler eines Kaders.
          </p>
          <p>
            <span className="font-semibold text-kb-grey-light">Andere Ligaregeln?</span>{" "}
            Startkader und Startbudget lassen sich über die Umgebungsvariablen{" "}
            <code className="text-kb-grey-light">KB_START_TEAM_VALUE</code> und{" "}
            <code className="text-kb-grey-light">KB_START_BUDGET</code> setzen.
            Werden in der Liga Boni ausgezahlt, stimmt die Rechnung nicht mehr –
            die Prüfung über der Tabelle schlägt dann Alarm.
          </p>
          <p>
            <span className="font-semibold text-kb-grey-light">Max. Kader:</span>{" "}
            Teamwert + Budget, also der größtmögliche Kaderwert zu
            Spieltagsbeginn. Darunter steht, bis wohin das Konto ins Minus darf
            ({Math.round(MAX_NEGATIVE_SHARE * 100)} % davon).
          </p>
        </div>
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
