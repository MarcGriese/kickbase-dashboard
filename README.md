# Kaderzentrale

Ein lokales Next.js-Dashboard f├╝r deine Kickbase-Liga. Zieht Kader,
Transfermarkt und Tabelle ├╝ber die (inoffizielle) Kickbase-API v4 und
├╝bersetzt sie in Tagesentscheidungen: halten, verkaufen, kaufen ÔÇô und bis zu
welchem Betrag.

## Starten

```bash
npm install
npm run dev
```

Dann <http://localhost:3000> ├Âffnen und mit deinen Kickbase-Zugangsdaten
anmelden.

F├╝r einen Produktions-Build lokal:

```bash
npm run build && npm start
```

## Tests

```bash
npm test
```

Getestet wird die Buchhaltung hinter den hergeleiteten Kontost├ñnden
(`src/lib/league.ts`) ÔÇô der einzige Teil der App, den man nicht gegen die API
pr├╝fen kann, weil fremde Budgets dort gar nicht auftauchen. L├ñuft ├╝ber den
Node-Testrunner ohne zus├ñtzliches Framework und braucht Node 22.6+.

## Anmeldung

Die App schickt E-Mail und Passwort einmalig an `api.kickbase.com` und legt den
zur├╝ckgegebenen Token in einem httpOnly-Cookie ab. Das Passwort wird nirgends
gespeichert, der Token nie an Browser-JavaScript ausgeliefert. Alle
API-Aufrufe laufen serverseitig ÔÇô dein Browser spricht ausschlie├ƒlich mit
deinem eigenen Next.js-Server.

**Wichtig:** Wenn du dich in der Kickbase-App mit Apple oder Facebook
anmeldest, funktioniert der API-Login nicht. Setz in der App zuerst unter
Einstellungen ÔåÆ Profil ein eigenes Passwort.

## Seiten

| Route        | Inhalt                                                          |
| ------------ | --------------------------------------------------------------- |
| `/dashboard` | Kaderansicht mit Filtern, Marktwerten, Prognose und Spielplan    |
| `/markt`     | Transfermarkt mit Kaufempfehlung und Maximalgebot                |
| `/liga`      | Tabelle nach Punkten, mit hergeleiteten Kontost├ñnden aller Manager |

## Das Dashboard

**Kennzahlen.** Teamwert, der maximale Kaderwert zu Spieltagsbeginn
(Teamwert + Budget) und das Budget selbst. Beim Budget steht dabei, wie weit
du ins Minus darfst: Kickbase erlaubt bis zu 33 % des Kaderwerts, wobei der
Kaderwert als Teamwert plus (negatives) Konto gerechnet wird. Die Formel steht
in `src/lib/budget.ts`. Zweite, davon unabh├ñngige Regel: zum Spieltagsbeginn
muss das Konto wieder im Plus sein, sonst gibt es keine Punkte.

**Kaderansicht.** Suche ├╝ber Name und Verein, Filter nach Position, Sortierung
nach Marktwert, 24 Stunden, 7 Tagen, Gewinn/Verlust seit Kauf, Prognose,
Schnitt, Punkten, Name oder Position. Pro Spieler: Foto, Vereinswappen,
Marktwert, 24-Stunden-Bewegung, 7-Tage-Bewegung, Gewinn/Verlust seit deinem
Kauf und die prognostizierte Entwicklung bis zum n├ñchsten Spieltagsbeginn.

**N├ñchste drei Spiele.** Aus dem Bundesliga-Spielplan, eingef├ñrbt nach
Gegnerst├ñrke: rot f├╝r Gegner aus den oberen Tabellenr├ñngen, gelb f├╝rs
Mittelfeld, gr├╝n f├╝r machbare Aufgaben. Heimspiele werden zwei Tabellenpl├ñtze
milder gerechnet, Ausw├ñrtsspiele zwei h├ñrter. Liefert die API keine Tabelle,
bleibt alles gelb ÔÇô geraten wird hier nichts.

## Die Liga-Tabelle

Sortiert nach Gesamtpunkten ÔÇô so wird die Liga entschieden. Jede Spalte l├ñsst
sich per Klick auf die ├£berschrift umsortieren, die Platzierung bleibt dabei
die aus den Punkten. Neben Gesamtpunkten stehen die Punkte des zuletzt
gewerteten Spieltags (`mdp` aus der Rangliste), Teamwert, Transfergewinn,
Budget und der maximale Kaderwert.

