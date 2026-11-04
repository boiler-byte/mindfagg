# mindfagg v35 – modulare Architektur

## Ziel und Umfang

v32 baut auf der v30-Strukturrefaktorierung auf. Der neue Import-/Export-Bereich erweitert die Dateiverwaltung; Datenbank (`mindfagg-db`), Datenformate, Projekt-ZIP-Import/-Export, Editor-Bedienung, Mindmap und die isolierte HTML-Vorschau bleiben erhalten. Die 180 KB große `index.html` aus v29 wurde auf ein knapp 7 KB großes HTML-Grundgerüst reduziert. Das ursprüngliche Inline-JavaScript wurde anhand seiner AST-Deklarationsgrenzen in nach Verantwortlichkeiten benannte Dateien aufgeteilt. CSS-Regeln stehen in getrennten Stylesheets; ihre ursprüngliche Reihenfolge wurde beibehalten.

**Kein Framework, keine Laufzeit-Abhängigkeit zu einem CDN und kein Build-Schritt erforderlich.** `index.html` bindet alle Quelldateien unmittelbar ein.

## Verzeichnisstruktur

```text
mindfagg-v30/
├── index.html                HTML-Grundgerüst und Ressourcenreferenzen
├── module-manifest.json     Registrierte lokale Scripts, Styles und Cache-Assets
├── manifest.webmanifest     PWA-Metadaten
├── sw.js                    Offline-Cache + read-only VFS-Service-Worker
├── core/
│   ├── state.js             Gemeinsamer Zustand, Status, Akzentfarben, Menü
│   ├── database.js          IndexedDB-Helfer
│   ├── history.js           Undo-/Redo-Snapshots und History-Zustand
│   ├── persistence.js       Speichern, History-Operationen, Save-Indikator
│   ├── documents.js         Dokument-/Projektdaten, Auswahl und Initialisierung
│   └── service-worker.js    Registrierung des Service Workers
├── markdown/
│   ├── parser.js            Scanner, Parser, Datumsauswertung und Baumzugriff
│   ├── nodes.js             Knotentypen und Titel-Darstellung
│   ├── highlight.js         Markdown-Markup, Zeilennummern und Minimap
│   ├── controls.js          Inline-Steuerungen im Markdown-Text
│   ├── completions.js       Autocomplete und Wiki-Links
│   ├── commands.js          Listen, Checkboxen, Status und Einrückung
│   ├── editor.js            Editor-DOM, Ereignisse, Autosave und Mobile-Viewport
│   └── *.css                Editoreigene Styles in ursprünglicher CSS-Reihenfolge
├── mindmap/
│   ├── state-layout.js      Fold, Zoom, Hierarchielayout, Knoten-Toolbar
│   ├── inline-edit.js       Direkte Titelbearbeitung
│   ├── operations.js        Copy/Paste, Knoten verschieben, erstellen, löschen
│   ├── interactions.js      Pointer-Gesten, Drag-and-drop, Rendering
│   └── *.css                Mindmap-CSS
├── workspace/
│   ├── files.js             Workspace-Baum, Dateitypen, ZIP und Dateioperationen
│   ├── files.css             Styles der Dateiliste und Ordneransicht
│   ├── io.js                Menüs, Datei- und ZIP-Import, Download/Teilen, Zwischenablage, Drag-and-drop, Batch-History
│   ├── github.js            Drei-Wege-GitHub-Sync, PAT-Persistenz, Konfliktauflösung
│   ├── github.css           Sync-Zustand und Dialogdarstellung
│   └── io.css
├── script/
│   ├── editor.js            Scripteditor, Syntaxhighlighting, Minimap
│   ├── functions.js         JavaScript-Funktions- und Event-Handler-Übersicht
│   └── editor.css
├── preview/
│   ├── html-preview.js      Isolierte HTML-Vorschau mit lokalem Ressourcen-Broker
│   └── html-preview.css
├── views/
│   ├── kanban.js            Kanban und Tierlist
│   ├── kanban.css
│   ├── calendar.js          Kalender
│   └── calendar.css
├── ui/
│   ├── router.js            Zentrales render() und Benachrichtigungen
│   ├── bindings.js          App-Buttons, globale Shortcuts und Start
│   ├── settings.js          Globale Editor-Einstellungen und GitHub-Zugangsdaten
│   ├── settings.css
│   ├── dialogs.js           Projekt-/Dokument-/Knotendialoge
│   ├── responsive-shell.css
│   ├── node-dialogs.css
│   ├── project-components.css
│   └── theme.css
├── css/
│   └── foundation.css       Grundlayout, UI-Basisklassen und Basisthema
├── vendor/
│   ├── prism.min.js         PrismJS-Bundle (MIT)
│   └── acorn.js             Acorn-Parser (MIT)
├── icons/                   PWA-Icons
├── tests/
│   ├── check-structure.mjs  Prüfung von Pfaden, Script-Syntax und Cache-Manifest
│   ├── github-sync.mjs      Drei-Wege-Sync- und Git-Blob-Tests
│   ├── github-credentials.mjs AES-GCM- und Token-Persistenztests
│   └── github-browser.py    Isolierter Browser-Integrationstest
├── ARCHITECTURE.md
├── TESTS.md
├── THIRD_PARTY_LICENSES.md
└── ACORN_LICENSE.txt
```

