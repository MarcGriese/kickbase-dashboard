/**
 * Kickbase-Kontostand: was der Kader wert ist und wie weit du ins Minus darfst.
 *
 * Die 33-%-Regel: Dein Konto darf bis zu 33 % deines Kaderwerts im Minus
 * stehen, wobei Kickbase den Kaderwert als Teamwert plus (negatives) Konto
 * rechnet. Beispiel aus der Kickbase-Hilfe: 100 Mio Teamwert bei −10 Mio Konto
 * ergibt eine Grenze von rund −30 Mio (33 % von 90 Mio).
 *
 * Zweite, unabhaengige Regel: Zum Spieltagsbeginn muss das Konto im Plus sein,
 * sonst gibt es fuer diesen Spieltag keine Punkte. Deshalb ist das Minus
 * ausdruecklich ein Spielraum fuer den Markt, kein Dauerzustand.
 */

/** Anteil des Kaderwerts, den du ueberziehen darfst. */
export const MAX_NEGATIVE_SHARE = 0.33;

export interface BudgetRoom {
  /** Teamwert + Budget - der maximale Kaderwert zu Spieltagsbeginn. */
  squadValue: number;
  /** Betrag, bis zu dem das Konto ins Minus darf (positive Zahl). */
  maxNegative: number;
  /** Was du insgesamt noch ausgeben koenntest: Budget + erlaubtes Minus. */
  spendable: number;
}

export function budgetRoom(teamValue: number, budget: number | null): BudgetRoom {
  const b = budget ?? 0;
  const squadValue = teamValue + b;
  const maxNegative = Math.max(0, squadValue * MAX_NEGATIVE_SHARE);
  return { squadValue, maxNegative, spendable: b + maxNegative };
}