### Wie die fremden Kontost├ñnde zustande kommen

Kickbase zeigt dir das Budget deiner Mitspieler nicht an ÔÇô das ist Teil des
Spiels. Ausrechnen l├ñsst es sich trotzdem, solange **ohne Boni** gespielt wird:

```
Budget = Startkapital + Transfergewinn + stille Reserven ÔêÆ Teamwert
```

Startkapital ist der zugeteilte Startkader plus Startbudget (hier 100 + 50
Mio), die stillen Reserven sind die Summe aller Gewinne und Verluste seit Kauf
im aktuellen Kader. Die Herleitung steht ausgeschrieben in `src/lib/league.ts`.

Die Zutaten kommen aus zwei Endpunkten pro Manager:
`/managers/{userId}/dashboard` liefert Teamwert und Transfergewinn (`prft`),
`/managers/{userId}/squad` die `mvgl`-Werte f├╝r die stillen Reserven. Beides
l├ñuft mit begrenzter Gleichzeitigkeit, damit eine gro├ƒe Liga nicht auf einen
Schlag vierzig Anfragen ausl├Âst.

**Die Rechnung pr├╝ft sich selbst.** Es ist nicht dokumentiert, ob `prft` der
realisierte Transfergewinn ist oder die stillen Reserven schon enth├ñlt. Statt
zu raten, rechnet die App beide Lesarten f├╝r *dein* Konto durch und vergleicht
sie mit deinem echten Kontostand aus `/me/budget`. Die Lesart, die trifft, gilt
f├╝r alle. ├£ber der Tabelle steht, ob die Probe aufgegangen ist ÔÇô und wenn
nicht, um wie viel sie danebenlag. Weicht sie um mehr als ein Prozent des
Startkapitals ab, stimmen entweder die Startwerte nicht oder es werden doch
Boni ausgezahlt; dann sind die Zahlen als grobe Richtung gekennzeichnet.

Andere Ligaregeln stellst du ├╝ber `KB_START_TEAM_VALUE` und `KB_START_BUDGET`
ein, siehe `.env.example`.

## Wie die Prognose zustande kommt

Kickbase legt seine Marktwertformel nicht offen. Was die App macht, ist eine
Fortschreibung der beiden Bewegungen, die die API hergibt: 60 % der letzten
24 Stunden plus 40 % des Wochenschnitts, pro Tag um 15 % abklingend,
hochgerechnet auf die Tage bis zum n├ñchsten Anpfiff. Das ist eine Heuristik,
keine Vorhersage ÔÇô die Oberfl├ñche sagt das auch so. Die Parameter stehen oben
in `src/lib/forecast.ts`.

## Wie das Maximalgebot zustande kommt

Die Kickbase-API gibt die verdeckten Gebote und Kontost├ñnde deiner Mitspieler
**nicht** her. Kein Tool kann sie kennen ÔÇô auch dieses nicht.

