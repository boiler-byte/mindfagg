# mindfagg v43 - Tests und Regressionen

## Neu in v43

- [ ] **Editor-Minimap:** HTML/CSS/JS mit Syntaxfehler öffnen: dieselben Fehlerzeilen im Editor und in der Minimap rot. Nach Korrektur der Syntax die roten Minimap-Zeilen entfernen; gefaltete Fehlerblöcke und Wortumbruch prüfen.
- [ ] **Dialoge:** In einem Eingabefeld eine Textmarkierung beginnen, Maus außerhalb des Dialogs loslassen. Dialog bleibt offen. Ein tatsächlicher Hintergrund-Klick (drücken und loslassen auf dem Backdrop) schließt ihn weiter; Schließen/Abbrechen/Escape funktionieren weiterhin.
- [ ] **Sidebar:** **Alle Ordner einklappen** steht vor **+** und **⋯** und erscheint nur, wenn sichtbare aufgeklappte Ordner vorhanden sind. Alle einklappen, Projekt wechseln, Browser neu starten und den Zustand prüfen. Durch explizite Auswahl dürfen Ordner wieder geöffnet werden.
- [ ] **Ordner verwalten:** Leerer Ordner zeigt nur **Leeren Ordner löschen**. Ordner mit Dateien oder mit ausschließlich leeren Unterordnern zeigt **Ordner löschen** und eine Bestätigung. Abbrechen verändert nichts; Bestätigen löscht auch alle Unterordner und Dateien. **Rückgängig** stellt die komplette Ordnerstruktur wieder her.
- [ ] **Script-Editor:** Dropdown **Einfügen ▾**: **Einfügen** fügt den Clipboard-Text an der Cursorposition bzw. über selektierten Text ein, **Ersetzen** überschreibt den gesamten Inhalt. Code Folding, Fehlerprüfung, Undo/Redo und Autosave prüfen. Ohne Clipboard-Berechtigung darf keine Änderung passieren.
- [ ] Mobile: Clipboard-Menü öffnet oberhalb der Toolbar und verdeckt nicht den Code. Bei Clipboard-Berechtigungsprompts und verweigerten Berechtigungen bleibt der Quelltext unbeschädigt.
- [ ] Service Worker unter derselben HTTPS-/localhost-Adresse von v42 auf `mindfagg-v43` aktualisieren und Offlinefunktion testen; IndexedDB-Workspace und ZIP-Format bleiben unverändert.

Automatisierte Prüfungen: `node tests/check-structure.mjs`, `python tests/v43-browser.py` sowie sämtliche früheren `tests/*.mjs` und `tests/*browser.py`. Der v43-Browsertest verwendet einen simulierten Clipboard-API-Zugriff, lokale Speicherinitialisierung und einen Transaktions-Dummy an der IndexedDB-Grenze, da direkte Navigation im Testbrowser gesperrt ist.

---

# Versionshistorie: v42

## Neu in v42

- [ ] **GitHub-Repository zuordnen:** Native Browser-Datalist am Repository-Feld, keine selbst erstellte Vorschlagsbox; vorhandene private/öffentliche Repositories des Tokens werden angezeigt, auch nach API-Paginierung. Repository-Namen können per Browser-Tastatur/Maus gewählt werden.
- [ ] GitHub-Fehler (offline, Token ohne Rechte): Statusmeldung sichtbar und beliebige gültige `owner/repo`-Namen weiterhin manuell eingeben; Repository-Link und Link zum Anlegen erhalten.
- [ ] **Zwischenablage als Datei einfügen:** Datalist zeigt nur Dateinamen im ausgewählten Zielordner mit derselben bevorzugten Dateiendung wie der Clipboard-Inhalt. Root-/Unterordner, Groß-/Kleinschreibung der Endung, mehrere Dateitypen und andere Projekte prüfen.
- [ ] Zielordner ändern: Datalist aktualisiert sich; ein manuell eingegebener Dateiname bleibt erhalten. Kollisionsbehandlung und Dateiimport weiterhin ausprobieren.
- [ ] HTML in einen Ordner **ohne** `.html`/`.htm`: Dateiname `index.html`; mit vorhandener HTML-Datei bleibt der normale Zwischenablage-Dateiname und die HTML-Datalist wird gezeigt. Beim Ordnerwechsel Namen nur dann automatisch anpassen, wenn ihn der Nutzer noch nicht bearbeitet hat.
- [ ] `text/html`-Zwischenablage (auch HTML-Fragmente), HTML-Klartext und PNG-Bilder testen. Upload- und ZIP-Import-Dialoge dürfen unverändert sein.
- [ ] Über denselben HTTPS-/localhost-Ursprung aktualisieren und neuen Service-Worker-Cache `mindfagg-v42` im Online- und Offlinebetrieb prüfen.

