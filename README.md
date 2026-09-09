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

## Tests

```bash
npm test
```

Getestet wird die Buchhaltung hinter den hergeleiteten Kontoständen
(`src/lib/league.ts`) – der einzige Teil der App, den man nicht gegen die API
prüfen kann, weil fremde Budgets dort gar nicht auftauchen. Läuft über den
Node-Testrunner ohne zusätzliches Framework und braucht Node 22.6+.

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
| `/liga`      | Tabelle nach Punkten, mit hergeleiteten Kontoständen aller Manager |

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

**Nächste drei Spiele.** Aus dem Bundesliga-Spielplan, abgestuft nach
Gegnerstärke: rot umrandet für Gegner aus den oberen Tabellenrängen, grau fürs
Mittelfeld, weiß für machbare Aufgaben. Heimspiele werden zwei Tabellenplätze
milder gerechnet, Auswärtsspiele zwei härter. Liefert die API keine Tabelle,
bleibt alles grau – geraten wird hier nichts. Warum keine Ampel aus Rot, Gelb
und Grün: siehe Corporate Design.

## Die Liga-Tabelle

Sortiert nach Gesamtpunkten – so wird die Liga entschieden. Jede Spalte lässt
sich per Klick auf die Überschrift umsortieren, die Platzierung bleibt dabei
die aus den Punkten. Neben Gesamtpunkten stehen die Punkte des zuletzt
gewerteten Spieltags (`mdp` aus der Rangliste), Teamwert, Transfergewinn,
Budget und der maximale Kaderwert.

### Wie die fremden Kontostände zustande kommen

Kickbase zeigt dir das Budget deiner Mitspieler nicht an – das ist Teil des
Spiels. Ausrechnen lässt es sich trotzdem, solange **ohne Boni** gespielt wird:

```
Budget = Startkapital + Transfergewinn + stille Reserven − Teamwert
```

Startkapital ist der zugeteilte Startkader plus Startbudget (hier 100 + 50
Mio), die stillen Reserven sind die Summe aller Gewinne und Verluste seit Kauf
im aktuellen Kader. Die Herleitung steht ausgeschrieben in `src/lib/league.ts`.

Die Zutaten kommen aus zwei Endpunkten pro Manager:
`/managers/{userId}/dashboard` liefert Teamwert und Transfergewinn (`prft`),
`/managers/{userId}/squad` die `mvgl`-Werte für die stillen Reserven. Beides
läuft mit begrenzter Gleichzeitigkeit, damit eine große Liga nicht auf einen
Schlag vierzig Anfragen auslöst.

**Die Rechnung prüft sich selbst.** Es ist nicht dokumentiert, ob `prft` der
realisierte Transfergewinn ist oder die stillen Reserven schon enthält. Statt
zu raten, rechnet die App beide Lesarten für *dein* Konto durch und vergleicht
sie mit deinem echten Kontostand aus `/me/budget`. Die Lesart, die trifft, gilt
für alle. Über der Tabelle steht, ob die Probe aufgegangen ist – und wenn
nicht, um wie viel sie danebenlag. Weicht sie um mehr als ein Prozent des
Startkapitals ab, stimmen entweder die Startwerte nicht oder es werden doch
Boni ausgezahlt; dann sind die Zahlen als grobe Richtung gekennzeichnet.

Andere Ligaregeln stellst du über `KB_START_TEAM_VALUE` und `KB_START_BUDGET`
ein, siehe `.env.example`.

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

Die Zusatzendpunkte für Spielplan (`/v4/competitions/1/matchdays`),
Bundesliga-Tabelle (`/v4/competitions/1/table`) und die Manager-Daten
(`/v4/leagues/{id}/managers/{userId}/dashboard` und `.../squad`) sind nicht
offiziell dokumentiert.
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


## Schnappschuss-Speicher

Die App speichert täglich einen lokalen Zustand von Kader und Transfermarkt in
`data/kaderzentrale.db` (SQLite). Dadurch können Marktwert-Verläufe über mehrere
Tage bewertet werden, statt nur die aktuellen API-Deltas zu verwenden. Außerdem
fließen Punkte pro Million Marktwert als Gegenwert-Kennzahl in die Bewertung ein.

Beim Serverstart initialisiert `src/instrumentation.ts` die Datenbank. Mit
`KB_EMAIL` und `KB_PASSWORD` kann bei Bedarf automatisch ein Tages-Snapshot
erstellt werden. Alternativ ruft ein Cronjob `POST /api/snapshot` mit
`Authorization: Bearer $SNAPSHOT_SECRET` auf.

```cron
30 3 * * * cd /pfad/zu/kickbase-dashboard && npm run snapshot
```

Relevante Variablen stehen in `.env.example`: `SNAPSHOT_SECRET`, `KB_LEAGUE_ID`,
`KB_DB_PATH`, `KB_SNAPSHOT_ON_START` sowie optionale Bild-CDN-Einstellungen.

## Corporate Design

Die Oberfläche folgt den offiziellen Kickbase Brand Guidelines
(brand.kickbase.com). Vorher standen hier aus dem App-Auftritt abgeleitete
Schätzwerte, unter anderem ein signalgrüner Akzent, den es in der Marke gar
nicht gibt. Alle Werte liegen in `tailwind.config.ts` und
`src/app/globals.css`.

**Palette.** KB Black `#131417`, KB White `#DEE4EC` (kein reines Weiß), KB
Live Red `#FF4600`, dazu KB Dark Grey `#474B4E`, KB Grey `#7E8187` und KB
Light Grey `#A8ADB4`. Zwischenstufen für Karten und Rahmen sind keine
erfundenen Farben, sondern berechnete Mischungen von KB Dark Grey über KB
Black – die Schichtung, die die Guidelines ausdrücklich erlauben.