Stattdessen liest die App den Aktivit├ñts-Feed deiner Liga aus, vergleicht bei
real abgeschlossenen Transfers den gezahlten Preis mit dem damaligen Marktwert
und bildet daraus den Median. Das ergibt den liga├╝blichen Aufschlag (ÔÇ×in dieser
Liga wird typischerweise 8 % ├╝ber Marktwert gezahlt"). Das Maximalgebot ist
Marktwert ├ù dieser Faktor, gedeckelt auf dein Budget.

Bei weniger als drei auswertbaren Transfers f├ñllt die App auf einen
konservativen Aufschlag von 5 % zur├╝ck und sagt das in der Oberfl├ñche auch.

## Wenn Kickbase die API ├ñndert

Kickbase nutzt sehr kurze Feldnamen (`mv`, `ap`, `sdmvt`, ÔÇª). Alle diese
K├╝rzel stehen an genau einer Stelle: `src/lib/fields.ts` im Objekt `FIELDS`.
├ändert sich die API, passt du nur dort an.

Eine Falle, die lange falsch stand: `sdmvt` ist die Marktwert├ñnderung der
letzten **sieben Tage** (seven day), `tfhmvt` die der letzten **24 Stunden**
(twenty four hour). Wer beides in denselben Topf wirft, zeigt eine
Wochenbewegung als Tageswert an. Die App f├╝hrt beide Werte getrennt.

Die Zusatzendpunkte f├╝r Spielplan (`/v4/competitions/1/matchdays`),
Bundesliga-Tabelle (`/v4/competitions/1/table`) und die Manager-Daten
(`/v4/leagues/{id}/managers/{userId}/dashboard` und `.../squad`) sind nicht
offiziell dokumentiert.
Antworten sie anders als erwartet, geben die Funktionen in
`src/lib/kickbase.ts` `null` zur├╝ck und die Oberfl├ñche zeigt den Abschnitt
einfach nicht ÔÇô eine fehlende Paarung darf nie das Dashboard zerlegen.

Um die echten Feldnamen zu sehen, hilft das Python-Tool aus dem gleichen
Projekt:

```bash
python3 kickbase_advisor.py --debug 2> raw.txt
```

Besonders `/market` und `/activitiesFeed` sind in der ├Âffentlichen Doku nur
teilweise mit Beispielantworten belegt ÔÇô dort sind die Zuordnungen in
`fields.ts` und `advisor.ts` defensiv geraten und einen Abgleich wert. Der
Kader-Endpunkt war vollst├ñndig dokumentiert und sitzt sicher.


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

## Technisches

- Next.js 14 (App Router), React 18, TypeScript, Tailwind
- Datenabruf in Server Components, kein clientseitiger API-Zugriff. Client ist
  nur, was interaktiv sein muss: Filter/Sortierung der Kaderansicht und die
  Bild-Platzhalter.
- Spielerfotos und Vereinswappen kommen direkt vom Kickbase-CDN. Bewusst als
  einfaches `<img>` statt `next/image`: die CDN-Pfade sind unvollst├ñndig
  dokumentiert, und ein 404 soll ein ruhiger Platzhalter sein statt eines
  Serverfehlers.
- Farben, Radien und Schriftgr├Â├ƒen des Corporate Designs stehen ausschlie├ƒlich
  in `tailwind.config.ts` und `src/app/globals.css`. Wer exakte Markenwerte
  aus den offiziellen Kickbase-Brand-Guidelines hat, ├ñndert nur diese beiden
  Dateien ÔÇô die Hexwerte hier sind aus dem App-Auftritt abgeleitet.
- Systemschriften statt Google Fonts: kein externer Request, kein Fetch beim
  Build. Willst du Inter, leg die woff2-Dateien in `/public` und binde sie
  ├╝ber `next/font/local` ein.
- Bewusst auf Next 14 gepinnt: ab Next 15 ist `cookies()` asynchron, was das
  Session-Handling in `src/lib/session.ts` brechen w├╝rde. Die Version ist
  14.2.35, also die gepatchte 14er-Linie.
- `npm audit` meldet zwei Meldungen zu einem in Next eingebetteten PostCSS.
  Das betrifft nur die Build-Zeit (Auslesen von `.map`-Dateien beim
  CSS-Verarbeiten) und nicht den laufenden Server. Bereinigen lie├ƒe es sich
  nur mit dem Sprung auf Next 16.

## Rechtliches

Die verwendete API ist inoffiziell und nicht dokumentiert; Kickbase kann sie
jederzeit ├ñndern oder den Zugriff unterbinden. Die App liest ausschlie├ƒlich
Daten, die du in der App ohnehin siehst, und f├╝hrt keine Transfers aus. Das
Design ist an das Kickbase-Erscheinungsbild angelehnt; Spielerfotos und
Vereinswappen werden vom Kickbase-CDN geladen und nicht neu verteilt. F├╝r den
privaten Gebrauch gedacht, Nutzung auf eigenes Risiko.

Die Einsch├ñtzungen sind eine Heuristik aus Marktwert-Trend, Punkteschnitt,
Einsatzf├ñhigkeit und Gegnerst├ñrke ÔÇô kein Ersatz f├╝r dein eigenes Urteil. Ein
fallender Marktwert kurz vor einem guten Spielplan kann trotzdem ein Halten
sein.