Automatische Prüfungen: `node tests/check-structure.mjs`, `python tests/v42-browser.py`, `python tests/v41-browser.py`, `python tests/v40-browser.py`, `node tests/github-sync.mjs`, `node tests/github-credentials.mjs` und alle früheren Regressionstests. Browserprüfungen simulieren GitHub-Antworten und importierte Dateien.

---

# Versionshistorie: v41

## Neu in v41

- [ ] `.html`, `.css`, `.js`, `.xml` und `.svg` öffnen: **Pretty Code** in der Script-Toolbar sichtbar, auf dem Smartphone unter dem Codebereich und oberhalb der Bildschirmtastatur.
- [ ] Jeweils ein kompaktes Beispiel formatieren. Hierarchie, CSS-Regeln und JS-Anweisungen werden lesbar eingerückt. Bei erneuter Ausführung darf kein Quelltext verloren gehen.
- [ ] JavaScript mit Regex-Literalen, Template-Strings, Kommentaren, `for`-Schleifen und objektartigen Ausdrücken prüfen. Ungültiges JavaScript darf beim Formatieren nicht verändert werden.
- [ ] XML/SVG mit Verarbeitungsinstruktion, selbstschließenden Elementen und gemischtem Text prüfen. Fehlerhafte XML-Struktur muss unverändert bleiben.
- [ ] Einen Block einklappen und dann Pretty Code ausführen: Keine `eingeklappt`-Platzhalter in gespeicherte Daten übernehmen; Undo/Redo sowie Autosave prüfen.
- [ ] `.json`, `.txt`, Markdown und andere nicht angeforderte Formate: Pretty Code nicht anzeigen.
- [ ] GitHub-Token mit mehreren freigegebenen privaten/öffentlichen Repositories nutzen. Beim Tippen erscheinen deren `owner/repo`-Namen, nicht die zuletzt verbundenen Repositorys. Pfeiltasten/Enter/ESC und Maus testen.
- [ ] Mindestens 101 Repositorys im GitHub-API-Mock: zweite Seite wird abgerufen; eine seltene Datei vom Ende der Liste ist per Filter erreichbar.
- [ ] Token ohne Repository-Freigabe, abgelaufener Token und Offline-Betrieb: Fehlermeldung, freie Eingabe von `owner/repo` und der Link zum Anlegen eines Repositories bleiben nutzbar.
- [ ] Unter HTTPS/localhost den Service-Worker auf `mindfagg-v41` aktualisieren; Pretty Code muss danach offline funktionieren. Reale GitHub-Rechte und Paginierung mit eigenem Token im normalen Browser bestätigen.

Automatische Prüfungen: `node tests/check-structure.mjs`, `python tests/v41-browser.py`, `python tests/v40-browser.py`, `node tests/github-sync.mjs`, `node tests/github-credentials.mjs`, plus die alten Regressionen. Browser-Tests betten lokale Ressourcen nur für Testzwecke ein und simulieren GitHub-Endpunkte; sie beweisen keinen Live-GitHub-Zugriff oder eine SW-Aktualisierung unter HTTPS.

---

# mindfagg v40 – Tests und Regressionen

## Neu in v40

