/**
 * Ligatabelle: Kontostaende der Mitspieler herleiten.
 *
 * Kickbase zeigt dir das Budget deiner Mitspieler bewusst nicht - das ist
 * Teil des Spiels. Rechnen kann man es trotzdem, weil alle Zutaten oeffentlich
 * sind: Teamwert, realisierter Transfergewinn und die Gewinn/Verlust-Summe
 * ihres aktuellen Kaders.
 *
 * Herleitung (ohne Boni, das ist die Bedingung):
 *
 *   Budget = Startbudget + Verkaeufe − Kaeufe
 *
 * Der Startkader wurde nicht gekauft, sondern zugeteilt. Nennen wir seinen
 * Zuteilungswert I, den realisierten Transfergewinn R (Verkaufserloes minus
 * Kaufpreis der verkauften Spieler) und die stillen Reserven des aktuellen
 * Kaders U (Summe aller mvgl, also Marktwert minus Kaufpreis). Dann gilt fuer
 * die Anschaffungskosten des aktuellen Kaders:
 *
 *   Kosten = I + Kaeufe − Kaufpreise der verkauften Spieler
 *   Kosten = Teamwert − U
 *
 * Einsetzen und aufloesen ergibt:
 *
 *   Budget = Startbudget + I + R + U − Teamwert
 *          = Startkapital + R + U − Teamwert
 *
 * Probe zum Saisonstart: R = 0, U = 0, Teamwert = I
 *   Budget = (50 + 100) + 0 + 0 − 100 = 50 Mio. Stimmt.
 *
 * Die Formel steht und faellt mit zwei Annahmen: keine Boni, und "prft" aus
 * dem Manager-Dashboard ist der realisierte Transfergewinn. Beides pruefen wir
 * nicht durch Glauben, sondern durch Nachrechnen - siehe `calibrate()`.
 */

/** Zugeteilter Startkader, in dieser Liga 100 Mio. */
export const DEFAULT_START_TEAM_VALUE = 100_000_000;
/** Startbudget, in dieser Liga 50 Mio. */
export const DEFAULT_START_BUDGET = 50_000_000;

// Bewusst ohne Importe: dieses Modul ist reine Rechnerei und laesst sich so
// direkt vom Node-Testrunner laden. Die 33-%-Regel liegt in ./budget.ts und
// wird von der Seite dazugeholt.

export interface LeagueRules {
  startTeamValue: number;
  startBudget: number;
}

export function startCapital(rules: LeagueRules): number {
  return rules.startTeamValue + rules.startBudget;
}

/**
 * Liest die Ligaregeln aus der Umgebung. Nicht jede Liga startet mit
 * 100 + 50 Mio, deshalb ueberschreibbar.
 */
export function rulesFromEnv(env: Record<string, string | undefined>): LeagueRules {
  return {
    startTeamValue: positive(env.KB_START_TEAM_VALUE) ?? DEFAULT_START_TEAM_VALUE,
    startBudget: positive(env.KB_START_BUDGET) ?? DEFAULT_START_BUDGET,
  };
}

