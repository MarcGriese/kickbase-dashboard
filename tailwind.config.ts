import type { Config } from "tailwindcss";

/**
 * Kickbase Corporate Design.
 *
 * Die Marke lebt von drei Dingen: fast schwarze Flaechen, ein einziges
 * signalgruenes Akzentgruen und sehr enge, laut gesetzte Versalien fuer
 * Labels. Alles andere ist Grauwert.
 *
 * Die Hexwerte unten sind aus dem App-/Web-Auftritt abgeleitet. Wenn du
 * Zugriff auf brand.kickbase.com hast und exakte Werte willst: nur diese
 * Datei anfassen, der Rest der App benutzt ausschliesslich diese Tokens.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Flaechen - von der Seite bis zum kraeftigen Rahmen.
        night: {
          950: "#08090B", // Seitenhintergrund
          900: "#0D0F12", // App-Shell / Kopfzeile
          850: "#14171C", // Karte
          800: "#1B1F26", // Karte (hover) / Chip
          700: "#262B34", // Rahmen
          600: "#39404C", // Rahmen (kraeftig)
        },
        // Kickbase-Gruen: Akzent, Marke, positive Zahlen.
        kb: {
          DEFAULT: "#14E56D",
          dim: "#0FC65E",
          deep: "#0A8F44",
        },
        // Signalfarben fuer Zahlen und Gegnerstaerke.
        down: {
          DEFAULT: "#FF4D5E",
          dim: "#C4323F",
        },
        warn: {
          DEFAULT: "#FFB020",
          dim: "#C4831A",
        },
        // Schrift.
        snow: {
          DEFAULT: "#F5F7FA",
          muted: "#98A2B3",
          faint: "#667085",
        },
      },
      fontFamily: {
        // Systemschrift: kein Google-Fetch beim Build, keine externe Anfrage
        // im Browser. Willst du die Hausschrift, leg die woff2 in /public und
        // binde sie ueber next/font/local ein - dann hier voranstellen.
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
        // Enge, datenlastige Skala - die Zahlen sind der Inhalt.
        "data-xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
        "data-sm": ["0.8125rem", { lineHeight: "1.125rem" }],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.5)",
        kb: "0 0 0 1px rgba(20,229,109,0.35), 0 0 24px rgba(20,229,109,0.12)",
      },
      borderRadius: {
        card: "1rem",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(20,229,109,0.4)" },
          "70%": { boxShadow: "0 0 0 10px rgba(20,229,109,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(20,229,109,0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.28s ease-out both",
        "pulse-ring": "pulse-ring 2s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
