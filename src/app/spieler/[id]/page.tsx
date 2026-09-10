import { redirect } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Empty, Sparkline, StatusFlag } from "@/components/ui";
import { PlayerPhoto, TeamCrest } from "@/components/Media";
import { getToken, getLeagueId } from "@/lib/session";
import { getSquad, getPlayerPerformance, KickbaseError } from "@/lib/kickbase";
import { pick, teamCrest, POSITION_LABELS } from "@/lib/fields";
import { playerImage } from "@/lib/images";
import { teamName } from "@/lib/fixtures";

export const dynamic = "force-dynamic";

export default async function SpielerPage({ params }: { params: { id: string } }) {
  const token = getToken();
  const leagueId = getLeagueId();
  if (!token || !leagueId) redirect("/login");

  const playerId = params.id;

  let squadRaw, performance;
  try {
    [squadRaw, performance] = await Promise.all([
      getSquad(token, leagueId).catch(() => [] as Record<string, any>[]),
      getPlayerPerformance(token, leagueId, playerId),
    ]);
  } catch (err) {
    if (err instanceof KickbaseError && err.status === 401) redirect("/login");
    throw err;
  }

  const raw = squadRaw.find((p) => String(pick(p, "id", "")) === playerId) ?? null;
  const first = String(pick(raw, "firstName", "")).trim();
  const last = String(pick(raw, "name", "Spieler"));
  const fullName = first ? `${first} ${last}` : last;
  const teamId = Number(pick(raw, "teamId", 0)) || 0;
  const pos = Number(pick(raw, "pos", 0)) || 0;
  const status = Number(pick(raw, "status", 0)) || 0;

  const played = (performance ?? []).filter((e) => e.points !== null);
  const values = played.map((e) => e.points as number);
  const total = values.reduce((s, v) => s + v, 0);
  const avg = values.length ? total / values.length : 0;
  const best = values.length ? Math.max(...values) : null;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl animate-fade-up px-4 py-6">
        <Link
          href="/dashboard"
          className="text-data-sm text-kb-grey transition-colors hover:text-kb-white"
        >
          ← Zurück zum Kader
        </Link>

        {/* Kopf ---------------------------------------------------------- */}
        <div className="mb-6 mt-3 flex items-center gap-4">
          <PlayerPhoto src={playerImage(raw)} name={fullName} size={56} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="display text-xl">{fullName}</h1>
              <StatusFlag status={status} />
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-data-sm text-kb-grey">
              <TeamCrest src={teamCrest(teamId)} name={teamName(teamId)} size={16} />
              <span>{teamName(teamId)}</span>
              {pos > 0 && (
                <>
                  <span className="opacity-50">·</span>
                  <span>{POSITION_LABELS[pos]}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {performance && performance.length ? (
          <>
            {/* Kennzahlen ----------------------------------------------- */}
            <div className="mb-4 grid grid-cols-3 gap-3">
              <div className="card p-4">
                <div className="label">Schnitt gespielt</div>
                <div className="num mt-1 text-2xl font-extrabold text-kb-white">
                  {avg.toFixed(0)}
                </div>
              </div>
              <div className="card p-4">
                <div className="label">Bestes Spiel</div>
                <div className="num mt-1 text-2xl font-extrabold text-kb-white">
                  {best ?? "–"}
                </div>
              </div>
              <div className="card p-4">
                <div className="label">Spiele gewertet</div>
                <div className="num mt-1 text-2xl font-extrabold text-kb-white">
                  {values.length}
                </div>
              </div>
            </div>

            {/* Verlauf --------------------------------------------------- */}
            {values.length >= 2 && (
              <div className="mb-4 card p-4">
                <div className="label mb-2">Punkteverlauf</div>
                <Sparkline values={values} />
              </div>
            )}

            {/* Spiel fuer Spiel ----------------------------------------- */}
            <section className="card overflow-hidden">
              <div className="border-b border-kb-line px-4 py-3">
                <h2 className="display text-base">Punkte je Spiel</h2>
              </div>
              <ul className="divide-y divide-kb-line/70">
                {performance.map((e) => (
                  <li
                    key={e.matchday}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="num w-16 shrink-0 text-data-xs text-kb-grey">
                      {e.matchday}. ST
                    </span>
                    {e.opponentId ? (
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-data-sm text-kb-grey-light">
                        <TeamCrest
                          src={teamCrest(e.opponentId)}
                          name={teamName(e.opponentId)}
                          size={14}
                        />
                        <span className="truncate">{teamName(e.opponentId)}</span>
                      </span>
                    ) : (
                      <span className="min-w-0 flex-1" />
                    )}
                    {e.minutes !== null && (
                      <span className="num text-data-xs text-kb-grey">{e.minutes}′</span>
                    )}
                    <span
                      className={`num w-12 text-right text-data-sm font-bold ${
                        e.points === null
                          ? "text-kb-grey"
                          : e.points > 0
                            ? "text-kb-white"
                            : "text-kb-grey-light"
                      }`}
                    >
                      {e.points === null ? "–" : e.points}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <section className="card overflow-hidden">
            <Empty
              title="Keine Spielpunkte verfügbar"
              hint="Die Kickbase-API hat für diesen Spieler keine Punkte je Spiel geliefert – der Endpunkt ist nicht offiziell dokumentiert und antwortet nicht immer."
            />
          </section>
        )}
      </main>
    </>
  );
}
