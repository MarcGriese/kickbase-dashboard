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

Um die echten Feldnamen zu sehen, hilft das Python-Tool aus dem gleichen
Projekt:

```bash
python3 kickbase_advisor.py --debug 2> raw.txt
```

Besonders `/market` und `/activitiesFeed` sind in der öffentlichen Doku nur
teilweise mit Beispielantworten belegt – dort sind die Zuordnungen in
`fields.ts` und `advisor.ts` defensiv geraten und einen Abgleich wert. Der
Kader-Endpunkt war vollständig dokumentiert und sitzt sicher.

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

Die Einschätzungen sind eine Heuristik aus Marktwert-Verlauf, Punkten je
Million und Einsatzfähigkeit – kein Ersatz für dein eigenes Urteil. Ein
fallender Marktwert kurz vor einem guten Spielplan kann trotzdem ein Halten
sein. Die App kennt den Spielplan nicht.

Der Schnappschuss-Speicher liegt unverschlüsselt auf deiner Platte und
enthält nur Daten, die du in der Kickbase-App ohnehin siehst. Er ist von
`.gitignore` ausgenommen – lösch die Datei, wenn du bei null anfangen
willst, das Schema legt sich beim nächsten Start neu an.
