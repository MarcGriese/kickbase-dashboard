import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Empty } from "@/components/ui";
import { getToken, getLeagueId } from "@/lib/session";
import { getRanking, KickbaseError } from "@/lib/kickbase";
import { eur } from "@/lib/fields";

export const dynamic = "force-dynamic";

interface Manager {
  id: string;
  name: string;
  points: number;
  teamValue: number | null;
  isMe: boolean;
}

export default async function LigaPage() {
  const token = getToken();
  const leagueId = getLeagueId();
  if (!token || !leagueId) redirect("/login");

  let raw;
  try {
    raw = await getRanking(token, leagueId);
  } catch (err) {
    if (err instanceof KickbaseError && err.status === 401) redirect("/login");
    throw err;
  }

  const meId = String(raw.me?.i ?? raw.mu ?? "");
  const items: any[] = raw.us ?? raw.it ?? raw.users ?? [];

  const managers: Manager[] = items.map((u) => ({
    id: String(u.i ?? u.id ?? ""),
    name: String(u.n ?? u.name ?? "Manager"),
    points: Number(u.sp ?? u.p ?? u.points ?? 0),
    teamValue: u.tv ?? u.teamValue ?? null,
    isMe: String(u.i ?? u.id ?? "") === meId,
  }));

  const leader = managers[0]?.points ?? 0;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl animate-fade-up px-4 py-6">
        <section className="card overflow-hidden">
          <div className="flex items-baseline justify-between border-b border-night-700 px-4 py-3">
            <h2 className="display text-base">Tabelle</h2>
            <span className="label">Rückstand auf Platz 1</span>
          </div>

          {managers.length ? (
            <ul>
              {managers.map((m, i) => {
                const gap = leader - m.points;
                return (
                  <li
                    key={m.id || i}
                    className={`flex items-center gap-3 border-b border-night-700/70 px-4 py-3 last:border-0 ${
                      m.isMe ? "bg-kb/5" : ""
                    }`}
                  >
                    <span
                      className={`num w-7 shrink-0 text-center text-data-sm font-bold ${
                        i === 0 ? "text-kb" : "text-snow-faint"
                      }`}
                    >
                      {i + 1}
                    </span>

                    <span
                      className={`min-w-0 flex-1 truncate ${
                        m.isMe ? "font-bold text-kb" : "font-medium"
                      }`}
                    >
                      {m.name}
                      {m.isMe && (
                        <span className="ml-2 text-data-xs font-normal text-snow-faint">
                          du
                        </span>
                      )}
                    </span>

                    {m.teamValue !== null && (
                      <span className="num hidden w-24 text-right text-data-sm text-snow-muted sm:block">
                        {eur(m.teamValue)}
                      </span>
                    )}

                    <span className="num w-20 text-right text-data-sm font-semibold">
                      {m.points.toLocaleString("de-DE")}
                    </span>

                    <span className="num w-20 text-right text-data-sm text-snow-faint">
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
