# Gebetsraum — Konzept

Eine persönliche Gebets-App als Progressive Web App: eine kuratierte, von dir gepflegte
Bibliothek an Gebeten, dazu für jede Person eine private, synchronisierte eigene Sammlung —
schön gestaltet, sofort auffindbar, auch ganz ohne Netz.

**Stand:** 2026-08-24 — Phasen 1–3 aus der ursprünglichen Roadmap sind umgesetzt und live.
Aktuell in Arbeit: Zuverlässigkeit der Mehrgeräte-Synchronisierung, siehe „Offene Punkte".

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
eigentliche Kern des Mehrgeräte-Problems, nicht die Pull-Logik.

**Optionale Google-Anmeldung — Code fertig, Einrichtung in Supabase/Google Cloud noch offen.**
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

Damit das funktioniert, fehlt noch eine einmalige, manuelle Einrichtung (kann Claude nicht
selbst tun):
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

**Separat, unabhängig vom Auth-Fix — `prayers`-Tabelle nicht pro Konto geschützt.** Anders als
`favorites`/`category_overrides` (Primärschlüssel `(user_id, slug/item_id)`) hat `prayers` nur
`id` als Primärschlüssel. Überlebt eine lokale Zeile (z. B. durch obigen
Sitzungspersistenz-Bug) einen Kontowechsel auf dem Gerät und wird dort weiter bearbeitet,
kollidiert ein späteres Hochladen mit der bereits bestehenden, fremden Zeile — RLS blockiert
das zu Recht, aber dauerhaft (`403`, „row-level security policy (USING expression)"), nicht nur
vorübergehend. Geplanter Fix: Primärschlüssel auf `(user_id, id)` umstellen (neue Migration),
damit dieselbe `id` unter verschiedenen Konten nie kollidieren kann.