**Rot bedeutet nicht "negativ".** Es steht laut Guidelines für "moments of
importance, excitement, and emphasis". Und die Marke kennt kein Grün, mit dem
die App vorher Gewinne markiert hat. Deshalb:

- Richtung über Helligkeit plus Vorzeichen: Gewinn KB White, Verlust KB Light
  Grey, Stillstand KB Grey. Auch ohne Farbunterscheidung lesbar.
- KB Live Red nur für Handlung: Verkaufen, Kaufen, Ausfall, Konto im Minus,
  schwerer Gegner, fehlgeschlagene Budget-Probe, hängender Schnappschuss,
  Tastaturfokus. An einem normalen Spieltag sind das eine Handvoll Elemente.

**Gegnerstärke** lief auf einer Ampel aus Rot, Gelb und Grün. Ohne Grün und
Gelb trägt jetzt die Helligkeit die Bedeutung: weiß = machbar, grau =
Mittelfeld, rot umrandet = schwerer Gegner. Der Klartext steht ohnehin im
Tooltip, und im Chip steht "H" oder "A" – die Farbe ist nie der einzige
Träger der Information.

**Timestamps.** Das Plus/Minus-Motiv der Guidelines markiert im Original
Spielereignisse. Hier markiert es die Bewegung eines Marktwerts – derselbe
Gedanke. Gesetzt in Versalien, wie vorgegeben.

**Punktraster.** Die analytische Schicht des Systems liegt als CSS-Raster
unter allem. KB Dark Grey auf KB Black, eine der freigegebenen Kombinationen.
Die Rastergröße ist ein einziger Token (`spacing.dot`) und wird nirgends
skaliert, gedreht oder verzerrt – die Guidelines verlangen das ausdrücklich.
Rot ist als Rasterfarbe verboten und kommt nicht vor.

**Kontrast.** KB Dark Grey ist eine Strukturfarbe und wird nie für Text
benutzt: auf KB Black erreicht es nur 2,09:1. Als Text bleiben KB White
(14,4:1), KB Light Grey (8,2:1), KB Live Red (5,4:1) und KB Grey (4,7:1).

### Was bewusst fehlt: die Hausschriften

KB Pitch und KB Volksans sind **nicht** eingebunden. Die Community Policy im
Logo-Kit verbietet das:

> Use of the Kickbase font → the font is exclusive to our brand.

Übernommen sind deshalb nur die Satzregeln, gesetzt in der Systemschrift:
Headline-Zeilenabstand 0.9 und Versalien, Subheader 1.18, Fließtext 1.4 in
Satzschreibung, Labels und Timestamps in Versalien, tabellarische Ziffern für
alle Metriken.

### Logo

Vier SVGs aus dem offiziellen Community Logo Kit liegen unverändert in
`public/brand/`; Näheres in `public/brand/README.md`. Vorher zeichnete
`ui.tsx` ein eigenes Zeichen aus zwei grünen Balken – das echte Zeichen ist
ein Stern. `BrandLogo` bindet die Dateien als `<img>` ein statt als
Inline-SVG, damit keine CSS-Regel sie einfärben kann, und skaliert nur
proportional: es gibt gar keine Prop, mit der sich das Logo verzerren ließe.

## Technisches

- Next.js 14 (App Router), React 18, TypeScript, Tailwind
- Datenabruf in Server Components, kein clientseitiger API-Zugriff. Client ist
  nur, was interaktiv sein muss: Filter/Sortierung der Kaderansicht und die
  Bild-Platzhalter.
- Spielerfotos und Vereinswappen kommen direkt vom Kickbase-CDN. Bewusst als
  einfaches `<img>` statt `next/image`: die CDN-Pfade sind unvollständig
  dokumentiert, und ein 404 soll ein ruhiger Platzhalter sein statt eines
  Serverfehlers.
- Farben, Radien und Schriftgrößen stehen ausschließlich in
  `tailwind.config.ts` und `src/app/globals.css` – siehe den Abschnitt
  Corporate Design. Die Werte stammen aus den offiziellen Brand Guidelines.
- Systemschriften statt Google Fonts: kein externer Request, kein Fetch beim
  Build. Das ist hier kein Kompromiss, sondern Pflicht: die Hausschriften
  sind laut Community Policy der Marke vorbehalten.
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
Daten, die du in der App ohnehin siehst, und führt keine Transfers aus.
Spielerfotos und Vereinswappen werden vom Kickbase-CDN geladen und nicht neu
verteilt. Für den privaten Gebrauch gedacht, Nutzung auf eigenes Risiko.

Das Design folgt den Kickbase Brand Guidelines, das Logo stammt aus dem
offiziellen Community Logo Kit. Dessen Policy erlaubt private,
nicht-kommerzielle Nutzung – genau das ist dieses lokal laufende Dashboard.
Die Hausschriften sind ausgenommen und deshalb nicht eingebunden. Sollte das
Projekt je öffentlich gehostet oder kommerziell werden, müssen die Dateien in
`public/brand/` vorher raus.

Die Einschätzungen sind eine Heuristik aus Marktwert-Trend, Punkteschnitt,
Einsatzfähigkeit und Gegnerstärke – kein Ersatz für dein eigenes Urteil. Ein
fallender Marktwert kurz vor einem guten Spielplan kann trotzdem ein Halten
sein.