- [ ] Frische Installation und „Editor-Standardwerte wiederherstellen“: Code Folding ist **aus**; explizit gespeichertes `true` bleibt nach Neustart erhalten.
- [ ] GitHub-Repository-Dialog mit angemeldetem Konto öffnen: Beim Fokussieren und Tippen des passenden Benutzernamen-Anfangs erscheint `login/` als anklickbarer Vorschlag. Klick bzw. Pfeil-Runter/Enter übernehmen den Wert; fremde `owner/repo`-Angaben werden nicht verändert.
- [ ] HTML, CSS, JS, XML und SVG öffnen: Desktop-Toolbar über der Textarea, Mobil-Toolbar über der virtuellen Tastatur.
- [ ] Suchen-Panel öffnen: Ersetzen-Zeile zunächst verborgen, `Aa` im Suchfeld schaltet die Groß-/Kleinschreibung um, Ergebniszähler und ↑/↓ funktionieren. Ersetzen-Zeile über ▸ öffnen und wieder schließen.
- [ ] Mehrzeiligen Suchbegriff/einen mehrzeiligen Ersatz per Paste oder Umschalt+Enter eingeben, einzeln und alle ersetzen. Sonderzeichen wie `.*`, `[]`, `^` werden **wörtlich** gesucht; kein Regex-Schalter und keine Abschnittssuche.
- [ ] Code Folding nach Bedarf einschalten, einen Treffer in einem eingeklappten Bereich suchen und gezielt einblenden. Nach „Alle ersetzen“ bleiben alle übrigen ausgeblendeten Zeilen unverändert. Undo/Redo sowie automatische Speicherung prüfen.
- [ ] Suchen mit Strg/⌘+F, Ersetzen mit Strg/⌘+H und Schließen mit Escape prüfen; Vorschau und Syntaxdiagnosen bleiben bedienbar.
- [ ] Nach dem Update über denselben HTTPS-/localhost-Ursprung laden und Offline-Service-Worker-Cache `mindfagg-v40` prüfen.

Automatisiert: `node tests/check-structure.mjs`, `node tests/v39-preferences.mjs`, `python tests/v40-browser.py`. Die vorherigen v39-v36-GitHub-/Folding-/Syntax-Tests bleiben als Regression erhalten.

---

# mindfagg v39 – Test- und Regressionscheckliste

## v39 – Code Folding

**Automatisch bestanden:** `node tests/check-structure.mjs`, `node tests/v39-preferences.mjs`, `python tests/v39-browser.py`, `python tests/v39-advanced.py`. Dabei wurden alle sechs geforderten Sprachen, verschachtelte Faltungen, Editieren ohne Verlust ausgeblendeter Zeilen, Wiedereinblenden bei Syntaxfehlern sowie der App-Schalter geprüft. Die v36–v38-Regressionsprüfungen, GitHub-Zugangsdaten und Drei-Wege-Sync blieben erfolgreich.

Manuelle Abnahme: 

- [ ] Pfeile im Markdown- und Script-Editor öffnen/schließen einzelne Faltbereiche; H1/H2, Listen, Codezäune, HTML/XML/SVG-Tags, JS/CSS-Blöcke prüfen.
- [ ] Mit Wordwrap ein-/ausgeschaltet, auf einem Smartphone und bei ausgeblendeten Zeilennummern Faltpfeile erreichbar halten.
- [ ] Nach Einklappen weiter tippen, an anderem Quelltext kopieren/einfügen, speichern, Ansichten wechseln, Undo/Redo ausführen und Originalinhalt kontrollieren.
- [ ] Code Folding in App-Einstellungen ausschalten, neu laden und wieder einschalten; Standardwerte zurücksetzen.
- [ ] Syntaxfehler unterhalb einer Faltung anklicken und zur Originalzeile springen.
- [ ] v39-Patch über v38 legen, PWA unter HTTPS/localhost laden und neue Dateien offline abrufen.

**Einschränkung:** Die automatisierten Browserprüfungen liefen mit testweise eingebetteten Dateien und simulierten Daten. Echte IndexedDB-Persistenz, native Zwischenablage und PWA-Cache-Update müssen auf einem regulären Browser geprüft werden.

## Automatisierte Prüfungen in der Entwicklungsumgebung