## Laufzeit und Modulgrenzen

**Wichtig: v30 verwendet weiterhin klassische Browser-Scripts, noch keine nativen ES-Module.** Das ist eine bewusste Kompatibilitätsentscheidung: Der Bestand verwendet gemeinsam sichtbare `let`-/`const`-Deklarationen und Funktionsnamen über Dateigrenzen hinweg. Ein sofortiger Wechsel zu `type="module"` würde diese Bindungen isolieren und insbesondere zustandsverändernde Zugriffe (beispielsweise auf `docs`, `projectId` oder `view`) brechen. Die Dateien sind funktional getrennt, behalten für v34 aber ihre gemeinsamen globalen Bindungen. Echte `import`-/`export`-Schnittstellen sollten in einem *separaten* Refactoring mit zentraler State-API eingeführt werden.

**Script-Reihenfolge:**

1. `core/` (State, IndexedDB, History, Persistenz, Dokumente)
2. `markdown/parser.js`, `ui/router.js`, `markdown/nodes.js`
3. `mindmap/` (Layout → Inline-Edit → Operationen → Interaktionen)
4. `markdown/` (Highlight → Controls → Completions → Commands → Editor)
5. `workspace/files.js`, `preview/html-preview.js`, `ui/settings.js`
6. `vendor/prism.min.js`, `vendor/acorn.js`
7. `script/functions.js`, `script/editor.js`, `views/kanban.js`, `views/calendar.js`, `ui/dialogs.js`
8. `workspace/io.js`, danach `workspace/github.js` (GitHub-API-Client und Dialog)
9. `ui/bindings.js` (registriert Ereignisse und startet `init()`), danach `core/service-worker.js`

Alle Script-Referenzen stehen in dieser Reihenfolge in `index.html` und `module-manifest.json`. Bei Änderungen an gemeinsam genutzten Variablen, Funktionsnamen oder der Script-Reihenfolge **müssen abhängige Module mitgeprüft** werden. Ohne weitere Umstellung sollte man keine `async`-/`defer`-Attribute oder `type="module"` hinzufügen.

**CSS-Reihenfolge:** Bei der ersten Auslagerung wurde die historische CSS-Kaskade bewusst *nicht* neu sortiert. Die aufgeteilten CSS-Fragmente in `index.html` liegen in genau derselben Reihenfolge wie das bisherige Inline-CSS; danach folgen die schon zuvor externen Stylesheets. Die Dateien sind nach den bestehenden Funktionsbereichen benannt, können teilweise ältere, bereichsübergreifende Overrides enthalten. Ein Zusammenführen nach Selektoren wäre eine separate visuelle Änderung und sollte mit Screenshots getestet werden.

