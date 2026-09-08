/**
 * Tests fuer die Kontoherleitung.
 *
 * Laufen ohne Testframework, direkt ueber den Node-Testrunner:
 *
 *   npm test
 *
 * Braucht Node 22.6+ (typeStripping). Aeltere Node-Versionen koennen die
 * TypeScript-Datei nicht direkt laden - dann bleibt der Build der Waechter.
 *
 * Warum ueberhaupt Tests fuer so wenig Code: das hier rechnet Geldbetraege
 * aus, die sonst niemand gegenpruefen kann. Die Kickbase-API zeigt fremde
 * Kontostaende nicht an, ein Vergleichswert fehlt also. Bleibt das
 * Nachrechnen der Buchhaltung an Faellen, die von Hand nachvollziehbar sind.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  calibrate,
  deriveBudget,
  parseRanking,
  rulesFromEnv,
  startCapital,
  sumUnrealized,
  DEFAULT_START_BUDGET,
  DEFAULT_START_TEAM_VALUE,
  type LeagueRules,
} from "./league.ts";

const RULES: LeagueRules = {
  startTeamValue: DEFAULT_START_TEAM_VALUE,
  startBudget: DEFAULT_START_BUDGET,
};

const MIO = 1_000_000;

/* -------------------------------------------------------------- Buchhaltung */

test("zum Saisonstart kommt das Startbudget heraus", () => {
  const budget = deriveBudget(
    { teamValue: 100 * MIO, profit: 0, unrealized: 0 },
    RULES,
    "realisiert"
  );
  assert.equal(budget, 50 * MIO);
});

test("Verkauf ueber Kaufpreis erhoeht das Budget um den Erloes", () => {
  // Spieler mit Kaufpreis 20 fuer 25 verkauft: Teamwert 80, Gewinn 5.
  // Konto: 50 + 25 = 75.
  const budget = deriveBudget(
    { teamValue: 80 * MIO, profit: 5 * MIO, unrealized: 0 },
    RULES,
    "realisiert"
  );
  assert.equal(budget, 75 * MIO);
});

test("Kauf senkt das Budget um den Kaufpreis", () => {
  // Nach obigem Verkauf fuer 30 zugekauft: Teamwert 110, Konto 75 − 30 = 45.
  const budget = deriveBudget(
    { teamValue: 110 * MIO, profit: 5 * MIO, unrealized: 0 },
    RULES,
    "realisiert"
  );
  assert.equal(budget, 45 * MIO);
});

test("steigende Marktwerte aendern das Budget nicht", () => {
  // Derselbe Kader wie eben, nur 10 Mio mehr wert. Das Konto bleibt bei 45.
  const budget = deriveBudget(
    { teamValue: 120 * MIO, profit: 5 * MIO, unrealized: 10 * MIO },
    RULES,
    "realisiert"
  );
  assert.equal(budget, 45 * MIO);
});

test("ein Konto darf auch negativ herauskommen", () => {
  // Teuer eingekauft: Teamwert 210, keine Reserven, kein Transfergewinn.
  const budget = deriveBudget(
    { teamValue: 210 * MIO, profit: 0, unrealized: 0 },
    RULES,
    "realisiert"
  );
  assert.equal(budget, -60 * MIO);
});

test("ohne Teamwert oder Gewinn gibt es kein Ergebnis statt einer Zahl", () => {
  assert.equal(
    deriveBudget({ teamValue: null, profit: 0, unrealized: 0 }, RULES, "realisiert"),
    null
  );
  assert.equal(
    deriveBudget({ teamValue: 100, profit: null, unrealized: 0 }, RULES, "realisiert"),
    null
  );
  // Fehlen die Reserven, faellt nur die Lesart "realisiert" aus - die andere
  // braucht sie nicht.
  assert.equal(
    deriveBudget(
      { teamValue: 100 * MIO, profit: 0, unrealized: null },
      RULES,
      "realisiert"
    ),
    null
  );
  assert.equal(
    deriveBudget(
      { teamValue: 100 * MIO, profit: 0, unrealized: null },
      RULES,
      "inklusive-reserven"
    ),
    50 * MIO
  );
});

test("abweichende Ligaregeln schlagen durch", () => {
  const rules: LeagueRules = { startTeamValue: 80 * MIO, startBudget: 20 * MIO };
  assert.equal(startCapital(rules), 100 * MIO);
  assert.equal(
    deriveBudget({ teamValue: 80 * MIO, profit: 0, unrealized: 0 }, rules, "realisiert"),
    20 * MIO
  );
});

/* -------------------------------------------------------------- Kalibrierung */