| Prüfung | Ergebnis |
| --- | --- |
| `node tests/check-structure.mjs`: alle Script-/CSS-Referenzen, SW-Cache und JavaScript-Syntax | Bestanden |
| Chromium: Sidebar-Menüs `+` / `⋯`, Desktop und Mobil | Bestanden |
| Ordner erstellen, Datei erstellen, Datei/Ordner umbenennen und Undo/Redo | Bestanden |
| Mehrfach-Upload von JavaScript- und PNG-Dateien in einen Unterordner | Bestanden |
| Import als eine Undo-/Redo-Aktion | Bestanden |
| Bestehende Datei ersetzen und mit Undo ursprünglichen Text wiederherstellen | Bestanden |
| Text aus Paste-Fallback als HTML-Datei anlegen, Bild-Paste als PNG-Datei speichern | Bestanden |
| ZIP mit verschachtelter Struktur, leerem Ordner und Binärdatei in einen bestehenden Ordner importieren, oberen Ordner entfernen | Bestanden |
| ZIP-Import als neues Projekt mit allen Ordnern | Bestanden |
| ZIP-Export: Dateinamen und Pfade im Archiv kontrolliert | Bestanden |
| ZIP über Teilen-Menü auf Browser ohne Web Share API: automatischer Download-Fallback | Bestanden |
| Einzelne Datei herunterladen | Bestanden |
| Datei-/ZIP-Drag-and-drop auf Sidebar-Ordner | Bestanden |
| UI-Regression: Markdown/Script-Editor, Einstellungen, Functions, SVG-Vorschau, Sidebar-Scrolling und Undo | Bestanden |
| HTML-Vorschau-Regression: HTML, CSS-Import, JS, ES-Module, Bild, Audio, `fetch`, XHR, Navigation und Sandbox | Bestanden |

**Testgrenzen:** Die Chromium-Tests verwendeten temporär in HTML eingebettete App-Ressourcen und simulierten die IndexedDB-Transaktionen. Die Testumgebung blockiert direkte Navigation zu `file://` und lokalen HTTP-URLs. Reale Browser-Persistenz über Neustarts, Service-Worker-Update und der native Teilen-Dialog auf einem unterstützten Mobilgerät wurden nicht end-to-end geprüft.

## Manuelle Prüfungen vor produktivem Einsatz

1. Vor der Aktualisierung ein ZIP-Backup des bisherigen Projekts erstellen. App unter demselben Ursprung betreiben und auf `mindfagg-v34`-Cache wechseln.
2. `+` in der Sidebar öffnen: Datei, Ordner, Datei-Upload, Zwischenablage und ZIP-Import prüfen. `⋯`: ZIP-Download, ZIP-Teilen und aktuellen Datei-Download prüfen.
3. Mehrere Dateien hochladen; Zielordner und Namenskonflikte **Umbenennen / Ersetzen / Überspringen** ausprobieren. Nach jedem Import Undo und Redo prüfen, insbesondere bei Binärdateien.
4. ZIP als neues Projekt und in einen bestehenden Ordner importieren; Option zum Entfernen des obersten ZIP-Ordners testen. Leere Ordner, UTF-8-Dateinamen, Bilder und unbekannte Binärdaten erhalten.
5. Auf Desktop Dateien und eine ZIP auf einen Ordner der Sidebar ziehen. Auf Mobil Datei-Auswahl, Paste und native Teilen-Funktion testen.
6. Clipboard-Berechtigung verweigern und Paste-Fallback testen. Tastenkürzel Strg+V/⌘V in Sidebar und unverändertes normales Einfügen innerhalb der Editoren kontrollieren.
7. ZIP auf Mobil mit unterstütztem `navigator.share({files})` teilen; bei nicht unterstütztem Browser Download-Fallback prüfen. „Teilen abbrechen“ soll keinen Download erzwingen.
8. Browserneustart: Dateien und Ordner müssen erhalten bleiben. Keine Erwartung an das Fortbestehen von Undo/Redo nach Neustart.
9. Bestehende Funktionen durchgehen: Markdown (H1, Syntax, Minimap), Mindmap (Fold, Copy/Paste, Drag), Kanban, Kalender, Scripteditor, JS-Functions, SVG- und HTML-Vorschau mit relativen Ressourcen.
10. Das PWA-Offline-Verhalten und die Vorschau-Sandbox bei Servierung über HTTPS / localhost verifizieren.

## Statische Prüfung

```sh
node tests/check-structure.mjs
```

Die App selbst benötigt weiterhin keinen Build-Schritt und keine zusätzlichen Bibliotheken.


## v32 – zusätzliche Tests

