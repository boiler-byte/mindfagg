# mindfagg v35 – Test- und Regressionscheckliste

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
