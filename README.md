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
| `/dashboard` | Kaderansicht mit Filtern, Marktwerten, Prognose und Spielplan    |
| `/markt`     | Transfermarkt mit Kaufempfehlung und Maximalgebot                |
| `/liga`      | Tabelle mit Rückstand auf Platz 1                                |

## Das Dashboard

**Kennzahlen.** Teamwert, der maximale Kaderwert zu Spieltagsbeginn
(Teamwert + Budget) und das Budget selbst. Beim Budget steht dabei, wie weit
du ins Minus darfst: Kickbase erlaubt bis zu 33 % des Kaderwerts, wobei der
Kaderwert als Teamwert plus (negatives) Konto gerechnet wird. Die Formel steht
in `src/lib/budget.ts`. Zweite, davon unabhängige Regel: zum Spieltagsbeginn
muss das Konto wieder im Plus sein, sonst gibt es keine Punkte.

**Kaderansicht.** Suche über Name und Verein, Filter nach Position, Sortierung
nach Marktwert, 24 Stunden, 7 Tagen, Gewinn/Verlust seit Kauf, Prognose,
Schnitt, Punkten, Name oder Position. Pro Spieler: Foto, Vereinswappen,
Marktwert, 24-Stunden-Bewegung, 7-Tage-Bewegung, Gewinn/Verlust seit deinem
Kauf und die prognostizierte Entwicklung bis zum nächsten Spieltagsbeginn.

**Nächste drei Spiele.** Aus dem Bundesliga-Spielplan, eingefärbt nach
Gegnerstärke: rot für Gegner aus den oberen Tabellenrängen, gelb fürs
Mittelfeld, grün für machbare Aufgaben. Heimspiele werden zwei Tabellenplätze
milder gerechnet, Auswärtsspiele zwei härter. Liefert die API keine Tabelle,
bleibt alles gelb – geraten wird hier nichts.

## Wie die Prognose zustande kommt

Kickbase legt seine Marktwertformel nicht offen. Was die App macht, ist eine
Fortschreibung der beiden Bewegungen, die die API hergibt: 60 % der letzten
24 Stunden plus 40 % des Wochenschnitts, pro Tag um 15 % abklingend,
hochgerechnet auf die Tage bis zum nächsten Anpfiff. Das ist eine Heuristik,
keine Vorhersage – die Oberfläche sagt das auch so. Die Parameter stehen oben
in `src/lib/forecast.ts`.

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

Eine Falle, die lange falsch stand: `sdmvt` ist die Marktwertänderung der
letzten **sieben Tage** (seven day), `tfhmvt` die der letzten **24 Stunden**
(twenty four hour). Wer beides in denselben Topf wirft, zeigt eine
Wochenbewegung als Tageswert an. Die App führt beide Werte getrennt.

Die Zusatzendpunkte für Spielplan (`/v4/competitions/1/matchdays`) und
Bundesliga-Tabelle (`/v4/competitions/1/table`) sind nicht dokumentiert.
Antworten sie anders als erwartet, geben die Funktionen in
`src/lib/kickbase.ts` `null` zurück und die Oberfläche zeigt den Abschnitt
einfach nicht – eine fehlende Paarung darf nie das Dashboard zerlegen.

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
- Datenabruf in Server Components, kein clientseitiger API-Zugriff. Client ist
  nur, was interaktiv sein muss: Filter/Sortierung der Kaderansicht und die
  Bild-Platzhalter.
- Spielerfotos und Vereinswappen kommen direkt vom Kickbase-CDN. Bewusst als
  einfaches `<img>` statt `next/image`: die CDN-Pfade sind unvollständig
  dokumentiert, und ein 404 soll ein ruhiger Platzhalter sein statt eines
  Serverfehlers.
- Farben, Radien und Schriftgrößen des Corporate Designs stehen ausschließlich
  in `tailwind.config.ts` und `src/app/globals.css`. Wer exakte Markenwerte
  aus den offiziellen Kickbase-Brand-Guidelines hat, ändert nur diese beiden
  Dateien – die Hexwerte hier sind aus dem App-Auftritt abgeleitet.
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
Design ist an das Kickbase-Erscheinungsbild angelehnt; Spielerfotos und
Vereinswappen werden vom Kickbase-CDN geladen und nicht neu verteilt. Für den
privaten Gebrauch gedacht, Nutzung auf eigenes Risiko.

Die Einschätzungen sind eine Heuristik aus Marktwert-Trend, Punkteschnitt,
Einsatzfähigkeit und Gegnerstärke – kein Ersatz für dein eigenes Urteil. Ein
fallender Marktwert kurz vor einem guten Spielplan kann trotzdem ein Halten
sein.
