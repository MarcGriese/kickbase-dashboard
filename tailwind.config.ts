import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Kickbase-Look: tiefes Blauschwarz + ein einziger Neongruen-Akzent.
        pitch: {
          950: "#080B0F", // Seitenhintergrund
          900: "#0D1117", // App-Shell
          850: "#12181F", // Karte
          800: "#171E27", // Karte (hover)
          700: "#232C38", // Rahmen
          600: "#33404F", // Rahmen (kraeftig)
        },
        neon: {
          DEFAULT: "#00E087", // Akzent / positiv
          dim: "#00B36C",
          glow: "rgba(0, 224, 135, 0.16)",
        },
        loss: {
          DEFAULT: "#FF4757", // negativer Marktwert
          dim: "#C42F3C",
        },
        chalk: {
          DEFAULT: "#FFFFFF",
          muted: "#8A97A8",
          faint: "#5A6675",
        },
      },
      fontFamily: {
        // Systemschrift: kein Google-Fetch beim Build, keine externe Anfrage
        // im Browser. Willst du Inter, leg die woff2 in /public und binde sie
        // ueber next/font/local ein - dann hier "var(--font-inter)" voranstellen.
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
        card: "0 1px 2px rgba(0,0,0,0.4)",
        neon: "0 0 0 1px rgba(0,224,135,0.35), 0 0 24px rgba(0,224,135,0.12)",
      },
      borderRadius: {
        card: "0.875rem",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(0,224,135,0.4)" },
          "70%": { boxShadow: "0 0 0 10px rgba(0,224,135,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(0,224,135,0)" },
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