function positive(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* --------------------------------------------------------------- Manager */

export interface ManagerRow {
  id: string;
  name: string;
  /** Gesamtpunkte der Saison. */
  points: number;
  /** Punkte des zuletzt gewerteten Spieltags, falls die API sie liefert. */
  matchdayPoints: number | null;
  teamValue: number | null;
  /** Realisierter Transfergewinn ("prft" aus dem Manager-Dashboard). */
  profit: number | null;
  /** Stille Reserven des Kaders: Summe der mvgl. */
  unrealized: number | null;
  isMe: boolean;
}

/**
 * Liest die Rangliste. Feldnamen laut v4-Doku: sp, mdp, tv, i, n.
 *
 * Die Antwort enthaelt kein Feld, das den eigenen Eintrag markiert. Die
 * eigene ID kommt deshalb von aussen (getMyId); ohne sie bleibt als
 * Rueckfallebene der Versuch, sie aus der Antwort zu lesen.
 */
export function parseRanking(
  raw: Record<string, any>,
  meId?: string | null
): ManagerRow[] {
  const ownId = String(meId ?? "") || String(raw?.me?.i ?? raw?.mu ?? "");
  const items: any[] = raw?.us ?? raw?.it ?? raw?.users ?? [];

  return items.map((u) => {
    const id = String(u?.i ?? u?.id ?? "");
    return {
      id,
      name: String(u?.n ?? u?.unm ?? u?.name ?? "Manager"),
      points: Number(u?.sp ?? u?.p ?? u?.points ?? 0) || 0,
      matchdayPoints: numOrNull(u?.mdp),
      teamValue: numOrNull(u?.tv),
      profit: null,
      unrealized: null,
      isMe: id !== "" && id === ownId,
    };
  });
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Summe der Gewinn/Verlust-Werte eines fremden Kaders. */
export function sumUnrealized(squad: Record<string, any>[] | null): number | null {
  if (!squad || !squad.length) return null;
  let sum = 0;
  let seen = 0;
  for (const p of squad) {
    const v = numOrNull(p?.mvgl);
    if (v !== null) {
      sum += v;
      seen++;
    }
  }
  return seen ? sum : null;
}

/**
 * Aktueller Kaderwert eines Managers: Summe der Marktwerte (`mv`) seines
 * Kaders. Das ist der Teamwert, den Kickbase live anzeigt - und die richtige
 * Grundlage der Budget-Herleitung. Der `tv` aus der Rangliste hinkt dagegen
 * teils einen Spieltag hinterher, was die Herleitung gegen die stillen
 * Reserven desselben (aktuellen) Kaders verfaelscht.
 */
export function sumMarketValue(squad: Record<string, any>[] | null): number | null {
  if (!squad || !squad.length) return null;
  let sum = 0;
  let seen = 0;
  for (const p of squad) {
    const v = numOrNull(p?.mv ?? p?.marketValue);
    if (v !== null) {
      sum += v;
      seen++;
    }
  }
  return seen ? sum : null;
}

/* ---------------------------------------------------------------- Budget */

/**
 * Ob "prft" als realisierter Gewinn zu lesen ist (dann kommen die stillen
 * Reserven noch dazu) oder ob es sie bereits enthaelt. Welche Lesart stimmt,
 * entscheidet nicht die Vermutung, sondern der Abgleich mit dem eigenen,
 * echten Kontostand.
 */
export type ProfitReading = "realisiert" | "inklusive-reserven";

export function deriveBudget(
  m: Pick<ManagerRow, "teamValue" | "profit" | "unrealized">,
  rules: LeagueRules,
  reading: ProfitReading
): number | null {
  if (m.teamValue === null || m.profit === null) return null;
  const reserves = reading === "realisiert" ? m.unrealized : 0;
  if (reserves === null) return null;
  return startCapital(rules) + m.profit + reserves - m.teamValue;
}

export interface Calibration {
  reading: ProfitReading;
  /** Abweichung der Herleitung vom echten eigenen Budget, in Euro. */
  error: number | null;
  /** Unter 1 % des Startkapitals sehen wir die Herleitung als bestaetigt an. */
  trusted: boolean;
}

/**
 * Rechnet beide Lesarten gegen den einzigen Kontostand, den wir sicher kennen:
 * den eigenen. Die Lesart mit der kleineren Abweichung gilt fuer alle.
 *
 * Ohne eigenen Kontostand faellt die Funktion auf "realisiert" zurueck und
 * sagt ausdruecklich, dass nichts geprueft wurde.
 */
export function calibrate(
  me: Pick<ManagerRow, "teamValue" | "profit" | "unrealized"> | null,
  actualBudget: number | null,
  rules: LeagueRules
): Calibration {
  if (!me || actualBudget === null) {
    return { reading: "realisiert", error: null, trusted: false };
  }

  const candidates: { reading: ProfitReading; error: number }[] = [];
  for (const reading of ["realisiert", "inklusive-reserven"] as ProfitReading[]) {
    const derived = deriveBudget(me, rules, reading);
    if (derived !== null) {
      candidates.push({ reading, error: derived - actualBudget });
    }
  }

  if (!candidates.length) {
    return { reading: "realisiert", error: null, trusted: false };
  }

  candidates.sort((a, b) => Math.abs(a.error) - Math.abs(b.error));
  const best = candidates[0];
  const tolerance = startCapital(rules) * 0.01;

  return {
    reading: best.reading,
    error: best.error,
    trusted: Math.abs(best.error) <= tolerance,
  };
}
