/**
 * Bild-URLs fuer Spielerfotos und Vereinswappen.
 *
 * Warum das vorher nichts angezeigt hat: `pick(raw, "image")` wurde zwar
 * ausgelesen und bis in `RatedPlayer.image` durchgereicht - aber keine
 * einzige Komponente hat je ein <img> gerendert. Das Feld war tote Fracht,
 * und `teamId` wurde nicht einmal gelesen.
 *
 * Grundregel hier: was die API liefert, gewinnt. Geraten wird nur, wenn
 * Kickbase gar nichts mitschickt - und selbst dann faengt die Oberflaeche
 * ein totes Bild mit Initialen ab, statt ein kaputtes Symbol zu zeigen.
 */

import { pick } from "./fields";

const DEFAULT_CDN = "https://kickbase.b-cdn.net";

function cdn(): string {
  return (process.env.KB_IMAGE_BASE ?? DEFAULT_CDN).replace(/\/+$/, "");
}

/** Relativer Pfad oder schon vollstaendige URL - beides kommt vor. */
function absolute(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("//")) return `https:${v}`;
  return `${cdn()}/${v.replace(/^\/+/, "")}`;
}

/** Spielerfoto. Kommt als `pim` aus /squad und /market. */
export function playerImage(raw: Record<string, any> | null | undefined): string | null {
  if (!raw) return null;
  return absolute(pick(raw, "image", null));
}

/**
 * Vereinswappen. Liefert die API eine URL mit, nehmen wir die.
 * Sonst bauen wir sie aus der Team-ID - das Muster ist ueber
 * KB_TEAM_LOGO_TEMPLATE anpassbar, falls Kickbase es aendert.
 */
export function teamLogo(
  raw: Record<string, any> | null | undefined,
  teamId?: string | number | null
): string | null {
  const fromApi = raw ? absolute(pick(raw, "teamImage", null)) : null;
  if (fromApi) return fromApi;

  const id = teamId ?? (raw ? pick<string | number | null>(raw, "teamId", null) : null);
  if (id === null || id === undefined || id === "") return null;

  const template =
    process.env.KB_TEAM_LOGO_TEMPLATE ?? `${cdn()}/pool/teamsl/{id}.png`;
  return template.replace("{id}", String(id));
}

/** "Florian Wirtz" -> "FW". Fuer den Platzhalter, wenn kein Bild laedt. */
export function initials(name: string): string {
  // Bewusst ohne \p{L} und /u: tsconfig zielt auf ES5. An Leerzeichen,
  // Bindestrich, Punkt und Apostroph trennen deckt deutsche und
  // internationale Namen ab, ohne Umlaute wegzuwerfen.
  const parts = name.split(/[\s\-.'’]+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Stabile Abstufung pro Spieler, damit die Platzhalter unterscheidbar
 * bleiben und beim Neuladen nicht springen.
 *
 * Frueher war das ein freier HSL-Farbton - bunte Kreise quer durch den
 * Farbkreis. Das widerspricht dem Corporate Design frontal: die Marke ist
 * schwarz-weiss mit genau einem Akzent. Jetzt variiert nur die Helligkeit
 * innerhalb der drei Markengrautoene.
 */
export function avatarTone(seed: string): 0 | 1 | 2 {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 3;
  return h as 0 | 1 | 2;
}
