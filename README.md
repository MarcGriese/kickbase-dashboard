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

| Route            | Inhalt                                                              |
| ---------------- | ------------------------------------------------------------------- |
| `/dashboard`     | Kader mit Halten/Verkaufen-Einschätzung, Teamwert, Verlauf, P/Mio    |
| `/markt`         | Transfermarkt mit Kaufempfehlung und Maximalgebot                    |
| `/liga`          | Tabelle mit Rückstand auf Platz 1                                    |
| `/api/snapshot`  | GET: Zustand des Speichers. POST: Schnappschuss anlegen              |

## Der Schnappschuss-Speicher

Kickbase liefert immer nur das Jetzt. `sdmvt` ist die Marktwertänderung seit
gestern – mehr Gedächtnis hat die API nicht. Damit siehst du keinen
dreitägigen Rutsch, keine Erholung und nicht, welcher Spieler still vor sich
hin wächst.

Deshalb legt die App eine lokale SQLite-Datei an (`data/kaderzentrale.db`,
über `KB_DB_PATH` verschiebbar) und schreibt dort **eine Zeile pro Liga und
Kalendertag**: Kader und Transfermarkt mit Marktwert, Punkten, Schnitt und
Status, dazu Teamwert und Budget. Läuft der Job zweimal am selben Tag,
ersetzt der zweite Lauf den ersten.

Bei jedem Seitenaufruf hält die App die eben geholten Werte gegen den
gespeicherten Stand – gegen gestern, gegen vor einer Woche und gegen vor
einem Monat. Das kostet drei Abfragen, egal wie groß der Kader ist. Solange
nichts gespeichert ist, steht in der Verlaufsspalte ein Strich und die App
sagt das oben auch: sie tut nicht so, als wüsste sie etwas, das sie noch
nicht weiß.

Der Verlauf fließt in die Bewertung ein. Der Tagesschritt allein ist
verrauscht; eine Woche in dieselbe Richtung ist ein Signal. Wendepunkte
("dreht heute nach oben", "knickt heute ein") tauchen als Begründung auf.

### Wann geschrieben wird

**Beim Serverstart** (`src/instrumentation.ts`): öffnet und migriert die
Datei und meldet im Log, wie alt der gespeicherte Stand ist. Fehlt der
heutige Schnappschuss und liegen `KB_EMAIL`/`KB_PASSWORD` vor, holt er ihn
gleich. Ohne diese Zugangsdaten kann er nichts abrufen – beim Start gibt es
keine Browser-Sitzung und damit keinen Token. Abschaltbar mit
`KB_SNAPSHOT_ON_START=0`.

**Nächtlich per Cron**: `POST /api/snapshot` mit
`Authorization: Bearer $SNAPSHOT_SECRET`. Der Job meldet sich selbst mit den
hinterlegten Zugangsdaten an.

```cron
# Kurz nach der nächtlichen Marktwert-Aktualisierung von Kickbase.
30 3 * * *  cd /pfad/zu/kickbase-dashboard && npm run snapshot
```

`npm run snapshot` spricht den laufenden Server an (`KB_URL` setzen, wenn er
nicht auf Port 3000 hört). Der Server muss also laufen – auf einem Rechner,
der nachts an ist, oder als Dienst.

**Von Hand**: angemeldet im Browser genügt ein `POST /api/snapshot` ohne
Geheimnis. `?force=1` überschreibt einen Stand, der heute schon geschrieben
wurde.

## Punkte pro Million

Der Punkteschnitt allein führt in die Irre: die eigentliche Währung ist der
Ertrag je gebundenem Euro. Ein Abwehrspieler mit mäßigem Schnitt zum halben
Preis schlägt den teuren Stürmer, weil das freie Budget den nächsten Steiger
kauft.

Bewertet wird immer **gegen den Median der Gruppe**, nie gegen eine feste
Zahl – was ein guter Gegenwert ist, hängt am Preisniveau der Saison. Im
Kader ist die Gruppe dein eigener Kader, auf dem Transfermarkt das aktuelle
Angebot. Dort zählt der Ertrag außerdem auf den **Preis**, nicht auf den
Marktwert: ein Aufschlag frisst die Rendite, ein Schnäppchen verbessert sie.

Spieler ohne einen einzigen Einsatz ziehen den Median nicht nach unten und
werden auch nicht dafür abgestraft – sie bekommen den Hinweis "noch keine
Punkte".

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
## Spielerfotos und Wappen

Vorher wurde gar kein Bild gerendert: `pick(raw, "image")` wurde ausgelesen
und bis in `RatedPlayer.image` durchgereicht, aber keine einzige Komponente
hat je ein `<img>` erzeugt. `teamId` wurde nicht einmal gelesen.

Jetzt gilt: was die API liefert, gewinnt. Das Foto kommt aus `pim`, das
Wappen aus `tim`, sofern vorhanden. Nur wenn Kickbase nichts mitschickt,
wird das Wappen aus der Team-ID gebaut (`KB_TEAM_LOGO_TEMPLATE`). Relative
Pfade bekommen das CDN davor, vollständige URLs bleiben unangetastet.

Bewusst ein einfaches `<img>` statt `next/image`: Kickbase liefert über
wechselnde CDN-Hosts aus, und `next/image` verweigert jeden Host, der nicht
in `next.config.mjs` steht – sichtbar als leere Fläche, ohne Fehlermeldung.
Lädt ein Bild trotzdem nicht, fängt `PlayerAvatar` das ab und zeigt die
Initialen auf einer aus dem Namen abgeleiteten Farbe. Die Zeile bleibt
lesbar, auch wenn das CDN schweigt.