- [ ] `.mp3`, `.wav`, `.ogg`, `.m4a` etc. als Datei importieren; anklicken und Player mit Wiedergabe, Pause, Suchleiste und Lautstärke prüfen.
- [ ] Bereits in v31 importierte Binär-Audiodatei durch Anklicken öffnen, ohne Datenmigration, und ohne Byteverlust exportieren.
- [ ] Browser ohne Codec-Unterstützung: sichtbare Fehlermeldung unterhalb des Players.
- [ ] HTML-Vorschau: `Konsole` öffnen/schließen und 100-Meldungen-Grenze prüfen.
- [ ] `console.log`, `console.warn`, `console.error`, Laufzeitfehler, unbehandelte Rejections und fehlende Ressourcen erfassen.
- [ ] Meldung einzeln in Zwischenablage kopieren; „Leeren“ verwenden.
- [ ] HTML-Vorschau vergrößern und wieder verlassen (Fullscreen API, CSS-Fallback, Escape).
- [ ] Sandbox-Isolation weiterhin prüfen: HTML-Script darf nicht auf `parent.document` oder IndexedDB der App zugreifen.
- [ ] Lokal referenzierte CSS/JS/Module/Audio/Video/`fetch`/XHR dürfen durch die Konsoleninstrumentierung nicht beeinträchtigt werden.

## v34 – bidirektionale GitHub-Synchronisation

Automatisierte Prüfungen (ohne echten GitHub-Zugang):

```sh
node tests/check-structure.mjs
node tests/github-sync.mjs
node tests/github-credentials.mjs
python3 tests/github-browser.py  # optional: Python-Playwright + Chromium
```

| Prüfung | Ergebnis |
| --- | --- |
| Struktur/Syntax, Cache und Referenzen | Bestanden: 18 Stylesheets, 31 Scripts, 54 Cache-Assets, 32 JS-Syntaxchecks |
| Git-Blob, Binärbytes, Branch/Repository, Drei-Wege-Klassifikation | Bestanden: 26 Tests |
| AES-GCM (echte Node-WebCrypto), gespeicherter PAT, Restore, ungültiger Token, Entfernen | Bestanden: 14 Tests |
| Browser: App-Einstellungen, zentraler gespeicherter PAT und erneutes Laden (simulierte IndexedDB) | Bestanden |
| Browser: erster Sync (Lokal → GitHub und GitHub → Lokal), danach gemischter Sync | Bestanden |
| Browser: zwei gleichzeitige Konflikte, Zeit-/Größenvergleich, unterschiedliche Entscheidungen pro Datei | Bestanden |
| Browser: GitHub offline, lokale Änderungen bleiben erhalten; Mobilansicht | Bestanden |

**Testgrenzen:** Chromium-Navigation zu `file://` und zu lokalem HTTP wird in der Entwicklungsumgebung blockiert. Deshalb werden die Originalskripte und CSS-Dateien für den Browser-Test ausschließlich testweise inline eingebettet; GitHub-API und IndexedDB-Speicheroperationen werden simuliert. **Echter GitHub-Upload, reale PAT-Rechte, IndexedDB-Migration/Persistenz über Browser-Neustarts und das Service-Worker-Update müssen auf einem normalen Browser geprüft werden.**

Manuelle Abnahme:

- [ ] Vorher v33-ZIP-Backup exportieren; v34 am **gleichen HTTPS-/localhost-Ursprung** öffnen. Bestehende Projekte, Dateien, Editor-Einstellungen und Mindmap-Daten weiterhin vorhanden.
- [ ] Fine-grained PAT (Contents: Read and write) in **mindfagg App-Einstellungen** speichern. Browser neustarten, gespeicherten Account und Sync ohne erneute Token-Eingabe prüfen.
- [ ] Zwei Projekte mit verschiedenen `owner/repo`-Zuordnungen verbinden; `main` als Default und individuell anderen Branch testen. Projektwechsel darf weder Token noch Zuordnung des anderen Projekts verändern.
- [ ] Erster Klick auf Sync: lokale Dateien auf GitHub, online vorhandene Dateien lokal laden. Weitere Klicks bei unveränderten Dateien führen zu keinem Commit.
- [ ] Eine Datei nur lokal ändern → ein Upload; eine andere nur auf GitHub ändern → lokaler Download. Gleichzeitige konfliktfreie Änderungen beider Seiten mit **einem** Klick synchronisieren.
- [ ] Eine Datei sowohl lokal als auch remote ändern → Konflikt, beide Inhalte bleiben bis zur Entscheidung unverändert. Zwei Konfliktdateien erstellen und im **gemeinsamen Dialog** verschieden entscheiden (lokal/GitHub); Größe und Datum prüfen.
- [ ] Lokale sowie GitHub-Löschungen testen. Löschung gegen Änderung auf der anderen Seite muss Konflikt melden. Nicht entschiedene Konflikte bei erneutem Sync weiterhin anzeigen.
- [ ] Nach Löschen der globalen GitHub-Zugangsdaten muss die Repo-Zuordnung bestehen bleiben, aber ein Sync ist ohne erneute Anmeldung nicht möglich.
- [ ] Offline-/Netzfehler, ungültige PAT-Rechte, geschützten Branch und zwischenzeitliche Remote-Commits simulieren; kein ungefragtes Überschreiben und kein Force-Push.
- [ ] Lokale Datei während eines länger laufenden Uploads bearbeiten: diese Änderung darf nicht vom Download überschrieben werden.
- [ ] Markdown, Mindmap, Kanban, Kalender, Audio, Bilder, Binärdateien, ZIP, Undo/Redo und mobile Sidebar auf Regressionen prüfen.

