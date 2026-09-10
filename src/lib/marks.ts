"use client";

/**
 * Persoenliche Markierungen pro Spieler: "fest" (soll immer starten) und
 * "verkaufen" (soll raus). Rein lokal im Browser gehalten - es sind
 * Notizen des Nutzers, keine Kickbase-Daten, und sie sollen den Server nicht
 * belasten. Pro Liga getrennt, damit mehrere Ligen sich nicht ins Gehege kommen.
 */

import { useCallback, useEffect, useState } from "react";

export type MarkKind = "locked" | "sell";

export interface Marks {
  /** Fest gesetzt - steht wenn moeglich immer in der Elf. */
  locked: string[];
  /** Zum Verkauf markiert - faellt aus der empfohlenen Elf. */
  sell: string[];
}

const EMPTY: Marks = { locked: [], sell: [] };

function keyFor(leagueId: string): string {
  return `kb:marks:${leagueId}`;
}

function read(leagueId: string): Marks {
  try {
    const raw = localStorage.getItem(keyFor(leagueId));
    if (!raw) return EMPTY;
    const p = JSON.parse(raw);
    return {
      locked: Array.isArray(p?.locked) ? p.locked.map(String) : [],
      sell: Array.isArray(p?.sell) ? p.sell.map(String) : [],
    };
  } catch {
    return EMPTY;
  }
}

/**
 * Liest und schreibt die Markierungen einer Liga. Startet bewusst leer (wie der
 * Server rendert), fuellt sich erst nach dem ersten Client-Effekt - so gibt es
 * keinen Hydration-Konflikt. Aenderungen in einem anderen Tab kommen ueber das
 * storage-Event an.
 */
export function useMarks(leagueId: string) {
  const [marks, setMarks] = useState<Marks>(EMPTY);

  useEffect(() => {
    setMarks(read(leagueId));
    const onStorage = (e: StorageEvent) => {
      if (e.key === keyFor(leagueId)) setMarks(read(leagueId));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [leagueId]);

  const toggle = useCallback(
    (kind: MarkKind, id: string) => {
      setMarks((prev) => {
        const has = prev[kind].includes(id);
        let next: Marks = {
          ...prev,
          [kind]: has ? prev[kind].filter((x) => x !== id) : [...prev[kind], id],
        };
        // "fest" und "verkaufen" schliessen sich aus.
        if (!has) {
          const other: MarkKind = kind === "locked" ? "sell" : "locked";
          next = { ...next, [other]: next[other].filter((x) => x !== id) };
        }
        try {
          localStorage.setItem(keyFor(leagueId), JSON.stringify(next));
        } catch {
          /* privater Modus o. Ae. - dann bleibt es bei dieser Sitzung */
        }
        return next;
      });
    },
    [leagueId]
  );

  return { marks, toggle };
}
