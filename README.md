# Kaderzentrale

Ein lokales Next.js-Dashboard für deine Kickbase-Liga. Zieht Kader,
Transfermarkt und Tabelle über die (inoffizielle) Kickbase-API v4 und
übersetzt sie in Tagesentscheidungen: halten, verkaufen, kaufen – und bis zu
welchem Betrag.

## Starten

```bash
npm install
npm run dev
```

Dann <http://localhost:3000> öffnen und mit deinen Kickbase-Zugangsdaten
anmelden.

Für einen Produktions-Build lokal:

```bash
npm run build && npm start
```

## Anmeldung

Die App schickt E-Mail und Passwort einmalig an `api.kickbase.com` und legt den
zurückgegebenen Token in einem httpOnly-Cookie ab. Das Passwort wird nirgends
gespeichert, der Token nie an Browser-JavaScript ausgeliefert. Alle
API-Aufrufe laufen serverseitig – dein Browser spricht ausschließlich mit
deinem eigenen Next.js-Server.

**Wichtig:** Wenn du dich in der Kickbase-App mit Apple oder Facebook
anmeldest, funktioniert der API-Login nicht. Setz in der App zuerst unter
Einstellungen → Profil ein eigenes Passwort.

## Seiten

| Route        | Inhalt                                                          |
| ------------ | --------------------------------------------------------------- |
| `/dashboard` | Kader mit Halten/Verkaufen-Einschätzung, Teamwert, Tagesdelta    |
| `/markt`     | Transfermarkt mit Kaufempfehlung und Maximalgebot                |
| `/liga`      | Tabelle mit Rückstand auf Platz 1                                |

## Wie das Maximalgebot zustande kommt

Die Kickbase-API gibt die verdeckten Gebote und Kontostände deiner Mitspieler
**nicht** her. Kein Tool kann sie kennen – auch dieses nicht.

Stattdessen liest die App den Aktivitäts-Feed deiner Liga aus, vergleicht bei
real abgeschlossenen Transfers den gezahlten Preis mit dem damaligen Marktwert
und bildet daraus den Median. Das ergibt den ligaüblichen Aufschlag („in dieser
Liga wird typischerweise 8 % über Marktwert gezahlt"). Das Maximalgebot ist
Marktwert × dieser Faktor, gedeckelt auf dein Budget.

Bei weniger als drei auswertbaren Transfers fällt die App auf einen
konservativen Aufschlag von 5 % zurück und sagt das in der Oberfläche auch.

## Wenn Kickbase die API ändert

Kickbase nutzt sehr kurze Feldnamen (`mv`, `ap`, `sdmvt`, …). Alle diese
Kürzel stehen an genau einer Stelle: `src/lib/fields.ts` im Objekt `FIELDS`.
Ändert sich die API, passt du nur dort an.

Um die echten Feldnamen zu sehen, hilft das Python-Tool aus dem gleichen
Projekt:

```bash
python3 kickbase_advisor.py --debug 2> raw.txt
```

Besonders `/market` und `/activitiesFeed` sind in der öffentlichen Doku nur
teilweise mit Beispielantworten belegt – dort sind die Zuordnungen in
`fields.ts` und `advisor.ts` defensiv geraten und einen Abgleich wert. Der
Kader-Endpunkt war vollständig dokumentiert und sitzt sicher.

## Technisches

- Next.js 14 (App Router), React 18, TypeScript, Tailwind
- Datenabruf in Server Components, kein clientseitiger API-Zugriff
- Systemschriften statt Google Fonts: kein externer Request, kein Fetch beim
  Build. Willst du Inter, leg die woff2-Dateien in `/public` und binde sie
  über `next/font/local` ein.
- Bewusst auf Next 14 gepinnt: ab Next 15 ist `cookies()` asynchron, was das
  Session-Handling in `src/lib/session.ts` brechen würde. Die Version ist
  14.2.35, also die gepatchte 14er-Linie.
- `npm audit` meldet zwei Meldungen zu einem in Next eingebetteten PostCSS.
  Das betrifft nur die Build-Zeit (Auslesen von `.map`-Dateien beim
  CSS-Verarbeiten) und nicht den laufenden Server. Bereinigen ließe es sich
  nur mit dem Sprung auf Next 16.

## Rechtliches

Die verwendete API ist inoffiziell und nicht dokumentiert; Kickbase kann sie
jederzeit ändern oder den Zugriff unterbinden. Die App liest ausschließlich
Daten, die du in der App ohnehin siehst, und führt keine Transfers aus. Das
Design ist an Kickbase angelehnt, verwendet aber keine Logos oder Grafiken von
Kickbase. Nutzung auf eigenes Risiko.

Die Einschätzungen sind eine Heuristik aus Marktwert-Trend, Punkteschnitt und
Einsatzfähigkeit – kein Ersatz für dein eigenes Urteil. Ein fallender Marktwert
kurz vor einem guten Spielplan kann trotzdem ein Halten sein.