## Corporate Design

Die Oberfläche folgt den offiziellen Kickbase Brand Guidelines
(brand.kickbase.com), nicht mehr einer Annäherung ans App-Aussehen. Alle
Werte liegen in `tailwind.config.ts`.

**Palette.** KB Black `#131417`, KB White `#DEE4EC` (kein reines Weiß), KB
Live Red `#FF4600`, dazu KB Dark Grey `#474B4E`, KB Grey `#7E8187` und KB
Light Grey `#A8ADB4`. Zwischenstufen für Karten und Rahmen sind keine
erfundenen Farben, sondern Mischungen von KB Dark Grey über KB Black – die
Schichtung, die die Guidelines ausdrücklich erlauben.

**Rot bedeutet nicht "negativ".** Es steht laut Guidelines für "moments of
importance, excitement, and emphasis". Und die Marke kennt kein Grün, mit dem
die App vorher Gewinne markiert hat. Deshalb die Aufteilung:

- Richtung über Helligkeit plus Vorzeichen: Gewinn KB White, Verlust KB Light
  Grey, Stillstand KB Grey. Auch ohne Farbunterscheidung lesbar.
- KB Live Red nur für Handlung: Verkaufen, Kaufen, Ausfall, hängender
  Schnappschuss, Tastaturfokus. An einem normalen Spieltag sind das eine
  Handvoll Elemente.

**Timestamps.** Das Plus/Minus-Motiv der Guidelines markiert im Original
Spielereignisse. Hier markiert es die Bewegung eines Marktwerts – derselbe
Gedanke. Gesetzt in Versalien, wie vorgegeben.

**Punktraster.** Die analytische Schicht des Systems liegt als CSS-Raster
unter allem. KB Dark Grey auf KB Black, eine der freigegebenen Kombinationen.
Die Rastergröße ist ein einziger Token (`spacing.dot`) und wird nirgends
skaliert, gedreht oder verzerrt – die Guidelines verlangen das ausdrücklich.
Rot ist als Rasterfarbe verboten und kommt hier nicht vor.

**Kontrast.** KB Dark Grey ist eine Strukturfarbe und wird nie für Text
benutzt: auf KB Black erreicht es nur 2,09:1. Als Text bleiben KB White
(14,4:1), KB Light Grey (8,2:1), KB Live Red (5,4:1) und KB Grey (4,7:1) –
alle über der Schwelle.

### Was bewusst fehlt: die Hausschriften

KB Pitch und KB Volksans sind **nicht** eingebunden. Die Community Policy im
Logo-Kit verbietet das:

> Use of the Kickbase font → the font is exclusive to our brand.

Übernommen sind deshalb nur die Satzregeln, gesetzt in der Systemschrift:
Headline-Zeilenabstand 0.9 und Versalien, Subheader 1.18, Fließtext 1.4 in
Satzschreibung, Labels und Timestamps in Versalien, tabellarische Ziffern für
alle Metriken. Das hält nebenbei die Zusage ein, dass die App keine externe
Anfrage stellt.

### Logo

Vier SVGs aus dem offiziellen Community Logo Kit liegen unverändert in
`public/brand/`. Näheres in `public/brand/README.md`, inklusive dessen, was
die Policy erlaubt und verbietet. Kurz: privat und nicht-kommerziell ja,
Umfärben oder Verzerren nein. `BrandLogo` bindet die Dateien deshalb als
`<img>` ein und skaliert nur proportional – es gibt gar keine Prop, mit der
sich das Logo verzerren ließe.

## Technisches

- Next.js 14 (App Router), React 18, TypeScript, Tailwind
- Datenabruf in Server Components, kein clientseitiger API-Zugriff
- better-sqlite3 statt `node:sqlite`: letzteres braucht in Node 22 noch
  `--experimental-sqlite`, was `next dev` unbrauchbar macht.
- `instrumentation.ts` wird von Next für beide Laufzeiten übersetzt, läuft
  aber nur unter Node. webpack folgt dem dynamischen Import trotzdem und
  zieht SQLite ins Edge-Bundle, wo `fs` fehlt. Deshalb biegt
  `next.config.mjs` `better-sqlite3`, `fs` und `path` dort auf ein leeres
  Modul um, und `db.ts` importiert ohne `node:`-Präfix – das Schema lehnt
  webpack ab, bevor es zur Alias-Auflösung kommt.
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
Nutzung auf eigenes Risiko.

Das Design folgt den Kickbase Brand Guidelines, das Logo stammt aus dem
offiziellen Community Logo Kit. Dessen Policy erlaubt private, nicht-
kommerzielle Nutzung – genau das ist dieses lokal laufende Dashboard. Die
Hausschriften sind ausgenommen und deshalb nicht eingebunden. Sollte das
Projekt je öffentlich gehostet oder kommerziell werden, müssen die Dateien
in `public/brand/` vorher raus.

Die Einschätzungen sind eine Heuristik aus Marktwert-Verlauf, Punkten je
Million und Einsatzfähigkeit – kein Ersatz für dein eigenes Urteil. Ein
fallender Marktwert kurz vor einem guten Spielplan kann trotzdem ein Halten
sein. Die App kennt den Spielplan nicht.

Der Schnappschuss-Speicher liegt unverschlüsselt auf deiner Platte und
enthält nur Daten, die du in der Kickbase-App ohnehin siehst. Er ist von
`.gitignore` ausgenommen – lösch die Datei, wenn du bei null anfangen
willst, das Schema legt sich beim nächsten Start neu an.
