# Kickbase-Logos

Diese vier Dateien stammen unveraendert aus dem offiziellen **Kickbase
Community Logo Kit** (Ordner `02_Logos`, jeweils die RGB-Variante fuer
Digital). Sie wurden nur umbenannt, sonst nichts: gleiche Pfade, gleiche
Farbwerte, kein Nachzeichnen, kein Optimierungslauf.

| Datei                        | Original im Kit                              |
| ---------------------------- | -------------------------------------------- |
| `kickbase-logo-white.svg`    | `KB White (RGB-for digital)/02_Logo`          |
| `kickbase-logo-black.svg`    | `KB Black (RGB-for digital)/02_Logo`          |
| `kickbase-lockup-white.svg`  | `KB White (RGB-for digital)/01_Lockup`        |
| `kickbase-lockup-black.svg`  | `KB Black (RGB-for digital)/01_Lockup`        |

## Was die Community Policy erlaubt

Aus `01_How to use - Read first!` im Kit:

> You may use the Kickbase logo for private, non-commercial purposes.
> Please only use the logo from this official Kickbase Community Kit.
> Use must always be fair and respectful.

Dieses Dashboard laeuft lokal auf einem privaten Rechner und verkauft
nichts. Das deckt sich mit der Erlaubnis.

## Was sie verbietet

> Changes to the logo → no distortion, recolouring or custom variations.

Deshalb werden die Dateien als `<img>` eingebunden und **nicht** als Inline-SVG
mit `currentColor`. So kann keine CSS-Regel sie versehentlich einfaerben. Wer
das Logo dunkel braucht, nimmt die schwarze Datei - er faerbt nicht die weisse
um. Die Seitenverhaeltnisse stehen fest in `BrandLogo`; skaliert wird nur
proportional.

> Use of the Kickbase font → the font is exclusive to our brand.

**KB Pitch und KB Volksans sind hier deshalb nicht eingebunden**, obwohl die
Brand Guidelines sie als Haus-Schriften fuehren. Die App uebernimmt nur die
Satzregeln (Zeilenabstaende 0.9 / 1.18 / 1.4, Versalien bei Labels und
Timestamps, tabellarische Ziffern) und setzt sie in der Systemschrift. Wer
diese Datei liest und die Schriften doch einbauen will: nicht tun.

> Commercial use → no sale of products with the logo or font.

Falls dieses Projekt je oeffentlich gehostet oder kommerziell wird, muessen
diese Dateien vorher raus.
