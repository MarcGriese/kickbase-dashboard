import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { StatTile } from "@/components/ui";
import { SquadTable } from "@/components/SquadTable";
import { getToken, getLeagueId } from "@/lib/session";
import {
  getSquad,
  getTeamOverview,
  getMatchdays,
  getCompetitionTable,
  KickbaseError,
} from "@/lib/kickbase";
import { rateOwn } from "@/lib/advisor";
import { buildSchedule, buildTable } from "@/lib/fixtures";
import { daysUntil } from "@/lib/forecast";
import { budgetRoom, MAX_NEGATIVE_SHARE } from "@/lib/budget";
import { eur, eurDelta, shortDate } from "@/lib/fields";

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

  const players = squadRaw.map((raw) =>
    rateOwn(raw, { fixturesByTeam: schedule.byTeam, forecastDays })
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
      <main className="mx-auto max-w-7xl animate-fade-up px-4 py-6">
        {/* ----------------------------------------------------- Kopfzeile */}
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="display text-xl">Übersicht</h1>
          <p className="text-data-sm text-snow-muted">
            {matchdayLabel} beginnt{" "}
            <span className="font-semibold text-snow">{horizonLabel}</span>
            {horizonDate && ` · noch ${forecastDays} Tag${forecastDays === 1 ? "" : "e"}`}
          </p>
        </div>

        {/* -------------------------------------------------------- Kachel */}
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            big
            label="Teamwert"
            value={eur(teamValue)}
            hint={
              overview.teamValue === null
                ? "aus den Marktwerten summiert"
                : `${players.length} Spieler · Summe der Marktwerte ${eur(summed)}`
            }
          />

          <StatTile
            big
            label="Max. Kaderwert zu Spieltagsbeginn"
            value={eur(room.squadValue)}
            accent
            hint={`Teamwert ${eur(teamValue)} + Budget ${eur(budget ?? 0)} – so viel Kader könntest du bis zum Anpfiff auf dem Platz haben.`}
          />

          <StatTile
            big
            label="Budget"
            value={budget !== null ? eur(budget) : "–"}
            tone={budget !== null && budget < 0 ? "down" : "neutral"}
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

        {sells.length > 0 && (
          <div className="mb-6 rounded-card border border-down/25 bg-down/5 px-4 py-3">
            <p className="text-data-sm">
              <span className="font-bold uppercase tracking-wider text-down">
                Heute trennen:
              </span>{" "}
              <span className="text-snow-muted">
                {sells.map((p) => p.fullName).join(", ")}
              </span>
            </p>
          </div>
        )}

        {/* --------------------------------------------------------- Kader */}
        <SquadTable players={players} horizon={horizonLabel} />

        <div className="mt-4 space-y-2 text-data-xs leading-relaxed text-snow-faint">
          <p>
            Die Einschätzung gewichtet Marktwert-Trend, Punkteschnitt,
            Einsatzfähigkeit und die Stärke der nächsten Gegner. Sie ersetzt kein
            eigenes Urteil – bei Spielern kurz vor einem guten Spielplan kann Halten
            trotz fallendem Marktwert richtig sein.
          </p>
          <p>
            <span className="font-semibold text-snow-muted">Prognose:</span> 60 % der
            Bewegung der letzten 24 Stunden plus 40 % des Wochenschnitts, pro Tag um
            15 % abklingend, hochgerechnet bis zum Anpfiff. Kickbase legt seine
            Marktwertformel nicht offen – das hier ist eine Fortschreibung, keine
            Vorhersage.
          </p>
          <p>
            <span className="font-semibold text-snow-muted">Gegnerfarben:</span> rot =
            Gegner aus den oberen Tabellenrängen, gelb = Mittelfeld, grün = machbar.
            Heimspiele werden zwei Plätze milder, Auswärtsspiele zwei Plätze härter
            gerechnet. Ohne Tabelle von der API bleibt alles gelb.
          </p>
          <p>
            <span className="font-semibold text-snow-muted">Minus-Grenze:</span> Dein
            Konto darf bis zu {Math.round(MAX_NEGATIVE_SHARE * 100)} % des Kaderwerts
            (Teamwert + Budget) im Minus stehen.
          </p>
        </div>
      </main>
    </>
  );
}
