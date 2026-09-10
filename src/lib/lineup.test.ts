/**
 * Tests fuer die Aufstellungs-Logik.
 *
 * Wie bei league.test.ts geht es um genau den Teil, den man nicht gegen die
 * API pruefen kann: Kickbase gibt weder eine "richtige" Elf noch eine
 * Punkteprognose her. Also rechnen wir die Auswahl an Faellen nach, die von
 * Hand nachvollziehbar sind.
 *
 *   npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  startScore,
  pickBestEleven,
  suggestReplacements,
  isAvailable,
  type Startable,
  type MarketStartable,
} from "./lineup.ts";
import type { Fixture, Strength } from "./fixtures.ts";

const MIO = 1_000_000;

function fx(strength: Strength): Fixture[] {
  return [
    {
      matchday: 1,
      opponentId: 99,
      opponentName: "Gegner",
      opponentShort: "GEG",
      home: true,
      kickoff: null,
      strength,
    },
  ];
}

function player(over: Partial<Startable>): Startable {
  return { id: "x", pos: 3, teamId: 1, average: 100, status: 0, ...over };
}

/* --------------------------------------------------------------- startScore */

test("Verletzte, Gesperrte und nicht Gemeldete haben Startwert 0", () => {
  for (const status of [1, 8, 16]) {
    assert.equal(startScore(player({ status }), new Map()), 0);
    assert.equal(isAvailable(status), false);
  }
});

test("Angeschlagene werden gedaempft, nicht ausgeschlossen", () => {
  assert.equal(startScore(player({ status: 2, average: 100 }), new Map()), 50);
  assert.equal(isAvailable(2), true);
});

test("Gegnerstaerke justiert den Startwert um 10 Prozent", () => {
  const byTeam = new Map<number, Fixture[]>();
  const p = player({ teamId: 1, average: 100 });

  const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9);

  byTeam.set(1, fx("hart"));
  close(startScore(p, byTeam), 90);
  byTeam.set(1, fx("leicht"));
  close(startScore(p, byTeam), 110);
  byTeam.set(1, fx("mittel"));
  close(startScore(p, byTeam), 100);
});

/* ----------------------------------------------------------- pickBestEleven */

test("waehlt die punktbeste Grundordnung und stellt elf auf", () => {
  const squad: Startable[] = [
    player({ id: "gk", pos: 1, average: 100 }),
    ...[90, 85, 80, 50, 40].map((a, i) => player({ id: `d${i}`, pos: 2, average: a })),
    ...[95, 90, 88, 60, 50, 40].map((a, i) => player({ id: `m${i}`, pos: 3, average: a })),
    ...[120, 110, 100].map((a, i) => player({ id: `a${i}`, pos: 4, average: a })),
  ];

  const lineup = pickBestEleven(squad);
  assert.ok(lineup);
  // 3 starke Stuermer und ein starkes Mittelfeld -> 3-4-3 gewinnt.
  assert.equal(lineup!.formation.name, "3-4-3");
  assert.equal(lineup!.starters.length, 11);
  assert.equal(lineup!.gk?.id, "gk");
  assert.equal(lineup!.bench.length, 4);
  // Der schwaechste Verteidiger (40) sitzt auf der Bank, nicht in der Elf.
  assert.ok(!lineup!.starters.some((p) => p.id === "d4"));
});

test("baut ohne Standard-Ordnung eine ehrliche Notloesung", () => {
  const tiny: Startable[] = [
    player({ id: "gk", pos: 1, average: 50 }),
    player({ id: "d0", pos: 2, average: 40 }),
    player({ id: "m0", pos: 3, average: 60 }),
  ];
  const lineup = pickBestEleven(tiny);
  assert.ok(lineup);
  assert.equal(lineup!.starters.length, 3);
  assert.equal(lineup!.gk?.id, "gk");
});

test("leerer Kader ergibt keine Aufstellung", () => {
  assert.equal(pickBestEleven([]), null);
});

/* -------------------------------------------------- suggestReplacements */

function market(over: Partial<MarketStartable>): MarketStartable {
  return {
    id: "m",
    pos: 2,
    teamId: 2,
    average: 90,
    status: 0,
    marketValue: 5 * MIO,
    price: 5 * MIO,
    maxBid: 6 * MIO,
    ...over,
  };
}

test("schlaegt positionsgleich einen klar besseren, bezahlbaren Spieler vor", () => {
  const starters: (Startable & { marketValue: number })[] = [
    { ...player({ id: "weak-def", pos: 2, average: 40 }), marketValue: 3 * MIO },
  ];
  const candidates = [
    market({ id: "good-def", pos: 2, average: 90 }),
    market({ id: "good-att", pos: 4, average: 200 }), // andere Position -> ignoriert
  ];

  const swaps = suggestReplacements(starters, candidates, new Map(), {
    budget: 10 * MIO,
  });

  assert.equal(swaps.length, 1);
  assert.equal(swaps[0].out.id, "weak-def");
  assert.equal(swaps[0].incoming.id, "good-def");
  assert.equal(swaps[0].improvement, 50);
  // Netto = Maximalgebot 6 Mio - Verkaufserloes 3 Mio = 3 Mio.
  assert.equal(swaps[0].netCost, 3 * MIO);
});

test("filtert Wechsel, die das Budget sprengen", () => {
  const starters = [{ ...player({ id: "d", pos: 2, average: 40 }), marketValue: 1 * MIO }];
  const candidates = [market({ id: "pricey", pos: 2, average: 90, maxBid: 6 * MIO })];

  const swaps = suggestReplacements(starters, candidates, new Map(), { budget: 1 * MIO });
  assert.equal(swaps.length, 0); // Netto 5 Mio > Budget 1 Mio
});

test("keine marginalen Wechsel unter der 10-Prozent-Schwelle", () => {
  const starters = [{ ...player({ id: "d", pos: 2, average: 100 }), marketValue: 1 * MIO }];
  const candidates = [market({ id: "barely", pos: 2, average: 105 })]; // nur +5 %

  const swaps = suggestReplacements(starters, candidates, new Map(), { budget: 99 * MIO });
  assert.equal(swaps.length, 0);
});

test("jeder Stammspieler und jeder Zugang wird hoechstens einmal getauscht", () => {
  const starters = [
    { ...player({ id: "d1", pos: 2, average: 40 }), marketValue: 1 * MIO },
    { ...player({ id: "d2", pos: 2, average: 42 }), marketValue: 1 * MIO },
  ];
  const candidates = [
    market({ id: "top", pos: 2, average: 120, maxBid: 2 * MIO }),
    market({ id: "solid", pos: 2, average: 90, maxBid: 2 * MIO }),
  ];

  const swaps = suggestReplacements(starters, candidates, new Map(), { budget: 99 * MIO });
  assert.equal(swaps.length, 2);
  const outs = swaps.map((s) => s.out.id).sort();
  const ins = swaps.map((s) => s.incoming.id).sort();
  assert.deepEqual(outs, ["d1", "d2"]);
  assert.deepEqual(ins, ["solid", "top"]);
});
