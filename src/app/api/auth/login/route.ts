import { NextResponse } from "next/server";
import { login, getLeagues, KickbaseError } from "@/lib/kickbase";
import { setSession } from "@/lib/session";

export async function POST(req: Request) {
  let email: string, password: string, leagueHint: string | undefined;
  try {
    const body = await req.json();
    email = String(body.email ?? "").trim();
    password = String(body.password ?? "");
    leagueHint = body.league ? String(body.league) : undefined;
  } catch {
    return NextResponse.json({ error: "Ungueltige Anfrage." }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json(
      { error: "Bitte E-Mail und Passwort eingeben." },
      { status: 400 }
    );
  }

  try {
    const { token } = await login(email, password);
    const leagues = await getLeagues(token);

    if (!leagues.length) {
      return NextResponse.json(
        { error: "Zu diesem Konto gehoert keine Liga." },
        { status: 404 }
      );
    }

    let league = leagues[0];
    if (leagueHint) {
      const match = leagues.find((l: any) =>
        String(l.n ?? l.name ?? "").toLowerCase().includes(leagueHint!.toLowerCase())
      );
      if (match) league = match;
    }

    const leagueId = String(league.i ?? league.id ?? league.lid ?? "");
    setSession(token, leagueId);

    return NextResponse.json({
      ok: true,
      league: { id: leagueId, name: league.n ?? league.name ?? leagueId },
      leagues: leagues.map((l: any) => ({
        id: String(l.i ?? l.id ?? l.lid ?? ""),
        name: l.n ?? l.name ?? "Liga",
      })),
    });
  } catch (err) {
    const status = err instanceof KickbaseError ? err.status : 500;
    const message =
      err instanceof KickbaseError
        ? err.message
        : "Kickbase ist gerade nicht erreichbar.";
    return NextResponse.json({ error: message }, { status });
  }
}