## Datenflüsse und Verantwortung

- **`core/`** besitzt die gemeinsame Datenhaltung, History und Speichertransaktionen. Workspace-Dateien und Ansichten dürfen nicht parallel eine eigene persistente Datenquelle führen.
- **`workspace/files.js`** behandelt Projektpfade, Bild-/Binärdaten, Ordner und ZIP-Archive. Die Pfade bleiben bei Export/Import erhalten.
- **`markdown/parser.js`** ist die Quelle für Markdown-Scan und Baumstruktur; alle Knotenansichten verwenden diesen Parser.
- **`markdown/editor.js`** und **`script/editor.js`** verwenden die gemeinsamen Editor-Einstellungen und die History-/Autosave-Funktionen.
- **`mindmap/operations.js`** bearbeitet weiterhin Markdown, nicht eine zweite Baum-Persistenz.
- **`preview/html-preview.js`** lässt Workspace-Webseiten in einem `iframe` mit `sandbox="allow-scripts"` laufen. Der Parent stellt lokale Ressourcen ausschließlich lesend bereit; die Vorschau erhält keinen direkten Zugriff auf App-State oder IndexedDB.
- **`sw.js`** bedient einerseits das App-Offline-Caching, andererseits read-only VFS-URLs. Die bestehenden CSP-/Sandbox-Header, MIME-Typen und Range-Responses bleiben erhalten.
- **`ui/router.js`** entscheidet über Markdown, Mindmap, Kanban, Kalender, Script-Ansicht und Vorschauen. **`ui/bindings.js`** startet die Anwendung erst nach dem Laden aller Funktionen.

## PWA, Versionswechsel und Bestandsdaten

- Service-Worker-Cache: `mindfagg-v34`; der Aktivierungsschritt entfernt alte Versionen.
- Der komplette Cache-Assetkatalog steht in `module-manifest.json` und `sw.js`. Bei neuen Dateien **beide** Einträge aktualisieren.
- IndexedDB `mindfagg-db` wird von Version 1 auf Version 2 aktualisiert. Die vorhandenen Stores `projects` und `docs` bleiben erhalten, neu ist `settings` für die lokal verschlüsselten App-GitHub-Zugangsdaten.
- Bereits installierte v29/v30-PWAs brauchen einen normalen Reload nach dem Update, damit der neue Service Worker alle verschobenen Ressourcen installiert.
- ZIP-Archive bleiben mit v29/v30 kompatibel. Der Export trägt Metadaten mit `version: 31`.
- Start: `index.html` öffnen. `file://`-Sicherheitsbeschränkungen hängen vom Browser ab; für PWA/Service Worker einen lokalen Webserver bzw. HTTPS verwenden.

## Entwicklung und Validierung

Aus dem App-Verzeichnis: `node tests/check-structure.mjs`. Der Test benötigt nur Node.js; für die App selbst ist Node nicht erforderlich. Er prüft Verweise, Lade-Reihenfolge, lokale Assets, `sw.js` und die Syntax aller eingebundenen JavaScript-Dateien. Ergänzend `TESTS.md` für manuelle und Browser-Regressionsprüfungen nutzen. Bei umfangreicheren Änderungen zunächst nur die Dateien des betroffenen Funktionsbereichs plus `core/`/`ui/router.js` bereitstellen.

## Neue Dateiaktionen (v32)

