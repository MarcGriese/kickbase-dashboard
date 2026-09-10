/**
 * Tests fuer das Parsen der echten Bundesliga-Daten.
 *
 * Die Feldnamen der inoffiziellen API sind geraten; diese Tests halten die
 * Kandidatenlisten und die abgeleiteten Werte (Tordifferenz, Formzeichen,
 * aktueller Spieltag) fest, damit ein Umbau nicht still etwas kaputt macht.
 *
 *   npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseBundesligaTable,
  parseMatches,
  currentMatchday,
  matchesOf,
  matchByTeam,
} from "./bundesliga.ts";

/* --------------------------------------------------------------- Tabelle */

test("parst die Tabelle und leitet Tordifferenz und Form ab", () => {
  const raw = {
    it: [
      { tid: 2, tn: "Bayern", cpl: 1, sp: 5, w: 5, d: 0, l: 0, g: 15, ga: 3, p: 15, form: ["W", "W", "D"] },
      { tid: 3, tn: "Dortmund", cpl: 2, sp: 5, w: 3, d: 1, l: 1, g: 10, ga: 8, p: 10, form: "L,W,W" },
    ],
  };
  const table = parseBundesligaTable(raw);
  assert.equal(table.length, 2);

  const fcb = table[0];
  assert.equal(fcb.teamId, 2);
  assert.equal(fcb.place, 1);
  assert.equal(fcb.points, 15);
  assert.equal(fcb.goalDiff, 12); // 15 - 3, obwohl gd fehlt
  assert.deepEqual(fcb.form, ["S", "S", "U"]);

  // Form als String mit Trennzeichen wird ebenso erkannt.
  assert.deepEqual(table[1].form, ["N", "S", "S"]);
});

test("leere oder fehlende Tabelle ergibt eine leere Liste", () => {
  assert.deepEqual(parseBundesligaTable(null), []);
  assert.deepEqual(parseBundesligaTable({ it: [] }), []);
});

/* --------------------------------------------------------------- Spieltag */

const MATCHDAYS = {
  it: [
    {
      day: 1,
      it: [
        { t1: 2, t2: 3, st: 2, t1g: 3, t2g: 1, dt: "2026-08-01T18:30:00Z" },
        { t1: 4, t2: 5, st: 2, t1g: 0, t2g: 0, dt: "2026-08-02T13:30:00Z" },
      ],
    },
    {
      day: 2,
      it: [
        { t1: 3, t2: 4, st: 1, t1g: 1, t2g: 1, dt: "2026-08-08T18:30:00Z" },
        { t1: 5, t2: 2, st: 0, dt: "2099-08-09T13:30:00Z" },
      ],
    },
  ],
};

test("parst Partien mit Ergebnis und Status", () => {
  const matches = parseMatches(MATCHDAYS);
  assert.equal(matches.length, 4);

  const opener = matches[0];
  assert.equal(opener.matchday, 1);
  assert.equal(opener.status, "beendet");
  assert.equal(opener.home.teamId, 2);
  assert.equal(opener.home.goals, 3);
  assert.equal(opener.away.goals, 1);

  const live = matches.find((m) => m.status === "live");
  assert.ok(live);
  assert.equal(live!.matchday, 2);

  const planned = matches.find((m) => m.status === "geplant");
  assert.ok(planned);
  assert.equal(planned!.home.goals, null);
});

test("aktueller Spieltag ist der mit einer laufenden Partie", () => {
  const matches = parseMatches(MATCHDAYS);
  assert.equal(currentMatchday(matches), 2);
});

test("ohne Live-Spiel zaehlt der naechste geplante Spieltag", () => {
  const matches = parseMatches({
    it: [
      { day: 1, it: [{ t1: 2, t2: 3, st: 2, t1g: 1, t2g: 0, dt: "2026-08-01T18:30:00Z" }] },
      { day: 2, it: [{ t1: 3, t2: 2, st: 0, dt: "2099-08-08T18:30:00Z" }] },
    ],
  });
  assert.equal(currentMatchday(matches), 2);
});

test("matchesOf und matchByTeam finden die Partien eines Vereins", () => {
  const matches = parseMatches(MATCHDAYS);
  const day2 = matchesOf(matches, 2);
  assert.equal(day2.length, 2);

  const map = matchByTeam(day2);
  // Team 3 spielt am 2. Spieltag zu Hause gegen 4.
  const m = map.get(3);
  assert.ok(m);
  assert.equal(m!.home.teamId, 3);
  assert.equal(m!.away.teamId, 4);
});
