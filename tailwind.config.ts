import type { Config } from "tailwindcss";

/**
 * Kickbase Corporate Design.
 *
 * Die Werte stammen aus den offiziellen Brand Guidelines (brand.kickbase.com,
 * Seiten Colour und System). Vorher standen hier aus dem App-Auftritt
 * abgeleitete Schaetzwerte - unter anderem ein signalgruener Akzent, den es
 * in der Marke gar nicht gibt.
 *
 * Kernaussage der Guidelines: "At its core, Kickbase is always black and
 * white. We use color sparingly and purposefully for maximum impact."
 * KB Live Red ist der einzige Akzent und steht fuer "moments of importance,
 * excitement, and emphasis" - nicht fuer Dekoration und nicht fuer "negativ".
 *
 * Was hier NICHT steht: die Hausschriften KB Pitch und KB Volksans. Die
 * Community Policy im Logo-Kit verbietet ihre Nutzung ausdruecklich
 * ("Use of the Kickbase font -> the font is exclusive to our brand").
 * Uebernommen sind deshalb die Satzregeln, nicht die Schriften selbst.
 */

/**
 * Die Guidelines kennen nur sechs Farben. Fuer Karten und Rahmen braucht ein
 * Dashboard Zwischenstufen - die entstehen ausschliesslich durch Mischung von
 * KB Dark Grey ueber KB Black. Das ist die ausdruecklich erlaubte Schichtung:
 * "Subtle, low-contrast pairings like KB Dark Grey on KB Black can be used
 * for layering, depth, and background structure."
 * Keine erfundenen Farbtoene, nur Anteile zweier Markenfarben.
 */
const BLACK = [19, 20, 23] as const; // #131417
const DARK_GREY = [71, 75, 78] as const; // #474B4E

function layer(alpha: number): string {
  const mix = BLACK.map((b, i) => Math.round(b + (DARK_GREY[i] - b) * alpha));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        kb: {
          // Die sechs Markenfarben, unveraendert aus den Guidelines.
          black: "#131417", // KB Black      RGB 19/20/23
          white: "#DEE4EC", // KB White      RGB 222/228/236 - kein reines Weiss
          red: "#FF4600", // KB Live Red   RGB 255/70/0, PMS Orange 021 C
          grey: {
            dark: "#474B4E", // KB Dark Grey   RGB 71/75/78
            DEFAULT: "#7E8187", // KB Grey        RGB 126/129/135
            light: "#A8ADB4", // KB Light Grey  RGB 168/173/180
          },

          /**
           * KB Dark Grey ist eine STRUKTURFARBE, keine Textfarbe.
           * Auf KB Black kommt sie auf 2,09:1 und liegt damit weit unter den
           * 4,5:1, die lesbarer Text braucht. Die Guidelines geben die
           * Paarung nur fuer "layering, depth, and background structure" frei.
           *
           * Als Text taugen auf KB Black:
           *   KB White       14,4:1
           *   KB Light Grey   8,2:1
           *   KB Live Red     5,4:1
           *   KB Grey         4,7:1
           */

          // Schichtung: KB Dark Grey ueber KB Black, in Stufen.
          surface: layer(0.07), // Karte
          raised: layer(0.12), // Karte im Hover, Chip
          line: layer(0.26), // Rahmen
          "line-strong": layer(0.42), // Rahmen, betont
        },
      },

      fontFamily: {
        /**
         * KB Pitch und KB Volksans sind laut Community Policy tabu. Statt
         * einer Nachahmung steht hier weiter die Systemschrift - das haelt
         * ausserdem die Zusage ein, dass die App keine externe Anfrage stellt.
         *
         * Uebernommen sind die Satzregeln der Guidelines: Headlines eng
         * gesetzt und versal, Fliesstext mit weitem Zeilenabstand. Siehe die
         * Zeilenhoehen unten und .display in globals.css.
         */
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },

      fontSize: {
        // Guidelines: Headline-Leading 0.9, Subheader 1.18, Body 1.4.
        subhead: ["1.0625rem", { lineHeight: "1.18" }],
        body: ["0.9375rem", { lineHeight: "1.4" }],
        // Enge, datenlastige Skala - die Zahlen sind der Inhalt.
        "data-xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
        "data-sm": ["0.8125rem", { lineHeight: "1.125rem" }],
      },

      spacing: {
        // Das Punktraster. Die Guidelines verlangen eine ueber alle
        // Anwendungen konstante Rastergroesse - deshalb genau ein Wert.
        dot: "24px",
      },

      borderRadius: {
        card: "0.75rem",
      },

      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.5)",
      },

      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.28s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