- `index.html` enthält bei **DATEIEN** die beiden Schaltflächen `#addDocument` und `#workspaceMore` sowie versteckte Datei- und ZIP-Inputs. Der frühere Sidebar-Footer mit den beiden großen ZIP-Buttons entfällt.
- `workspace/io.js` wird **nach `ui/dialogs.js` und vor `ui/bindings.js`** geladen. `ui/bindings.js` ruft `wireWorkspaceIO()` auf, das Menüs, File-Inputs, Tastatur-Paste und Drop-Zonen verbindet.
- Datei- und ZIP-Importe validieren Pfade über `workspaceValidPath()`. Mehrfachdateien werden vor der Transaktion vorbereitet, Konflikte nach Wahl aufgelöst und dann atomar in `docs` und `projects.folders` gespeichert.
- `workspaceCommitBatch()` erstellt für die Importaktion ein `workspace-batch`-History-Element auf dem vorhandenen strukturellen `deletionHistory`-Stack. Es bewahrt vorherige und neue Datei-Records einschließlich Binärbytes und Ordnerliste auf. `core/persistence.js` routet Undo/Redo-Einträge dieses Typs an `applyWorkspaceBatchHistory()`.
- Im bestehenden Projekt sind auch Ordnererstellung, -umbenennung, -löschung und Dateierstellung damit rückgängig zu machen. Die Historie bleibt wie bisher sitzungsgebunden; IndexedDB speichert den aktuellen Workspace, **nicht** die Undo-Historie.
- Neuer ZIP-Import als neues Projekt nutzt die bestehende atomare `commitImportedWorkspace()`-Transaktion. Der Import in einen ausgewählten Ordner verwendet `workspaceCommitBatch()`. Bilder/Binärformate bleiben bytegetreu, unveränderte Textdateien behalten ihre ursprünglichen Rohbytes.
- Die Web Share API (`navigator.share` / `navigator.canShare`) öffnet bei Unterstützung die native Dateifreigabe. Andernfalls wird dieselbe ZIP-Datei heruntergeladen. Ein abgebrochener Teilen-Dialog löst keinen automatischen Download aus.
- Für die Zwischenablage wird zuerst die asynchrone Browser-API verwendet; bei fehlender Freigabe wird ein Paste-Feld angeboten, das über ein echtes `paste`-Ereignis auch Bilddaten übernehmen kann.

**Hinweis:** Native Teilen-Dialoge und `navigator.clipboard.read()` erfordern je nach Browser eine sichere Umgebung und explizite Benutzerinteraktion. Die Dropdowns dienen nur der UI; sie erweitern nicht die Berechtigungen von HTML-Vorschauen oder dem virtuellen Dateisystem.


## Ergänzungen in v32

- `workspace/files.js`: Audio-MIME-Zuordnung, Import-Klassifizierung als `audio`, Erkennung bisheriger `binary`-Audiodateien und `renderAudioView()` mit nativen `<audio controls>`. Ursprüngliche Binärbytes bleiben für den Export erhalten.
- `workspace/files.css`: Responsive Audioplayer-Oberfläche.
- `preview/html-preview.js`: Instrumentierung von `console.log/info/warn/error/debug` sowie `error`/`unhandledrejection` innerhalb des opaque-origin Frames. Das Elternfenster nimmt ausschließlich Nachrichten des aktuellen Frames mit korrektem Sitzungstoken an, begrenzt Text auf 8000 Zeichen und hält höchstens 100 Einträge.
- `preview/html-preview.css`: Konsole als zuschaltbarer Drawer, Kopieraktion je Eintrag, Vollbild über Fullscreen API mit CSS-Fallback.
- `sw.js`: Offline-Cache auf `mindfagg-v34` angehoben. Das IndexedDB-Schema erhält den zusätzlichen Store `settings` (Version 2).

## GitHub-Synchronisation (v34)