## v35 – Editor-Attribute und Knoten-Dialog

Automatisiert: `node tests/v35-editor-dialog.mjs` und `node tests/check-structure.mjs`.

- [ ] Markdown-Datei öffnen: Editor-Textarea `#source` hat `autocomplete="off"`.
- [ ] Script-Datei öffnen: Editor-Textarea `#scriptSource` hat `autocomplete="off"`.
- [ ] Knoten über Mindmap, Kanban oder Kalender bearbeiten: **Beschreibung (Markdown)** steht oberhalb **Datum / Zeitraum** und enthält `autocomplete="off"`.
- [ ] Beschreibung und Datum ändern, speichern, Dialog erneut öffnen: Beide Angaben bleiben korrekt.
- [ ] Die benutzerdefinierte Markdown-Autovervollständigung funktioniert weiterhin; das Browser-Autofill ist davon unabhängig.
- [ ] PWA nach Upgrade neu laden: Cache `mindfagg-v35` aktiv, vorhandene Projekte und GitHub-Verbindungen bleiben erhalten.

## v36 - Mindmap, GitHub und Offline-Validierung

Automatisch ausgeführt: `node tests/check-structure.mjs`, `node tests/v36-validation.mjs`, `node tests/v35-editor-dialog.mjs`, `node tests/github-credentials.mjs`, `node tests/github-sync.mjs`, `python tests/v36-browser.py`.

- [ ] Mindmap: Zwei oder mehr Elternknoten mit mindestens zwei Unterknoten vergleichen. Unterknoten derselben Gruppe stehen sichtbar enger als Unterknoten unterschiedlicher Elterngruppen. Zoom/Fold/Drag-and-drop nachprüfen.
- [ ] App-Einstellungen: Fine-grained Token-Link öffnet einen neuen Tab. Nur `Contents: Read and write` für die benötigten Repositorys vergeben. Auf Chrome/Safari entsteht beim Eingeben/Speichern nach Möglichkeit kein Passwort-Speicherangebot. Bei anderen Browsern kann es weiterhin auftreten.
- [ ] Repository-Dialog: Eingabe `owner/repo` zeigt den anklickbaren Link `github.com/owner/repo`. Ungültige Eingaben verstecken den Link; `Neues Repository erstellen` bleibt über GitHub/new zugänglich. Beide Links müssen neue Tabs öffnen.
- [ ] Script-Editor: Gültige und ungültige `.js`, `.css` und `.html` testen; Fehlermarker in Zeilennummern und Quelltext, klickbare Meldung, Markierung nach Korrektur entfernt. Wordwrap, Minimap und unterschiedliche Schriftgrößen überprüfen.
- [ ] Zwischenablage: CSS `body { color: red; }` als `clipboard.css`, JavaScript `const value = 1;` als `clipboard.js`, normaler Text als `clipboard.txt` vorgeschlagen. Der Dateiname bleibt vor dem Import editierbar.
- [ ] Dateimenü: Trennlinie steht zwischen `Neuer Ordner` und `Dateien hochladen` (Desktop und Mobil).
- [ ] PWA nach Upgrade: Offline-Cache `mindfagg-v36` aktiv, bestehende Projekte/Dateien/GitHub-Zuordnungen erhalten; App ohne Netzwerk nutzbar.

Die Offline-Prüfungen sind lokale Syntaxhilfen, **keine formalen Standard-Validatoren**. JavaScript mit TypeScript-/JSX-Syntax und CSS-Präprozessoren sind nicht Teil der v36-Validierung. Die native Browser-Abfrage zum Passwortspeichern lässt sich nicht universell deaktivieren.

## v37 – Layout- und Dialog-Regression

