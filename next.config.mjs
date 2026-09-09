/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Start-Hook in src/instrumentation.ts. In Next 14 noch hinter dem Flag.
    instrumentationHook: true,
    // better-sqlite3 ist ein natives Modul: webpack darf es nicht buendeln,
    // sonst findet der Server die .node-Binary zur Laufzeit nicht.
    serverComponentsExternalPackages: ["better-sqlite3"],
  },

  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === "nodejs") {
      // Nicht buendeln, sondern zur Laufzeit nachladen - sonst findet der
      // Server die kompilierte .node-Binary nicht.
      config.externals = [...(config.externals ?? []), "better-sqlite3"];
    }
    if (nextRuntime === "edge") {
      // instrumentation.ts wird fuer BEIDE Laufzeiten uebersetzt, laeuft aber
      // nur unter Node - siehe die NEXT_RUNTIME-Wache dort. webpack folgt dem
      // dynamischen Import trotzdem und zieht SQLite samt `fs`/`path` ins
      // Edge-Bundle, wo es die beiden nicht gibt.
      //
      // Deshalb hier auf ein leeres Modul umbiegen. Das ist sicher, weil im
      // Edge-Bundle nie eine dieser Zeilen ausgefuehrt wird. Kommt spaeter
      // echte Edge-Middleware dazu, die Dateien lesen will, faellt sie hier
      // auf - dann gehoert dieser Block ueberdacht.
      config.resolve.alias = {
        ...config.resolve.alias,
        "better-sqlite3": false,
        fs: false,
        path: false,
      };
    }
    return config;
  },

  // Kein next/image: Kickbase liefert Spielerfotos ueber wechselnde
  // CDN-Hosts aus, und next/image verweigert jeden Host, der hier nicht
  // eingetragen ist - sichtbar als leere Flaeche, ohne Fehlermeldung.
  // Die Bilder laufen ueber ein einfaches <img> in PlayerAvatar.tsx, das
  // ein totes Bild mit Initialen auffaengt. Wer doch auf next/image
  // umstellt, traegt die Hosts hier ein:
  //   images: { remotePatterns: [{ protocol: "https", hostname: "kickbase.b-cdn.net" }] }
};
export default nextConfig;