- **Appweite Authentifizierung:** `ui/settings.js` hält den Zugangsdaten-Dialog unter App-Einstellungen. `githubSaveCredentials()` prüft den PAT über `GET /user` und verschlüsselt ihn mit AES-GCM. Der nicht exportierbare `CryptoKey` und `{iv,cipher,account,savedAt}` stehen im neuen `settings`-Store der IndexedDB. `githubRestoreCredentials()` lädt ihn während `init()`, `githubRemoveCredentials()` entfernt den Credential-Eintrag. Der Klartext ist nur während der Laufzeit im App-Kontext. Diese Verschlüsselung bietet keinen XSS-/Profil-Übernahmeschutz.
- **Projektspezifische Zuordnung:** `project.github = {owner,repo,branch,baseline,lastCommit,lastSyncedAt}` liegt im Store `projects`. `baseline` enthält Git-Blob-SHA-1-Hashes und Dateimodi pro Pfad. Verbindung und Branch lassen sich in **Projekteinstellungen** ändern, unabhängig vom appweiten Token; `main` ist Standard. Ein Wechsel zu einem anderen Repository leert die bisherige Baseline, damit keine vermeintlich bekannten Dateien überschrieben werden.
- **Ein-Klick-Sync:** `#githubSync` steht in der Sidebar unter DATEIEN; `ui/bindings.js` ruft `githubSyncClicked()` auf. Der Button zeigt per `githubUpdateIndicator()` den Zustand. `githubProjectActivated()` prüft bei Projektwechsel den Remote-Snapshot; `githubScheduleLocalStatus()` reagiert auf lokale Saves. Transfers laufen ausschließlich nach Klick, nicht durch Hintergrund-Polling.
- **Drei-Wege-Diff:** `githubFetchSnapshot()` lädt Ref, Git-Commit und rekursiven Tree; `githubLocalFiles()` erzeugt zu jeder Workspace-Datei den echten Git-Blob-Hash. `githubClassify(local,remote,tracked)` unterscheidet lokale Uploads, Remote-Downloads, bereits identische Dateien, Konflikte und unzulässige Pfade. Neu/Änderung/Löschung werden auf beiden Seiten berücksichtigt; unbekannte Remote-Dateien sind keine Löschungen.
- **Konflikte:** `githubOpenConflictDialog()` zeigt alle Konflikte gesammelt, `githubConflictCard()` stellt Größe und Änderungszeit für beide Varianten dar. Remote-Zeit stammt – soweit verfügbar – vom letzten Commit der Datei via `GET /commits?sha=...&path=...`; Git-Objekte speichern kein einzelnes Änderungsdatum. `githubResolveAndSync()` prüft Signatur von Remote-HEAD, lokalen Dateien und Baseline erneut. Lokal oder GitHub kann einzeln gewählt werden; nicht entschiedene Konflikte bleiben offen.
- **Transaktionen:** `githubExecutePlan()` lädt und verifiziert alle Remote-Blobs **vor jeder Änderung**. Danach erfolgen ein weiterer Lokaldaten- und Ref-Vergleich sowie bei Bedarf ein Upload aller Änderungen in einem Commit (`githubCommitUploads()`, `force:false`). Nach dem Commit wird der lokale Zustand nochmals geprüft, bevor `workspaceCommitChanges()` heruntergeladene oder entfernte Dateien in **einer IndexedDB-Transaktion und einem Undo-Schritt** umsetzt. Ein Fehler oder geänderter Stand verhindert das ungefragte Überschreiben.
- **Sicherheit & Ressourcen:** GitHub-Zugriff ausschließlich auf `https://api.github.com`, Authorization-Header, keine Weitergabe an Drittanbieter. Maximal 20 MiB pro Datei, 80 MiB je Upload/Download und 750 Downloads je Abgleich. Symlinks, Submodule, Git LFS und leere Ordner sind ausgenommen. Nicht exportierbare Dateisystem-/Browserartefakte können nicht in Git abgebildet werden.
- **Tests:** `node tests/check-structure.mjs`, `node tests/github-sync.mjs`, `node tests/github-credentials.mjs` und `python3 tests/github-browser.py`. Der Browser-Test verwendet in dieser Umgebung temporär inline geladene Ressourcen sowie simulierte GitHub- und IndexedDB-Aktionen; die Tests enthalten keinen realen GitHub-Upload oder Browser-Neustart mit echter IndexedDB.
