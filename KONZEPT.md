# Gebetsraum — Konzept

Eine persönliche Gebets-App als Progressive Web App: eine kuratierte, von dir gepflegte
Bibliothek an Gebeten, dazu für jede Person eine private, synchronisierte eigene Sammlung —
schön gestaltet, sofort auffindbar, auch ganz ohne Netz.

**Stand:** 2026-08-24 — Phasen 1–3 aus der ursprünglichen Roadmap sind umgesetzt und live.
Google-Anmeldung als zuverlässiger Mehrgeräte-Weg ist ergänzt, die zugehörigen Sync-Bugs sind
behoben; die zugrunde liegende iOS-Sitzungspersistenz-Ursache bleibt als bekannte Einschränkung
bestehen (Google-Konto umgeht sie, siehe „Offene Punkte").

---

## Rahmenbedingungen

| | |
|---|---|
| **Zielgruppe** | Du, plus Familie und Freunde — jede Person mit einer eigenen, privaten Sammlung. |
| **Plattform** | Progressive Web App: eine Codebasis, installierbar auf Smartphone, Tablet und Desktop. |
| **Verfügbarkeit** | Lokal gespeichert und sofort nutzbar (Service Worker + IndexedDB), im Hintergrund über die eigenen Geräte synchronisiert. |
| **Basis-Inhalte** | Von dir als Markdown-Dateien gepflegt, versioniert im Repo, mit der App ausgeliefert. |
| **Zugang** | Einladungslink (die App-URL) — anonyme Anmeldung ohne Passwort, jede Person bekommt automatisch ihren eigenen privaten Bereich. |
| **Sprache** | Deutsch. Das Datenmodell hält ein Sprachfeld für später bereit. |
| **Hosting** | Netlify (kostenloses Kontingent), Deploy automatisch bei jedem Push auf GitHub. |

---

## Architektur

Drei Schichten sorgen dafür, dass Navigation offline sofort reagiert, du zentral Inhalte
pflegen kannst und trotzdem jede Person eigene Gebete ergänzen und sogar mitgelieferte
Gebete für sich selbst anpassen kann.

**Schicht 1 — Kuratierte Bibliothek.** Jedes Gebet ist eine Markdown-Datei unter
`src/lib/content/prayers/*.md` mit Titel, Kategorie/Unterkategorie, Tags und optionalem Bild
im Frontmatter. Ein Build-Schritt (`prayers.server.ts`) bündelt alle Dateien zu einem
Content-Paket, das mit der App ausgeliefert wird. Bildrollen (Banner breit/hoch, Bild) werden
automatisch aus den tatsächlichen Bildmaßen erkannt.

**Schicht 2 — Persönliche Ebene (Supabase).** Eigene Gebete, eigene Kategorie-Anpassungen,
Favoriten und hochgeladene Bilder liegen in Supabase (Postgres, Auth, Storage), an die
anonyme Konto-ID gebunden. Row Level Security sorgt dafür, dass niemand die Daten einer
anderen Person lesen oder ändern kann — auch wenn alle denselben Einladungslink benutzt
haben. Zugang auf einem zweiten Gerät läuft über einen Wiederherstellungs-Code (der
Supabase-Refresh-Token, unter „Konto" einsehbar) — bewusst kein selbst gebautes
Token-System, sondern nur offizielle Supabase-Client-Methoden.

**Schicht 3 — Auf dem Gerät.** Bibliothek und persönliche Ebene landen vollständig im
Gerätespeicher (Dexie/IndexedDB). Kategorien, Tags und Volltextsuche (MiniSearch) arbeiten
rein lokal. Ein Service Worker (vite-plugin-pwa) cached die App selbst für Offline-Start.
Push/Pull-Sync läuft im Hintergrund, sobald Netz da ist — „neuester Zeitstempel gewinnt"
beim Zusammenführen, da nur eine Person je ihre eigenen Zeilen schreibt.

### Alles ist bearbeitbar — über persönliche Fassungen (Fork-Modell)

Sowohl **Gebete** als auch **Kategorien** lassen sich vollständig in der App bearbeiten —
auch mitgelieferte. Bearbeitest du ein kuratiertes Gebet, entsteht eine private Fassung
(Fork), die das Original nur für dich ersetzt; andere sehen weiterhin die kuratierte
Version. URL, Favoriten-Status und Position in Listen bleiben dabei stabil. „Eigene Fassung
verwerfen" löscht nur die eigene Kopie und stellt reaktiv das Original wieder her.

Kategorien sind kein eigenes Objekt im Datenmodell, sondern ergeben sich aus dem
`kategorie`-Feld der Gebete. Eine Umbenennung rührt darum nicht an den Gebeten selbst,
sondern legt eine persönliche Anpassung (`category_overrides`: Name + Farbschema) ab, die
überall dort greift, wo die Kategorie angezeigt wird (Startseite, Kategorieseite,
Gebet-Detail, Tag- und Favoriten-Ansicht).

---

## Datenmodell

**Ein kuratiertes Gebet** (Markdown-Frontmatter):

```yaml
---
titel: "Abendgebet"
kategorie: "Tageszeiten"
unterkategorie: "Abend"
tags: ["Trost", "Familie", "kurz"]
bild: "abendgebet.jpg"
bild_position: "auto"
sprache: "de"
quelle: "Taizé"
---
```

**Ein eigenes Gebet / eine eigene Fassung** (Supabase-Tabelle `prayers`, Auszug):

`id`, `user_id`, `titel`, `kategorie`, `unterkategorie`, `tags`, `body_text`,
`bild_url`, `bild_rolle`, `bild_breite`, `bild_hoehe`, `bild_position`,
`overrides_slug` (gesetzt, wenn dies die eigene Fassung eines mitgelieferten Gebets ist),
`updated_at`, `deleted_at` (Soft-Delete-Tombstone für den Sync).

**Kategorie-Anpassung** (Supabase-Tabelle `category_overrides`):

`user_id`, `slug`, `display_name`, `schema`, `updated_at`, `deleted_at`.

**Favoriten** (Supabase-Tabelle `favorites`): `user_id`, `item_id` (Slug oder eigene ID),
`updated_at`, `deleted_at`.

Alle drei Tabellen sind über Row Level Security auf `auth.uid() = user_id` beschränkt.

---

## Design

**Farbschemas** — zehn Schemas, je mit vier Rollen (Akzent, Akzent-mild, Wash, Linie) und
eigenem Hell-/Dunkel-Wert (`src/lib/content/schemes.ts`). Sechs sind den mitgelieferten
Kategorien fest zugewiesen, vier weitere stehen zusätzlich zur freien Wahl:

| Schema | Verwendung |
|---|---|
| Standard (Amber) | Tageszeiten, Rückfall für unbekannte Kategorien |
| Marien (Blau) | Mariengebete |
| Heilig-Geist (Gold-Gelb) | Heilig-Geist-Gebete |
| Herz-Jesu (Weinrot) | Herz-Jesu- & Passionsgebete |
| Fasten (Violett) | Fasten- & Bußgebete |
| Advent (Tannengrün) | Advent & Weihnachten |
| Silber | zur freien Wahl |
| Rosa | zur freien Wahl |
| Dunkelrot | zur freien Wahl |
| Dunkel-Blau | zur freien Wahl |

Jede Person kann Name und Farbschema einer Kategorie für sich selbst anpassen
(„✏️ Bearbeiten" auf der Kategorieseite) — die vier zusätzlichen Schemas stehen dort für
jede Kategorie als weitere Auswahl zur Verfügung.

**Typografie:** „Fraunces" für Titel, „Public Sans" für Fließtext, „IBM Plex Mono" für
Labels/Metadaten. Hell-/Dunkelmodus folgen automatisch der Systemeinstellung, manuell
umschaltbar.

**Responsives Bild-Layout:** Die Rolle eines Bildes (Banner breit, Banner hoch, Bild) wird
automatisch aus dem Seitenverhältnis erkannt. Die Positionierung reagiert über CSS Container
Queries auf die verfügbare Spaltenbreite am Ort im Layout — nicht auf die Geräteklasse:

| Rolle | Schmal | Breit | Schwelle |
|---|---|---|---|
| Banner breit | Kopfzeile über Titel | identisch, nur höher | — (immer gleich) |
| Banner hoch | Kopfzeile, beschnitten | schmale Spalte neben Text | ~800px |
| Bild | über Titel, volle Breite | Spalte neben Text | ~900px |

Bei „Bild" lässt sich die Position zusätzlich manuell auf „immer neben/über/unter dem Text"
festlegen.

**Bild-Quellen beim eigenen Gebet:** Neben eigenem Upload (Supabase Storage) und der
Wiederverwendung eines bereits hochgeladenen eigenen Bildes (wird beim Übernehmen auf den
eigenen Pfad kopiert, siehe [`imageUpload.ts`](src/lib/imageUpload.ts) — kein Verlinken auf
denselben Storage-Pfad, damit das Ersetzen eines Bildes nicht heimlich auch andere Gebete
verändert) steht als dritte, rein statische Quelle ein **Farbschema-Banner** zur Wahl: zu
jedem der zehn Farbschemas liegt ein Paar Mosaik-Banner (Rolle „Banner breit"/„Banner hoch")
unter [`static/schemes/`](static/schemes) bereit — mit der App ausgeliefert, ohne
Supabase-Abhängigkeit, sofort offline verfügbar. Die Zuordnung Schema → Datei-Paar steht in
[`schemeBanners.ts`](src/lib/content/schemeBanners.ts).

---

## Funktionen (Stand jetzt)

- Kategorien, Tags, Volltextsuche (offline) — alles ohne Nachladen
- Favoriten
- Eigene Gebete hinzufügen, bearbeiten, löschen — inklusive Bild-Upload/Ersetzen/Entfernen,
  Wiederverwendung eigener Bilder oder Auswahl eines mitgelieferten Farbschema-Banners
- **Jedes** Gebet bearbeitbar (kuratiert → persönliche Fassung; eigenes → direkt)
- Kategorien bearbeitbar (Name, Farbschema) — persönlich, wirkt nicht auf andere
- Teilen (native Teilen-Funktion / Link kopieren), Drucken/PDF über den Browser-Druckdialog
- Konto: Wiederherstellungs-Code fürs eigene Zweitgerät, Einladungslink zum Teilen mit
  Familie/Freunden — bewusst getrennt dargestellt, da beides unterschiedliche Bedeutung hat
- Konto-Kennung (stabile Kurzform der `user_id`, ändert sich anders als der rotierende
  Wiederherstellungs-Code nicht) zum Abgleichen, ob zwei Geräte wirklich dasselbe Konto nutzen
- Warnhinweis unter „Konto", wenn lokale Änderungen noch nicht zu Supabase hochgeladen wurden
- Erstbesuch-Einführung, „Zum Home-Bildschirm hinzufügen"-Hinweis (iOS-Anleitung /
  natives Install-Prompt auf Android)
- Vollständig offline nutzbar nach dem ersten Laden

---

## Technologie-Stack

| Bereich | Technologie |
|---|---|
| Frontend / PWA | SvelteKit 2, Svelte 5 (Runes), TypeScript, Vite 8 |
| PWA / Offline | vite-plugin-pwa (Service Worker manuell über `virtual:pwa-register` registriert, da SvelteKit keine feste `index.html` hat) |
| Lokaler Speicher | Dexie.js (IndexedDB) |
| Suche | MiniSearch, clientseitig |
| Konten & Daten | Supabase (Postgres, anonyme Auth, Storage), Row Level Security |
| Markdown-Rendering | marked |
| Icons | mit `sharp` aus dem SVG-Icon generiert (`scripts/generate-icons.mjs`) |
| Hosting | Netlify (`@sveltejs/adapter-netlify`), Deploy bei jedem Push auf GitHub |
| Schriften | Google Fonts (Fraunces, Public Sans, IBM Plex Mono) |

Datenbank-Migrationen liegen unter [`supabase/migrations`](supabase/migrations).

---

## Bekannte Einschränkung

Als installierte Web-App zählt der lokale Speicher auf iOS als Website-Daten, nicht als
App-Container — er wird **nicht** automatisch über iCloud gesichert oder auf ein neues
iPhone übertragen. Er ist bewusst nur ein Cache; die verbindliche Kopie eigener Gebete liegt
in Supabase. Ohne verbundenes Konto (z. B. direkt nach dem ersten Start) gibt es
entsprechend noch keine Sicherung — der Wiederherstellungs-Code unter „Konto" ist die
Absicherung dagegen.

---

## Offene Punkte (in Arbeit, Stand 2026-08-24)

Beim Mehrgeräte-Einsatz (PC + iPhone) sind mehrere zusammenhängende Schwachstellen der
anonymen Auth aufgefallen. Ein Teil ist bereits behoben, zwei größere Punkte stehen noch aus:

**Bereits behoben** — siehe Commits `dd26ad7` (Wiederherstellungs-Logik: Pull-Cursor wurde
beim Verbinden nicht zuverlässig zurückgesetzt, ältere Zeilen des verbundenen Kontos blieben
für immer unsichtbar) und `6dd4f51` (Warnhinweis für nicht hochgeladene lokale Änderungen).

**Ursache, noch offen — Sitzungspersistenz auf iOS unzuverlässig.** Mehrfach beobachtet: Ein
Gerät, das schon korrekt mit dem Hauptkonto verbunden war, fiel irgendwann unbemerkt auf ein
neues, leeres anonymes Konto zurück (`auth.users` zeigte danach zwei getrennte Zeilen statt
einer). Kein Fehler beim Verbinden selbst, sondern die Sitzung hält auf Dauer nicht — vermutlich
iOS, das Website-Daten unter Speicherdruck oder nach längerer Nichtnutzung verwirft. Das ist der
eigentliche Kern des Mehrgeräte-Problems, nicht die Pull-Logik. **Möglicher Mitverursacher
gefunden und behoben, siehe direkt unten** — falls sich das Problem nach dessen Deploy nicht
mehr zeigt, war es das.

**Kaputter Service-Worker-Navigationsfallback — behoben (2026-08-24).** Beim Debuggen des
iPhone-Problems fiel in der PC-Konsole `Uncaught (in promise) non-precached-url … index.html`
auf. Ursache: `vite-plugin-pwa` registriert standardmäßig einen Navigations-Fallback auf
`index.html`, was eine klassische Single-Page-App mit genau einer statischen `index.html`
voraussetzt — dieses Projekt nutzt aber `adapter-netlify` und rendert jede Seite serverseitig,
es gibt gar keine `index.html` im Build. Jede Navigation, die der Service Worker abfängt, lief
dadurch ins Leere. Auf dem PC selten bemerkt (SvelteKit navigiert im Browser meist per
Soft-Navigation, ohne den Service Worker zu durchlaufen), auf dem iPhone als installierte PWA
aber potenziell bei **jedem** App-Start relevant, da das eine echte Navigation ist — ein starker
Kandidat dafür, wieso die App dort wiederholt auf einen alten/kaputten Stand zurückfiel, evtl.
auch für einen Teil der oben beschriebenen Sitzungsverlust-Symptome. Fix in `vite.config.ts`:
`workbox.navigateFallback` explizit deaktiviert, Navigationen gehen jetzt reell ins Netz statt
gegen eine nicht existierende, precachte Datei zu laufen. Nach dem Deploy braucht das iPhone
vermutlich ein bis zwei vollständige Neustarts der App (nicht nur in den Hintergrund legen,
sondern aus der App-Übersicht schließen), bis der neue Service Worker aktiv übernimmt.

**Optionale Google-Anmeldung — umgesetzt und live bestätigt (2026-08-24).**
Statt die Sitzungspersistenz selbst robuster zu machen, gibt es jetzt eine zuverlässigere
Alternative zum rein anonymen Zugang: Supabase-OAuth mit Google, über
`supabase.auth.linkIdentity()` an das **bestehende** anonyme Konto verknüpft (gleiche
`user_id`, keine Datenmigration nötig, `src/lib/auth.svelte.ts`). Anonymer Zugang bleibt
Standard beim ersten Öffnen des Einladungslinks (kein Bruch mit „sofort loslegen, kein
Passwort"). Unter „Konto" gibt es einen „Mit Google verknüpfen"-Schritt — danach meldet man
sich auf jedem weiteren Gerät per „Mit Google anmelden" (`supabase.auth.signInWithOAuth()`) an,
ohne rotierenden Code; das Aufräumen lokaler Reste beim Kontowechsel übernimmt
`AuthState.handleAuthChange()` automatisch, analog zu `restoreOnThisDevice()`. Bestehende
Funktionen bleiben für nicht verknüpfte Konten unverändert bestehen (Code ist dort weiterhin
die einzige Absicherung); bei verknüpften Konten wird die Code-Anzeige durch einen Hinweis
„Über Google gesichert" ersetzt und „Anderes Gerät verbinden" ausgeblendet, da nicht mehr
nötig. Keine RLS-Änderung nötig.

Einmalige, manuelle Einrichtung in Supabase/Google Cloud (nicht durch Claude erledigbar) —
durchgeführt und bestätigt: Verknüpfen und Anmelden funktionieren auf PC und iPhone mit
übereinstimmender Konto-Kennung.
1. In der [Google Cloud Console](https://console.cloud.google.com/apis/credentials) ein
   OAuth-2.0-Client-ID vom Typ „Webanwendung" anlegen. Autorisierte Redirect-URI:
   `https://niqtvoihoiicalmyxcwu.supabase.co/auth/v1/callback`.
2. Im [Supabase-Dashboard](https://supabase.com/dashboard/project/niqtvoihoiicalmyxcwu/auth/providers)
   unter Authentication → Providers → Google die Client-ID und das Client-Secret aus Schritt 1
   eintragen und den Provider aktivieren.
3. Ebenfalls im Supabase-Dashboard unter Authentication → Settings (User Signups) die Option
   „Allow manual linking" aktivieren — ohne sie liefert `linkIdentity()` sonst zur Laufzeit
   den Fehler „Manual linking is disabled" (per Browser-Test am 2026-08-24 bestätigt; das
   Verknüpfen ist ohne diese Option grundsätzlich deaktiviert, nicht nur unkonfiguriert).
4. Im Supabase-Dashboard unter Authentication → URL Configuration die Site-URL
   (`https://ipray365.netlify.app`) und bei Redirect URLs zusätzlich
   `https://ipray365.netlify.app/konto` (und für lokale Entwicklung `http://localhost:5173/konto`)
   eintragen — sonst leitet Google zwar erfolgreich zu Supabase zurück, Supabase aber nicht
   weiter zur App.

**`prayers`-Tabelle nicht pro Konto geschützt — behoben (2026-08-24).** Anders als
`favorites`/`category_overrides` (Primärschlüssel `(user_id, slug/item_id)`) hatte `prayers`
nur `id` als Primärschlüssel. Überlebt eine lokale Zeile (z. B. durch die
Sitzungspersistenz-Instabilität eines anderen, per Wiederherstellungs-Code verbundenen Geräts)
einen Kontowechsel, kollidierte ein späteres Hochladen mit der bereits unter dem falschen Konto
bestehenden Zeile — RLS blockierte das zu Recht, aber dauerhaft (`403`, „row-level security
policy (USING expression)"), nicht nur vorübergehend. Am PC nach dem Google-Verknüpfen
tatsächlich aufgetreten (und dadurch indirekt auch Ursache dafür, dass das iPhone noch einen
alten Kategorien-Stand zeigte — Kategorien stecken im `kategorie`-Feld der Gebete, die nie
erfolgreich hochgeladen wurden). Fix in `supabase/migrations/0006_prayers_composite_pk.sql`:
Primärschlüssel auf `(user_id, id)` umgestellt, damit dieselbe `id` unter verschiedenen Konten
nie kollidieren kann — eingespielt und bestätigt: kein `403` mehr beim Push.

**Nachfolgebug — "verspätete" Zeile bleibt trotz erfolgreichem Push für andere Geräte
unsichtbar (behoben, 2026-08-24).** Nach dem PK-Fix ging der Push auf dem PC zwar durch, das
iPhone zeigte aber weiterhin den alten Stand. Ursache: `updated_at` einer Zeile ist zugleich der
Inkrementell-Pull-Cursor (`gt('updated_at', since)` in `pullPrayers()`/`src/lib/sync.ts`). Die
zuvor blockierte Zeile trug noch ihren ursprünglichen (alten) Bearbeitungs-Zeitstempel; das
iPhone hatte in der Zwischenzeit aber durch andere, neuere Änderungen längst einen weiter
fortgeschrittenen Cursor — die jetzt "verspätet" ankommende alte Zeile fiel für den
inkrementellen Pull dauerhaft durchs Raster, genau wie beim bereits behobenen
Wiederherstellungs-Code-Bug (Commit `dd26ad7`), nur diesmal ohne Kontowechsel als Auslöser.
Fix: `forceFullResync()` in `src/lib/sync.ts` plus ein immer sichtbarer „Alle Daten neu
abgleichen"-Button unter „Konto" → „Abgleich mit anderen Geräten"
(`src/routes/konto/+page.svelte`) als generelles Troubleshooting-Werkzeug für diese
Bug-Klasse. Ursprünglich setzte die Funktion nur `syncMeta` zurück — nach der
Konten-Zusammenführung unten (SQL-`DELETE`s ohne Tombstone) reichte das nicht mehr, weil
lokal per Pull nie gelöscht wird, nur hinzugefügt/aktualisiert wird. Seit 2026-08-25 lädt
`forceFullResync()` darum zuerst alle noch nicht hochgeladenen lokalen Änderungen hoch und
leert danach die komplette lokale Tabelle (`prayers`/`favorites`/`categoryOverrides`), bevor
neu vom Server gezogen wird — behebt beide Varianten von hängen gebliebenem Zustand
(verspätete Zeile *und* lokale Karteileichen, die serverseitig gar nicht mehr existieren).

**Kaputter PWA-Navigationsfallback — behoben (2026-08-25), aber nicht die eigentliche
Ursache.** Zusätzlich fiel ein kaputter Service-Worker-Navigationsfallback auf
(`workbox.navigateFallback` zeigte auf eine `index.html`, die es bei `adapter-netlify`
gar nicht gibt — Fix in `vite.config.ts`). Ein echter, es wert behoben zu werden, aber am
Ende **nicht** die Ursache für das iPhone-Problem hier.

**Tatsächliche Ursache gefunden und behoben (2026-08-25): Gebete auf 9 verwaiste Konten
verstreut.** Auch nach PK-Fix, Neu-Abgleich-Button und Navigationsfallback-Fix zeigte das
iPhone weiter einen alten Stand — sogar nach vollständigem Löschen der Safari-Websitedaten
(Service Worker, Caches, IndexedDB, lokale Sitzung, alles weg), was jede
Caching-Erklärung endgültig ausschloss. Eine direkte SQL-Abfrage
(`select user_id, count(*) from prayers group by user_id`) zeigte den wahren Befund: die
über lange Zeit wirkende Sitzungspersistenz-Instabilität (siehe oben) hatte nicht nur
einmal, sondern wiederholt neue, leere anonyme Konten erzeugt — insgesamt **9 verschiedene
Konten**, die zusammen alle ~52 eigenen Gebete des Nutzers hielten (verteilt auf 24, 12, 5,
4, 2, 2, 1, 1, 1 Zeilen). Das jetzt mit Google verknüpfte „Haupt"-Konto hatte davon nur 2.
Dass der PC lokal 29 Gebete zeigte, war eine Illusion des lokalen Caches: Dexie hatte über
die Zeit Reste mehrerer vergangener Identitäten angesammelt, ohne dass je aufgeräumt wurde
— echte, tatsächlich synchronisierte Daten waren das nicht.

Behoben durch eine einmalige, manuelle SQL-Zusammenführung (bewusst **keine**
Repo-Migration — reine Daten-Einmalbereinigung für dieses eine Konto, keine
wiederholbare Schema-Änderung): alle `prayers`/`favorites`/`category_overrides`-Zeilen auf
das eine Zielkonto umgehängt, dabei Duplikate dedupliziert (gleicher `overrides_slug` unter
mehreren Konten geforkt → neueste Fassung behalten; gleiche `id` unter zwei Konten, vom
späten Nach-PK-Fix-Re-Push → neueste behalten; gleicher Favorit/dieselbe
Kategorie-Anpassung mehrfach vorhanden → `INSERT … ON CONFLICT DO UPDATE`, vorher pro
Schlüssel dedupliziert, da Postgres denselben Konfliktschlüssel nicht zweimal in derselben
Anweisung behandeln kann). Nach der Zusammenführung: eine `user_id`, 46 Zeilen, auf beiden
Geräten per „Alle Daten neu abgleichen" bestätigt.

**Lehre für künftige Fälle:** Zeigt ein Gerät „alten Stand", der auch ein vollständiges
Zurücksetzen des lokalen Speichers übersteht, direkt mit `select user_id, count(*) from
prayers group by user_id` (bzw. für `favorites`/`category_overrides` entsprechend)
nachsehen, ob Daten über mehrere Konten verstreut sind — spart gegenüber dem schrittweisen
Ausschlussverfahren (Cache, Service Worker, Sync-Cursor, …) mehrere Runden.
