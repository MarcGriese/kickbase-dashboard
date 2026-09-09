/**
 * Das Kickbase-Logo aus dem Community Logo Kit.
 *
 * Bewusst als <img> mit fester Datei und nicht als Inline-SVG mit
 * currentColor: die Community Policy verbietet Umfaerben ausdruecklich
 * ("no distortion, recolouring or custom variations"). Als externe Datei
 * kann keine CSS-Regel das Logo einfaerben - auch nicht versehentlich.
 *
 * Aus demselben Grund stehen die Originalmasse hier fest und werden nur
 * proportional skaliert. Es gibt keine Prop, die Breite und Hoehe
 * unabhaengig setzt, damit das Logo nicht verzerrt werden kann.
 *
 * Farbwahl nach Guideline: "Use the logos in KB White or KB Black color
 * only." Auf dem dunklen Dashboard also durchweg die weisse Datei.
 */

/** Originalmasse der SVGs aus dem Kit - nicht raten, nicht anpassen. */
const ART = {
  mark: { w: 201, h: 209, file: "kickbase-logo" },
  lockup: { w: 1681, h: 215, file: "kickbase-lockup" },
} as const;

export function BrandLogo({
  variant = "mark",
  tone = "white",
  height,
  className = "",
}: {
  /** "mark" ist das Sternzeichen allein, "lockup" Zeichen plus Wortmarke. */
  variant?: keyof typeof ART;
  tone?: "white" | "black";
  /** Einzige Groessenangabe. Die Breite ergibt sich aus dem Seitenverhaeltnis. */
  height: number;
  className?: string;
}) {
  const art = ART[variant];
  const width = Math.round((art.w / art.h) * height);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/${art.file}-${tone}.svg`}
      alt="Kickbase"
      width={width}
      height={height}
      className={className}
      style={{ width, height }}
    />
  );
}