test("die Kalibrierung findet die Lesart, die den eigenen Kontostand trifft", () => {
  const me = { teamValue: 120 * MIO, profit: 5 * MIO, unrealized: 10 * MIO };
  // "realisiert" ergibt 45, "inklusive-reserven" ergibt 35.
  const c = calibrate(me, 45 * MIO, RULES);
  assert.equal(c.reading, "realisiert");
  assert.equal(c.error, 0);
  assert.equal(c.trusted, true);
});

test("enthaelt prft die Reserven schon, faellt die Wahl andersherum", () => {
  const me = { teamValue: 120 * MIO, profit: 15 * MIO, unrealized: 10 * MIO };
  // "realisiert" ergibt 55, "inklusive-reserven" ergibt 45.
  const c = calibrate(me, 45 * MIO, RULES);
  assert.equal(c.reading, "inklusive-reserven");
  assert.equal(c.error, 0);
});

test("eine grosse Abweichung gilt als ungeprueft, nicht als Wahrheit", () => {
  const me = { teamValue: 120 * MIO, profit: 5 * MIO, unrealized: 10 * MIO };
  // Keine der beiden Lesarten trifft: 45 und 35 gegen tatsaechlich 12.
  // Gewaehlt wird die naehere (35), aber vertrauenswuerdig ist das nicht.
  const c = calibrate(me, 12 * MIO, RULES);
  assert.equal(c.reading, "inklusive-reserven");
  assert.equal(c.error, 23 * MIO);
  assert.equal(c.trusted, false);
});

test("kleine Rundungsabweichungen bleiben vertrauenswuerdig", () => {
  const me = { teamValue: 120 * MIO, profit: 5 * MIO, unrealized: 10 * MIO };
  // 1 % von 150 Mio sind 1,5 Mio Toleranz.
  const c = calibrate(me, 44 * MIO, RULES);
  assert.equal(c.trusted, true);
  assert.equal(c.error, 1 * MIO);
});

test("ohne eigenen Kontostand wird nichts behauptet", () => {
  const c = calibrate({ teamValue: 120 * MIO, profit: 5 * MIO, unrealized: 0 }, null, RULES);
  assert.equal(c.trusted, false);
  assert.equal(c.error, null);
});

/* ------------------------------------------------------------------ Parser */

test("die Rangliste wird mit den v4-Kuerzeln gelesen", () => {
  const rows = parseRanking({
    mu: "u2",
    us: [
      { i: "u1", n: "Anna", sp: 1200, mdp: 240, tv: 180_000_000 },
      { i: "u2", n: "Marc", sp: 1100, mdp: 190, tv: 165_000_000 },
    ],
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Anna");
  assert.equal(rows[0].points, 1200);
  assert.equal(rows[0].matchdayPoints, 240);
  assert.equal(rows[0].teamValue, 180_000_000);
  assert.equal(rows[0].isMe, false);
  assert.equal(rows[1].isMe, true);
});

test("fehlende Spieltagspunkte sind null und nicht null Punkte", () => {
  const rows = parseRanking({ us: [{ i: "u1", n: "Anna", sp: 900 }] });
  assert.equal(rows[0].matchdayPoints, null);
  assert.equal(rows[0].teamValue, null);
  // Null Punkte am Spieltag muessen aber als 0 durchkommen.
  const zero = parseRanking({ us: [{ i: "u1", n: "Anna", sp: 900, mdp: 0 }] });
  assert.equal(zero[0].matchdayPoints, 0);
});

test("stille Reserven summieren sich ueber den Kader", () => {
  assert.equal(sumUnrealized([{ mvgl: 1000 }, { mvgl: -400 }, { mvgl: 200 }]), 800);
  assert.equal(sumUnrealized([]), null);
  assert.equal(sumUnrealized(null), null);
  // Ein Kader ohne mvgl-Feld ist unbekannt, nicht null Euro wert.
  assert.equal(sumUnrealized([{ mv: 5 }, { mv: 7 }]), null);
});

/* ------------------------------------------------------------------- Regeln */

test("Ligaregeln kommen aus der Umgebung, sonst aus den Vorgaben", () => {
  assert.deepEqual(rulesFromEnv({}), {
    startTeamValue: DEFAULT_START_TEAM_VALUE,
    startBudget: DEFAULT_START_BUDGET,
  });
  assert.deepEqual(
    rulesFromEnv({ KB_START_TEAM_VALUE: "80000000", KB_START_BUDGET: "20000000" }),
    { startTeamValue: 80_000_000, startBudget: 20_000_000 }
  );
  // Unsinn wird ignoriert statt uebernommen.
  assert.deepEqual(rulesFromEnv({ KB_START_TEAM_VALUE: "keine Zahl" }), {
    startTeamValue: DEFAULT_START_TEAM_VALUE,
    startBudget: DEFAULT_START_BUDGET,
  });
});