- [ ] Mindmap mit vier übergeordneten Knoten und jeweils drei Unterknoten öffnen: Abstände innerhalb eines Geschwisterblocks betragen jetzt doppelt so viel wie in v36; Abstand zwischen den Blöcken +24 px.
- [ ] Auch tiefere Ebenen und eingeklappte Knoten testen; Verbindungslinien bleiben an den Knoten zentriert.
- [ ] Kanban-Ticket anklicken: Überschrift **Knoten bearbeiten**, Status-Feld sichtbar und aktueller Status ausgewählt.
- [ ] Status im Kanban-Dialog auf einen anderen Wert ändern und speichern: Ticket erscheint in der neuen Spalte; Markdown zeigt das Status-Tag korrekt.
- [ ] Dasselbe Dialog-Layout in Mindmap/Kalender vergleichen, Checkbox, Beschreibung, Datum und Knotentyp weiterhin bearbeitbar.
- [ ] Beim PWA-Update wird der Cache `mindfagg-v37` aktiviert; bestehende Projekte bleiben erhalten.

Automatisiert: `node tests/v37-regression.mjs`, `python tests/v37-browser.py`, sowie alle bisherigen Node-Regressionen.

## v38 – HTML-Vorschau mit optionalem localStorage/IndexedDB

- [ ] **Standardzustand:** In App-Einstellungen ist „localStorage und IndexedDB erlauben“ nach der erstmaligen Installation ausgeschaltet; eine HTML-Vorschau hat `sandbox="allow-scripts"`.
- [ ] In der Vorschau folgende HTML-Seite ausführen; bei deaktivierter Freigabe erscheint ein `SecurityError` für `localStorage` und/oder IndexedDB. Die Vorschau-Konsole öffnet automatisch, und **innerhalb der Fehlermeldung** steht „Speicherzugriff jetzt freigeben“.
- [ ] Den Button klicken: Vorschau lädt unmittelbar neu, `localStorage` kann einen Wert speichern/auslesen und `indexedDB.open()` kann eine neue Datenbank mit Objekt-Store öffnen und einen Wert eintragen. `htmlPreviewState` kennzeichnet die Vorschau als **nicht isoliert**.
- [ ] App-Einstellungen erneut öffnen: Schalter ist aktiviert und nach Neuladen derselben App (HTTPS/localhost, gleicher Ursprung) weiterhin aktiviert. Die Einstellung ist global für alle Projekte.
- [ ] Schalter ausschalten und Vorschau erneut öffnen: Storage-Fehlermeldung erscheint wieder; die bereits gespeicherten Daten selbst sind in diesem Ursprung noch vorhanden, werden aber vom neuen sandboxed Frame nicht gelesen.
- [ ] GitHub-Zugang: Warnung in den Einstellungen und im Fehler-Dialog weist ausdrücklich darauf hin, dass die Freigabe **alle Projekt-/App-Daten und GitHub-Zugangsdaten** exponieren kann. Keine Freigabe bei nicht vertrauenswürdigen Dateien aktivieren.
- [ ] Auf `file://`, privatem Modus und Safari/Firefox prüfen, ob der Browser selbst Storage blockiert; diese Einschränkung mit einer Fehlermeldung klarstellen. Auf regulärem HTTPS/localhost gegenprüfen.
- [ ] Frühere v36-Validator-/GitHub-Tests und v37-Mindmap-/Kanban-Tests bleiben bestanden. Offline-Cache `mindfagg-v38` wird aktiv.

Minimaler Inhalt für den manuellen Storage-Test (HTML-Datei im Workspace):

```html
<!doctype html>
<title>Speichertest</title>
<script>
  localStorage.setItem('preview-test', 'ok');
  console.log('localStorage', localStorage.getItem('preview-test'));
  const req = indexedDB.open('preview-test-db', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('values');
  req.onsuccess = () => {
    const tx = req.result.transaction('values', 'readwrite');
    tx.objectStore('values').put('ok', 'status');
    tx.oncomplete = () => console.log('IndexedDB ok');
  };
</script>
```

Automatisiert: `node tests/check-structure.mjs`, `node tests/v38-regression.mjs`, `python tests/v38-browser.py`. Einschränkung: Der Testbrowser läuft auf `about:blank` statt einem echten HTTP-Ursprung; die native Speicherung muss in einem regulären Browser bestätigt werden.
