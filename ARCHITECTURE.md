# mindfagg v56 – Änderungen

## v58: Größenwert eines Hunks folgt dem Auswahlzustand

- `workspace/patch-tool.js`: `patchToolRenderPreview()` verwendet für die
  Größenangabe hinter `search (Treffer N)` den vorhandenen `deltaOf(id)`-Wert
  aus `planWorkspacePatch()` statt einer immer aktiven statischen Differenz
  `byteSize(replace)-byteSize(search)`. Ungewählte oder nicht anwendbare
  Hunks zeigen `0 B`, gewählte/anwendbare Hunks ihren tatsächlichen UTF-8-
  Größenunterschied. Datei- und Gesamtsumme verwenden denselben Plan.
- Checkbox-Änderungen rendern die Vorschau ohnehin vollständig neu; keine
  zusätzlichen Ereignis-Handler nötig. Patch-Schema und Anwendung unverändert.
- `sw.js`: Cache-Version `mindfagg-v58`; `module-manifest.json` und
  Strukturtest verwenden denselben Versionsstand.

## v57: Zustandsabhängige Markierung in der Patch-Vorschau

- `workspace/patch-tool.js` markiert die Vergleichsspalten als
  `.patch-preview-diff-search` / `.patch-preview-diff-replace`; die bisherigen,
  HTML-maskierten LCS-Diff-Fragmente und das Auswahl-/Render-Verhalten bleiben
  unverändert.
- `workspace/patch-tool.css`: die Farbe von geänderten Zeichen wird durch die
  Kombination aus **Spalte**, **Fragmenttyp** und `patch-active` / `patch-inactive`
  festgelegt. Ohne Auswahltausch werden keine Diff-Inhalte geändert.
  `patch-diff-unchanged` übernimmt die neutrale Grundfarbe ohne Hintergrund.
- `sw.js` wechselt zu `mindfagg-v57`, um CSS und JS im Offline-Cache zu erneuern.
  Keine Änderung an Patch-Schema, Workspace-Dateien oder Datenbank.

- `views/csv.js`, `views/csv.css`: Zeilen-/Spaltenköpfe sind auswählbar;
  `csvGridSelect()` verwaltet eine Zeilen-, Spalten- oder Zellenauswahl.
  `+ Zeile` fügt per `splice` über der Auswahl ein, `+ Spalte` vor der
  ausgewählten Spalte. Bei fehlender Auswahl wird angehängt. Ragged Rows
  werden vor dem Einfügen auf die sichtbare Breite aufgefüllt. Einfügen
  respektiert die 100-Zeilen-Paginierung und setzt den Fokus auf die
  eingefügte Position; Grid-Speicherung bleibt unverändert.
- `views/html-markdown.js`: `markdownHtmlNodeCheckbox()` rendert die
  vorhandene Checkbox direkt vor dem Knotentitel (Überschrift oder Liste).
  `markdownHtmlNodeControls()` rendert nur gesetzte Metadatenfelder sowie
  ein Plus-Dropdown für noch fehlende Attribute. Status-/Datums-Entwürfe
  sind bis zur Auswahl verborgen; die Speicherung nutzt unverändert
  `markdownHtmlChangeNode()` und dessen Undo/Persistenz.
- `views/html-markdown.css`: Titel-/Checkbox-Layout, Plus-Menü und
  Entwurf-Editoren; die HTML-Tab-Beschriftung wird bis 850 px ausgeblendet.
- `sw.js`, `module-manifest.json`, `tests/check-structure.mjs`: Cache/
  Paketversion v56. Keine neuen Produktionsdateien und keine Änderung der
  Cache-Assetliste.
- `tests/v56-browser.py`: CSV-Positions-/Paginierungsprüfungen und HTML-
  Attribut-, Checkbox-, Status-/Datum- und Mobilprüfungen.
- `tests/v51-browser.py`: Bestehende HTML-Regression auf die neue
  Plus-Menü-Bedienung und ausgeblendete Mobilbeschriftung angepasst.

---

# mindfagg v55 - Änderungen

- `workspace/patch-tool.js`: `patchToolDiffFragments()` berechnet eine
  zeichenbasierte LCS-Differenz nach gemeinsamem Präfix/Suffix; höchstens
  240.000 Matrixzellen je Teilvergleich. Größere Differenzen werden anhand von
  Wort-/Leerraum-Tokens verglichen oder vollständig als entfernt/eingefügt
  angezeigt. `patchToolDiffPreview()` erzeugt für `search`/`replace` getrennte,
  HTML-escapte Spans (`unchanged`, `removed`, `added`). Bis zu 2.000 Unicode-
  Zeichen pro Seite, unabhängig vom unveränderten Patchinhalt. Eine Hunk-ID-
  Map im Modalzustand cached das Diff bis zum Laden eines anderen Patches.
  Die bereits vorhandene Checkbox-Logik rendert mit `patch-active` bzw.
  `patch-inactive` neu. Datenmodell, Anwendbarkeit, Byte-Deltas, Speicherung
  und atomare Einspielung bleiben unverändert.
- `workspace/patch-tool.css`: Unverändertes sowie übernommenes Material grün;
  aktiv entfernte und deaktiviert verworfene Teile rot und durchgestrichen.
  Die sichtbaren Textzeichen, inklusive Unicode, stehen in normalen
  Text-Spans innerhalb des bestehenden `<pre>`.
- `index.html`: Die in v54 fehlerhafte Position von `views/csv.js` korrigiert:
  vor `ui/settings.js`, wie bereits im `module-manifest.json` vorgesehen.
- `sw.js`, `module-manifest.json`, `tests/check-structure.mjs`: neuer
  Offline-Cache-/Versionswert v55, unveränderte Assetliste.
- `tests/v55-patch.mjs`, `tests/v55-browser.py`: Diff-Rekonstruktion,
  HTML-Escaping, Unicode, große Hunks, Auswahlwechsel, berechnete CSS-Farben,
  Durchstreichung und geöffneten Dateiblock geprüft.

---

# mindfagg v54 - Aenderungen

- `views/mermaid.js`, `views/mermaid.css`: Unterer rechter Fit-Button ruft die
  schon vorhandene `mermaidFitView()`-Transformation auf; vorhandenes
  Pointer-/Wheel-Navigieren und gesichertes Blob-Image-Rendering bleiben.
- `script/pretty-code.js`: `.json` ist eine neue Parser-basierte Pretty-Option,
  die nur nach erfolgreichem Parse schreibt.
- **Neu `views/csv.js`, `views/csv.css`:** CSV-Vorschau mit editierbarem Grid,
  paginierter Tabelle, Text-only-Zellen und Dokument-Autosave; Parser/Unparser
  durch Papa Parse 5.7.0 (CDN bei Verfuegbarkeit), lokaler RFC-4180-Fallback
  ohne Netz. CSV-Encoding ueber `TextEncoder`/`TextDecoder` und gezielte
  Konvertierung fuer UTF-16, BOM und Windows-1252.
- `workspace/files.js`: CSV-Symbol, Grid-Dateitab, Import-/Export-Metadaten.
  Bestehende `originalContent`/`raw`-Regeln erhalten unveraenderte Importbytes.
- `ui/settings.js`/`.css`: Persistente CSV-Defaults im bestehenden
  Settings-Key; `ui/dialogs.js` nutzt sie fuer neue CSV-Dateien.
- `ui/router.js`, `workspace/io.js`, `markdown/editor.js`: Grid-Routing,
  CSV-MIME und Flush der Grid-Speicherung beim Ansichtswechsel.
- `index.html`, `module-manifest.json`, `sw.js`: Modulreihenfolge und
  Offline-Cache v54, beide lokalen CSV-Module enthalten.
- `tests/v54-browser.py`: End-to-End-Tests fuer Fit, Pretty JSON, CSV-Defaults,
  Import/Export und CSV-Grid-Bearbeitung, Kodierung und Sicherheit.

---

# mindfagg v53 - Aenderungen

- `views/mermaid.js`/`views/mermaid.css`: Canvas-aehnlicher Zoom/Pan per
  Pointer-Events und Wheel statt statischem Scrollcontainer; berechnete
  SVG-viewBox-Groesse und initiales Fit-to-Viewport; per-Datei Sessionzustand;
  die Preview-Toolbar ist entfernt. Die sichere SVG-als-Blob-IMG-Grenze bleibt.
- `workspace/io.js`: Mermaid-Quelltextdetektion vor JS/CSS-Detektion bei
  Zwischenablage-Import; MIME/Text-Ausgabe des vorhandenen Importers unveraendert.
- `mindmap/state-layout.js`/`mindmap/inline-edit.js`: Begrenzung nur der
  sichtbaren Knotenlabels; vollstaendige Originaldaten und ARIA-Labels bleiben.
- `index.html`: Position des HTML-Tabs vor Kanban verschoben.
- `workspace/patch-tool.js`/`.css`: UTF-8-Delta aus aufeinanderfolgenden
  virtuellen Dateioperationen; zusaetzlich theoretische Hunk-Differenzen im
  Vergleich. Neues `patchSave`-Select: `none` / `full` / `selected`, bei
  unveraenderter atomarer Commit- und Undo-Logik.
- `sw.js`, `module-manifest.json`: Cache-Version v53, exakt dieselbe lokale
  Modulliste. `.nojekyll` liegt zusaetzlich im Web-Root fuer GitHub Pages.
- `tests/v53-*`: Browser- und Planner-Regressionen; alte Tests nachgezogen.

---

# mindfagg v52 – Mermaid-Diagramme

- `workspace/files.js`: `.mmd`/`.mermaid` gelten als Text-Scripts, erhalten ein eigenes Sidebar-Symbol und einen zweiten Dateitab **Mermaid**; bestehende Script-/HTML-/SVG-Ansichten bleiben unverändert.
- `ui/router.js` und `views/mermaid.js`: Neue asynchrone Vorschau mit eigenem Sequenzschutz für Dateiwechselsituationen. Die lokal geladene Mermaid-Engine wird einmal mit `securityLevel: 'strict'` initialisiert und SVG nur über `URL.createObjectURL(new Blob(...))` als `<img>` angezeigt; die bestehende Vorschau-Ressourcenverwaltung gibt URLs wieder frei.
- `script/editor.js` und `vendor/prism-mermaid.min.js`: Mermaid-Grammatik nutzt den bestehenden Prism-Overlay-Editor. `mermaidValidateSyntax()` ruft den Mermaid-Parser asynchron auf; veraltete Ergebnisse werden verworfen. Diagnose, Minimap, Zeilenmarkierung und Navigation zu Fehlerstellen verwenden die schon vorhandenen Komponenten.
- `views/mermaid.css`: Eigene scrollbar gerenderte Diagrammansicht mit Toolbar, Status und Fehleranzeige.
- `ui/dialogs.js`, `workspace/io.js` und `sw.js`: Neue `.mmd`-Datei mit Startinhalt, Text-MIME, Import/Export und VFS-MIME. Kein Datenbank-Schemawechsel.
- `vendor/mermaid/*`: Lokal zusammengestellte Mermaid-11.12.2-ESM-Abhängigkeiten. `index.html`, `module-manifest.json` und `sw.js` referenzieren neue CSS-/Script-Module und alle lokalen Mermaid-Chunks; Service-Worker-Version `mindfagg-v52`.
- `tests/v52-browser.py`: Browserintegration mit gemocktem Engine-API (Editor, Vorschau, Fehler, Import/Export); die echte ES-Modul-Ausführung über `tests/v52-mermaid-engine.py` (Offline-Importmap, vier Diagrammtypen und Parserfehler) automatisiert geprüft.

---

# mindfagg v51 – HTML-Ansicht und Toolbar

- `index.html` erweitert `#markdownTabs` um einen fünften Tab (HTML) und verwendet einheitliche SVG-Symbole für Mindmap, Kanban, Kalender und HTML. Die bisherigen `data-view`-Werte und Eventbindungen bleiben bestehen.
- `core/state.js`: `VIEWS` enthält jetzt `html`. Die Persistenz des letzten Tabs (`mfLastView`) funktioniert damit ohne Datenmigration.
- `ui/router.js`: Für Markdown-Dateien wird `renderMarkdownHtml()` vor der exklusiven H1-Validierung aufgerufen; HTML funktioniert daher auch bei ungültiger Mindmap-Struktur. Die HTML-Bildressourcen werden vor jeder Neuzeichnung freigegeben. Die aktiven Tabs besitzen `aria-selected`.
- **Neu: `views/html-markdown.js`** baut HTML aus gescannten Markdown-Zeilen und `currentModel` (keine zweite Datenquelle). Alle dynamischen Werte werden HTML-kodiert; URL-Protokolle werden geprüft. Das Inhaltsverzeichnis verwendet die Quellzeilen als stabile Anker und verändert die Browser-History nicht. Die Status-, Checkbox- und Datumskontrollen bearbeiten die Markdown-Metadaten auf der zugehörigen Quellzeile und speichern sie über `put('docs',...)`. Dadurch entsteht jeweils ein regulärer Undo-Snapshot, der von `changeHistory()` verarbeitet wird. Die übrigen Markdown-Zeilen bleiben unverändert.
- **Neu: `views/html-markdown.css`** gestaltet die zweispaltige HTML-Ansicht, das mobile einklappbare Inhaltsverzeichnis und die responsiven Fünf-Tab-Ansichten. Bei ≤850 px haben Kanban und Kalender nur Symbole, die Textlabels von Markdown, Mindmap und HTML bleiben sichtbar.
- `module-manifest.json` und `sw.js`: Binden beide neuen Module in Ladereihenfolge und Offline-Cache ein; Cache-Version `mindfagg-v51`.
- `tests/v51-browser.py`: Prüft Rendering, TOC, sichere Maskierung, Inline-Bearbeitung von Aufgaben/Status/Datum, Undo-Snapshots, Ansichtswechsel und kleine Bildschirme.

**Weiterhin unverändert:** IndexedDB-Schema, Kanban/Kalender/Mindmap, der Script- und HTML-Datei-Preview, die GitHub-/Patch-/Teilen-Werkzeuge und alle bisherigen Exportformate.

---

# mindfagg v50 – Änderungshinweise

- `index.html`: Der sichtbare Schnellaktions-Button des Patch-Tools heißt **Patchen**; IDs und Eventbindung bleiben unverändert.
- `workspace/files.js`: `workspaceFileIcon()` erzeugt feste, farbige SVG-Dateisymbole anhand der Dateiendung. Dateinamen werden weiterhin über `escapeHtml()` gerendert; alle Dateioperationen bleiben unverändert.
- `workspace/files.css`: Typbezogene Symbolgrößen und feste Farben, unabhängig vom Projektakzent.
- `module-manifest.json` und `sw.js`: Offline-Version v50, unveränderte Modulreihenfolge.
- Keine Änderung am Speicher-/ZIP-Schema, an Undo/Redo oder den Patch-Operationen.

---

# mindfagg v49 - gezielte UI-Aenderungen

- `index.html`: Die zwei vorhandenen `workspace-quick-button`s in `workspace-quick-actions` sind im DOM vertauscht; das responsiv zweispaltige Layout und die Event-IDs bleiben identisch.
- `workspace/patch-tool.js`: Bei `patchToolMessage(message, 'error')` wird nur fuer Meldungen mit `Patch abgelehnt:` ein kopierbarer Button generiert. Er ruft die vorhandene gemeinsame Funktion `writeMapClipboard()` auf und zeigt das Ergebnis im Toast. Die unveraenderte Fehlerbeschreibung wird kopiert, ohne das Feld oder den Dialog zu schliessen. Der zentrale `PATCH_TOOL_PROMPT` verwendet `String.raw` fuer die drei unverfaelschten JSON-Escape-Sequenzen.
- `workspace/patch-tool.css`: Button passt sich der bisherigen roten Fehlermeldung an, ist mit Fokus- und Hover-Styling erkennbar.
- `sw.js`, `module-manifest.json`, versionsspezifische Test-Assertions: Cachewechsel auf v49. Keine weiteren Assets und keine Datenmigration.
- `tests/v49-browser.py`: Regression fuer Sidebar-Reihenfolge, kopierbare Fehler (Maus, Tastatur, Fallback) und identische Escape-Phrase im Patch- und Teilen-Dialog.

---

# mindfagg v48 - Aenderungen an der UI

- `index.html`: Zwei permanente Sidebar-Buttons (`workspacePatchQuick`, `workspaceShareQuick`) unter dem nur bei vorhandenem Token sichtbaren `githubSync`. Der `workspaceMore`-Tooltip lautet Download.
- `workspace/github.css`: responsive Zwei-Spalten-Buttonzeile; explizite `[hidden]`-Regel fuer den GitHub-Button.
- `workspace/github.js`: `githubUpdateIndicator()` bindet `.hidden` an `Boolean(githubCredentialToken)`. Der bisherige Aufruf aus Rendern, Credential-Speichern und Entfernen bleibt die einzige Sichtbarkeitsquelle.
- `ui/bindings.js`/`ui/router.js`: neue Direktbuttons nutzen `workspaceExecuteAction`, wechseln ohne Projekt in den deaktivierten Zustand.
- `workspace/io.js`: Creation/Import und Download-Menues verwenden konsistente statische SVG-Symbole (Datei, Ordner, ZIP-Ordner). Die Download-Zeile liest den Dateinamen aus `fileLabel(documentNow())` beim Oeffnen; HTML-Escaping bleibt erhalten.
- `sw.js` / `module-manifest.json`: v48-Cache; keine neuen Laufzeit-Assets, keine Datenmigration.

---

# mindfagg v47 - modulare Architektur

## v47: Dateifreigabe mit Groessensummen und App-lokale Back-Navigation

- **`workspace/io.js` / `workspace/io.css`:** Im Teilen-Dialog wird `fileSizes` einmal pro Dateiauswahl aus `exportFileBytes(doc).byteLength` abgeleitet und nach Dateinamen angezeigt. `workspaceShareSizeLabel()` wandelt Bytezahlen in lesbare B/KB/MB/GB-Einheiten um. Der `selected`-Set steuert jetzt globale/Verzeichnis-/Datei-Checkboxen; `update()` berechnet die Anzahl und Byte-Summe. Der Share-Aufruf nutzt unveraendert die echte Dateiauswahl und synchrones `navigator.share()`.
- **KI-Phrase:** `#workspaceShareCopyPatch` benutzt `writeMapClipboard(PATCH_TOOL_PROMPT)` (vorhandener Clipboard-Fallback aus `mindmap/operations.js`). `PATCH_TOOL_PROMPT` bleibt zentral im `workspace/patch-tool.js`, das vor `ui/bindings.js` geladen wird.
- **`ui/browser-back.js` (neu):** `initBrowserBackNavigation()` legt per `history.pushState` einen Same-URL-Guard an und behandelt `popstate`. Dialoge haben Vorrang (`closeModal()` inklusive GitHub-Busy-Sperre), andernfalls wird die Sidebar umgeschaltet. Nach jedem Event wird der Guard erneut angelegt. Mobile nutzt `setMobileMenu()`, Desktop `back-sidebar-hidden`. Dieser Mechanismus fängt bewusst den normalen History-Back innerhalb der App ab.
- **`ui/bindings.js`:** Initialisiert die Navigation vor dem bisherigen asynchronen `init()`. `index.html` bindet das neue Script vor `ui/bindings.js` ein, `css/foundation.css` enthaelt die Desktop-Layoutregel.
- **`sw.js` / `module-manifest.json`:** Fuegen das neue Script in die Offline-Assetliste ein und aktualisieren die Cache-Version auf `mindfagg-v47`. Das IndexedDB-Schema und das Projektformat bleiben unveraendert.
- **`tests/v47-browser.py`:** Prueft Bytegroessen von UTF-8-/Binaerdaten, Global-/Gruppen-/Dateiauswahl, native Share-Payloads, Patch-Phrase und reale `history.back()`-Ausloesung im Chromium.

---

# mindfagg v46 - modulare Architektur

## v46: kontextbezogene Patch-Pruefung, einklappbare Vorschaudateien und Share-Auswahl

- **`workspace/patch-tool.js` / `.css`:** Der eigenstaendige Validate-Button entfällt. `patchToolMessage(..., 'needs-validation')` bietet einen roten, als Button fokussierbaren Link zu `patchToolParseInput()`. `patchToolRenderPreview()` baut pro Datei ein natives `details > summary` mit `operation` und dem Tripel `patch / found / total`. Eine zweite, **rein virtuelle** Vollplan-Simulation zaehlt anwendbare Treffer unabhaengig von der aktiven Auswahl. `patchToolState.expanded` behaelt geoeffnete Dateien bei der UI-Neuzeichnung (nicht ueber das Laden eines neuen Patches hinaus). Die Checkboxen, finalen Auswahlauswertungen, Speichertransaktion und Undo/Redo bleiben unveraendert.
- **`workspace/io.js` / `.css`:** Die `zip-share`-Menueaktion oeffnet `openWorkspaceShareDialog()`. `workspaceShareGroups()` sortiert und gruppiert Dateien nach ihrem unmittelbaren Elternverzeichnis, Root immer zuerst. Dateiauswahl und Gruppen-Checkboxen steuern einen Satz von IDs, inklusive des nativen Zwischenzustands `indeterminate`. Keine Dateiauswahl deaktiviert den Share-Button.
- **ZIP-/Einzeldateien:** `workspaceBuildZipSelection(files, includeAllFolders)` erstellt synchron ein selektives, importierbares ZIP, einschliesslich Metadaten und erforderlicher Elternordner; `workspaceBuildZip()` ruft den Builder nach bisherigen Flushes fuer den **vollstaendigen Export** auf. `workspaceShareIndividualFiles()` erzeugt originalgetreue `File`-Objekte mit eindeutigen Namen (Pfadpraefix bei Doppelungen). Der Klick ruft `navigator.share({files})` synchron auf, um die Browser-User-Activation zu erhalten. Wenn `share`/`canShare` Dateianhaenge nicht unterstuetzen, folgt der dateitypgerechte Download-Fallback; Abbruch durch den Benutzer loest keinen Download aus.
- **Keine Persistenzmigration:** IndexedDB, Projekt-ZIP-Format und Historie bleiben unveraendert. `sw.js` und `module-manifest.json` wechseln zur Version **v46**. `tests/v46-browser.py` deckt Vorschau, Selektion, selektive ZIP-Inhalte, originale Einzeldateien, gleiche Basenamen und Download-Fallback ab. Die v44/v45-UI-Tests verwenden nun das klickbare Hinweisfeld und klappen den benoetigten Dateiblock auf.
- **Delta-Lieferung:** Nur neue und tatsaechlich geaenderte Dateien gegen v45. Alle anderen Module stammen weiterhin aus der vorhandenen Installation.

---

## Versionshistorie: v45


## v45: Geordnete Dateioperationen, selektives Patch-Archiv und atomare Historie

- **Format-Pruefung (`workspace/patch-tool.js`):** Pro Eintrag `operation` + `file`, optional `description`. Typabhaengige Pflichtfelder: `create`/`replace` -> `content`; `update` -> `hunks[]` mit `search`, `replace`, `occurrence`; `delete` -> keine; `rename` -> `to`. Zusatzeigenschaften werden abgewiesen. Bestehende v44-Update-Bloecke ohne `operation` bleiben lesbar (mit bisher obligatorischer `description`). JSON Groessenlimit 4 MB und maximal 500 auswaehlbare Schritte bleiben bestehen.
- **Virtuelles Dateisystem (`planWorkspacePatch`):** Ausgehend von den Dokumenten des aktuellen Projekts wird jeder angehakte Schritt in Patch-Reihenfolge simuliert. Case-insensitive Pfadkollisionen, Ordnerkonflikte, nicht vorhandene Dateien, unpassende exakte Suchtexte und Versuche, Binaerdaten als Text zu behandeln, werden vorab erkannt. `create` und `rename` koennen erforderliche Elternordner anlegen. `delete` und `rename` duerfen auch Binaerdateien betreffen. Keine Quelldaten werden waehrend der Vorschau mutiert.
- **Speichern (`patchToolSelectedPatch` / `patchToolSaveRecord`):** Checkbox **Patch speichern** erzeugt eine JSON-Textdatei im Root mit lokalem Zeitstempel `YYYY-MM-DD-HHmmss.patch.json`. Die Datei enthaelt nur die tatsaechlich ausgewaehlten Operationen und bei `update` ausschliesslich gewaehlte Hunks. Namenskollisionen erzeugen nie ein Ueberschreiben. Die Datei wird zum selben Batch hinzugefuegt wie die eigentlichen Aenderungen.
- **Transaktion / Undo (`workspace/io.js`, unveraendert):** `workspaceCommitChanges(afterFiles,deletedIds,foldersAfter,selectedId)` speichert Erstellungen, Umbenennungen, Inhaltsaenderungen, Loeschungen, Zielordner und eine optionale Patch-Datei **atomar**. Der bestehende `workspace-batch`-Verlauf behandelt das gesamte Ergebnis als **eine** Undo-/Redo-Aktion, ohne Datenbankmigration.
- **UI (`workspace/patch-tool.css`):** Checkbox vor dem Anwenden-Button; die Vorschau zeigt alle Operationstypen und ihren Status. Die KI-Phrase beschreibt alle fuenf Formate. Bestehende JSON-Einspielwege bleiben unveraendert.
- **Offline und Tests:** `sw.js` und `module-manifest.json` auf v45, statische Regressionstests an neue Version angepasst; neue Tests `tests/v45-patch.mjs` und `tests/v45-browser.py`. Das Auslieferungspaket ist ein Delta zur vollstaendigen v44-Installation.

---

## Versionshistorie: v44

## v44: Selektiver, atomarer JSON-Patch-Workflow

- `workspace/patch-tool.js`: Striktes Schema `patches[]` mit `file`, `description` und `hunks[]` (`search`, `replace`, `occurrence`). Literal-Suchtext, occurrence ist 1-basiert und nicht ueberlappend. Dateibloecke/Hunks laufen der Reihenfolge nach auf dem jeweils aktuellen Zwischenstand. Unveraenderte, fehlende oder binaere Dateien werden nicht stillschweigend angepasst. Kein `eval`, keine Regulare-Ausdruck-Interpretation aus JSON.
- `workspace/patch-tool.css`: Eigenstaendiges responsives Modal-Styling mit JSON-Eingabe, Datei-Dropzone, Projektauswahl, Preview und Prompt-Kopiervorlage.
- `workspace/io.js`: Fuegt **Patch-Tool** im `+`-Dropdown hinzu und startet die bestehende Modal-Infrastruktur. Die gesamte ausgewertete Auswahl wird mit `workspaceCommitChanges()` als **ein** `workspace-batch` in IndexedDB gespeichert. `core/persistence.js` / `core/history.js` und `workspaceApplyBatch()` stellen damit alle geaenderten Dateien in einem Undo/Redo wieder her.
- `index.html`: Neue CSS-/JS-Referenzen; das Collapse-All-Icon ist ein gestricheltes Rechteck mit Minus. `ui/dialogs.js` entfernt beim Oeffnen anderer Dialoge die `patch-modal`-Klasse.
- `module-manifest.json` und `sw.js`: v44 und Precache beider neuer Module. IndexedDB- und ZIP-Schemas sind unveraendert. Die neue Version ist ein **Delta zu v43**, nicht das gesamte Laufzeitpaket.
- `tests/v44-patch.mjs`: Striktes Schema, Path Traversal, Nth-Occurrence, Reihenfolge und Fehlermarkierung. `tests/v44-browser.py`: Benutzerinteraktion, Importquellen, Projektauswahl, Preview, selektives Anwenden und transaktionales Undo/Redo.

---

## Versionshistorie: v43

## v43: Syntax-Minimap, modal-sichere Pointer, persistente Ordner und Clipboard

- `script/editor.js` färbt Minimap-Zeilen anhand der von `validateScriptContent` gelieferten Diagnosezeilen (`codeFoldVisibleIndex`) rot. Die Canvas-Ansicht wird bei jeder Aktualisierung der Syntaxprüfung neu gezeichnet. Die neue Toolbar-Aktion liest `navigator.clipboard.readText()` nur nach Benutzerinteraktion und übergibt Änderungen an `scriptFindApplyChange()`, ohne Quelltext an den Fold-Platzhaltern vorbei zu schreiben.
- `script/find-replace.js` und `script/find-replace.css` fügen das zweiteilige Clipboard-Menü als **Geschwisterelement** der scrollbaren Toolbar hinzu. Es wird außerhalb der Toolbar positioniert, damit es auf Desktop- und Mobilansichten nicht abgeschnitten wird; auf Mobilgeräten öffnet es nach oben.
- `ui/dialogs.js` schließt durch den Backdrop nur nach einer `pointerdown`- und `pointerup`-Sequenz, deren beide Ziele der Backdrop waren. Textauswahl/Dragging, deren Presspunkt in einem Dialog liegt, schließen ihn nicht.
- `workspace/files.js`, `ui/router.js`, `ui/bindings.js`, `workspace/files.css` und `index.html` integrieren den Collapse-All-Button und speichern geschlossene Ordner über `mfWorkspaceCollapsedFolders` projekt- und pfadbezogen in `localStorage`. Fehlende Einträge entsprechen standardmäßig geöffneten Ordnern. Beim Projektwechsel werden gespeicherte geschlossene Ordner nicht automatisch geöffnet.
- `workspace/files.js` zeigt abhängig von Dateien **oder** Unterordnern eine der beiden Löschaktionen. Für nichtleere Ordner löscht `workspaceCommitChanges()` Dateien und explizite Unterordner gemeinsam über die bestehende transaktionale Undo-Historie. Ordnerumbenennung übernimmt gespeicherte offene/geschlossene Zustände.
- `sw.js`, `module-manifest.json` und `tests/check-structure.mjs` setzen die Cache- und App-Version auf **v43**. Kein neues Laufzeitmodul, keine Schema- oder ZIP-Änderung. `tests/v43-browser.py` prüft die neuen UI-Flows mit simuliertem lokalem Transaktionsspeicher.

---

# Versionshistorie: v42

## v42: native Datalists in GitHub-Zuordnung und Zwischenablage-Import

- `workspace/github.js`: `openGithubDialog()` verknüpft das Repository-`input` über `list` mit einem nativen `datalist`-Element. `githubListAccountRepositories()` lädt weiterhin nur token-berechtigte Repositories, paginiert bis zu zehn Mal und hängt neue Optionen schrittweise an, ohne ein eigenes Fokus-/Tastatur-/Dropdown-System. Ein veralteter Abruf darf keinen anderen Dialog oder Token befüllen. Die bisherige Link-Aktualisierung und die freie Repository-Eingabe bleiben erhalten.
- `workspace/github.css`: Entfernt die Regeln für den eigenen Popup-/Listen-Controller; nur die unaufdringliche API-Statusmeldung bleibt.
- `workspace/io.js`: `workspaceClipboardPreferredExtension()` bestimmt die zur Zwischenablage passende Erweiterung. `workspaceClipboardFilesInFolder()` berücksichtigt ausschließlich Dateien im gewählten Ordner und im aktuellen Projekt. Der Clipboard-Dialog befüllt eine native Datalist, die beim Zielordnerwechsel erneuert wird. `workspaceClipboardDefaultName()` setzt bei HTML in einem Ordner ohne `.html`/`.htm` den Vorschlagsnamen `index.html`. Manuell geänderte Dateinamen werden nicht überschrieben; die bestehenden Validierungs- und Konfliktregeln bleiben maßgeblich.
- `sw.js`, `module-manifest.json`: Cache-/Anwendungsversion `v42` für die vollständige offline-fähige App. Keine Änderung an IndexedDB, ZIP-Datenformat oder GitHub-Verbindungsschema.
- `tests/v42-browser.py`: Prüft GitHub-Paginierung und -Fehler sowie ordner- und endungsabhängige Dateinamenvorschläge, HTML-Spezialfall und den unveränderten Datei-Upload-Dialog.

---

# Versionshistorie: v41

## v41: Pretty Code und API-basierte GitHub-Vorschläge

- `script/pretty-code.js`: Offline-Formatter für HTML/JS/CSS/XML/SVG, ohne zusätzliche Drittanbieterbibliotheken. Benutzt den bereits gebündelten Acorn-Parser für die JS-Strukturprüfung und (im Browser) `DOMParser` für XML/SVG-Wohlgeformtheit. Die Formatierung arbeitet auf `codeFoldFull(source)`, nicht auf den Fold-Platzhaltern. Bei fehlgeschlagener Prüfung ändert sie keinerlei Dokumentdaten.
- `script/find-replace.js`: Ergänzt in der bestehenden Editor-Toolbar den Pretty-Code-Button, `script/editor.js` registriert `scriptPrettyMount(doc)`. Tatsächliche Änderungen werden an `scriptFindApplyChange()` übergeben; der normale Editor-`input`-Handler sorgt für Syntaxdiagnose, Persistenz, Undo/Redo und Find-Highlights. `script/find-replace.css` blendet den Button bei nicht unterstützten Dateiformaten aus.
- `workspace/github.js`: `githubListAccountRepositories()` paginiert `GET /user/repos` mit dem entschlüsselten In-Memory-Token. `openGithubDialog()` verwaltet eine dialoglokale, filterbare Trefferliste und zeigt API-Fehler an. Es gibt keinen neuen persistenten Cache und keine Änderung an GitHub-Verbindungen, Sync-Baselines, Token-AES-GCM oder Projekt-ZIPs. Ein veralteter Request kann keinen geschlossenen/neuen Dialog überschreiben.
- `workspace/github.css`: Dropdown, Scrollbereich, private/öffentliche Kennzeichnung und Tastaturfokus.
- `index.html`, `module-manifest.json`, `sw.js`: Bindet `script/pretty-code.js` nach `script/find-replace.js`, vor `script/editor.js` ein und nimmt es in den Offline-Precache auf. SW-Version `mindfagg-v41`; keine externen Skripte/CDNs, kein Build-Schritt.

**Hinweis zu Pretty Code:** Die konservative Strukturformatierung ist keine vollständige Prettier-Implementierung. JavaScript-Fehler und AST-Abweichungen verhindern eine Änderung. XML/SVG bleibt bei fehlerhafter Struktur unverändert. Bei HTML mit Inline-/Mischtext wird Inhalt nicht umgebrochen, um Textabstände zu erhalten.

---

# Versionshistorie: v40


## v40: Suchen und Ersetzen, GitHub-Vorschlag, mobile Toolbar

- `script/find-replace.js`: Literal-Suchlogik im vollständigen `codeFoldFull()`-Text, Ergebnisverwaltung, Fallunterscheidung, Markierungen (escaped Overlay), Navigation sowie Einzel-/Alle-Ersetzen. `scriptFindApplyChange()` schreibt den kanonischen Quelltext in den vorhandenen Code-Folding-Zustand, löst genau ein Editor-`input`-Event aus und verwendet damit die bestehende History/Autosave/Diagnose-Pipeline. Es gibt **keine zweite persistente Datenquelle**.
- `script/find-replace.css`: Werkzeugleiste und auf-/zuklappbares Suchpanel. Auf Mobilgeräten ordnet `mobile-script-active` die Leiste am unteren Rand des über `visualViewport` angepassten Editors ein, entsprechend der Markdown-Bedienung.
- `script/editor.js`: Fügt die neue Toolbar/Overlay-Ebene hinzu und synchronisiert Suche/Markierungen mit dem normalen Syntax-Layer, minimap und den Source-Events. `ui/router.js` gibt den temporären mobilen Viewport-Zustand beim Wechsel der Ansicht frei.
- `workspace/github.js` / `.css`: Ergänzen nur den UI-Vorschlag für `githubCredentialAccount + '/'`; das bestehenden GitHub-Verbindungs- und Synchronisationsschema wird nicht geändert.
- `ui/settings.js`: Setzt den fehlenden `codeFolding`-Wert und den Reset auf `false`. Ein gespeichertes `true` bleibt absichtlich erhalten.
- `index.html`, `module-manifest.json`, `sw.js`: Registrieren die zwei neuen Script-Editor-Assets und aktivieren `mindfagg-v40` als Offline-Cache. Alle vorherigen Dateien aus v39 bleiben erforderlich.

## v39: verlustfreie Codefaltung

- **`core/code-folding.js`:** Scannt HTML/XML/SVG-Tags, JavaScript- und CSS-Blöcke sowie Markdown-Abschnitte und erzeugt ausschließlich für die Anzeige eine Textprojektion mit Fold-Platzhaltern. `doc.content` bleibt die einzige persistente Quelle. `codeFoldUpdateAfterInput()` führt Eingaben auf sichtbaren Quellzeilen auf den vollständigen Text zurück; vor Eingriffen in Platzhalter, Toolbar-Aktionen oder Diagnose-Navigation werden die betroffenen Bereiche aufgeklappt.
- **`css/code-folding.css`:** Positioniert bedienbare Fold-Pfeile im Quelltext-Gutter und erhält ihre Ausrichtung bei Wordwrap, Scrollen, mobilen Viewports und ausgeblendeten Zeilennummern.
- **Editor-Integration:** `markdown/editor.js`/`script/editor.js` initialisieren pro Dokument einen sitzungsgebundenen Faltzustand; `markdown/highlight.js`, `markdown/controls.js`, `markdown/completions.js` und `script/functions.js` respektieren Original-/Anzeigepositionen. `flushSource()` schreibt stets den unveränderten vollständigen Inhalt.
- **Einstellungen:** `ui/settings.js` erweitert den bestehenden `mfEditorPreferencesV28`-Schlüssel um `codeFolding: true`. Keine Datenbankmigration.
- **Ressourcen:** `index.html`, `module-manifest.json` und `sw.js` registrieren beide neuen Dateien für die Offline-PWA und heben den Cache auf `mindfagg-v39`. Alle übrigen Quelldateien aus v38 bleiben erforderlich; das v39-Änderungsarchiv ist ausdrücklich **kein** vollständiger Anwendungsordner.

## Ziel und Umfang

v32 baut auf der v30-Strukturrefaktorierung auf. Der neue Import-/Export-Bereich erweitert die Dateiverwaltung; Datenbank (`mindfagg-db`), Datenformate, Projekt-ZIP-Import/-Export, Editor-Bedienung, Mindmap und die isolierte HTML-Vorschau bleiben erhalten. Die 180 KB große `index.html` aus v29 wurde auf ein knapp 7 KB großes HTML-Grundgerüst reduziert. Das ursprüngliche Inline-JavaScript wurde anhand seiner AST-Deklarationsgrenzen in nach Verantwortlichkeiten benannte Dateien aufgeteilt. CSS-Regeln stehen in getrennten Stylesheets; ihre ursprüngliche Reihenfolge wurde beibehalten.

**Kein Framework, keine Laufzeit-Abhängigkeit zu einem CDN und kein Build-Schritt erforderlich.** `index.html` bindet alle Quelldateien unmittelbar ein.

## Verzeichnisstruktur

```text
mindfagg-v44/
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
│   ├── find-replace.js       Suchen und Ersetzen über vollständigen Quelltext
│   ├── find-replace.css      Toolbar, Floating Panel, Mobil-Viewport
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
7. `script/functions.js`, `script/validators.js`, `script/find-replace.js`, `script/editor.js`, `views/kanban.js`, `views/calendar.js`, `ui/dialogs.js`
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

## v36: Offline-Validatoren und neue UI-Verbindungen

- `script/validators.js` wird **nach** `vendor/acorn.js` und **vor** `script/editor.js` geladen. Das Modul stellt `validateScriptContent()` (ausführbare Syntaxprüfung ohne Codeausführung), `parseJavascriptCode()`, `validateCssCode()`, `validateHtmlCode()` und `detectClipboardCodeLanguage()` bereit. Der Clipboard-Import in `workspace/io.js` verwendet dieselben Validatoren wie der Editor.
- `script/editor.js` positioniert Fehler anhand von `{offset,line,column,length}` im Gutter und in einer separaten, nicht-interaktiven Overlay-Ebene über der Prism-Syntax. Die klickbaren Diagnosemeldungen fokussieren den Original-Textarea-Cursor. Die Prüfung nach einer Eingabe wird um 180 ms verzögert, die Speicherung bleibt getrennt davon.
- `workspace/github.js` erzeugt Repo-Links nur aus den validierten `owner/repo`-Bestandteilen, nicht direkt aus Benutzereingaben. Appweite GitHub-Zugangsdaten bleiben in `ui/settings.js` und IndexedDB (`settings`-Store); der Wechsel der Input-Art verändert weder Kryptografie noch Synchronisationslogik.
- `mindmap/state-layout.js` verwendet einen von der Elterntiefe abhängigen Abstand, ohne das Node-Datenformat, die Pfade oder Drag-and-drop-Operationen zu verändern.
- `sw.js` und `module-manifest.json` führen `script/validators.js` als Offline-Ressource und verwenden v36 als Cache-Version. Keine Datenbankmigration erforderlich.

## v37: Mindmap-Abstände und einheitlicher Knotendialog

- `mindmap/state-layout.js`: `positionMapRows()` bestimmt die vertikalen Abstände über `siblingGap(depth)`. Bei `depth===0` 64 px (24 px mehr Abstand zwischen den Kontext-Teilbäumen); bei `depth===1` 30 px, `depth===2` 18 px, sonst 12 px (jeweils doppelt gegenüber v36). Messung und Positionierung verwenden denselben Wert, damit die Verbindungsgeometrie stimmig bleibt.
- `ui/dialogs.js`: `editNode(path)` unterscheidet nicht mehr nach `view==='kanban'`, sondern stellt stets `nodeStatus` bereit und übernimmt den Wert beim Speichern über `lineEdit()`. Kanban-Karten können so auch ohne Drag & Drop in eine andere Statusspalte wechseln.
- Service Worker und Manifest erhalten v37 als Cache-/Paketversion.

## v38: Optionale Freigabe des Browser-Speichers für HTML-Vorschauen

- `ui/settings.js`: `appEditorSettings.previewStorageAccess=false` wird wie die übrigen appweiten Präferenzen über `mfEditorPreferencesV28` lokal gespeichert. Es gibt eine eigene App-Einstellungen-Sektion mit Schalter und deutlicher Sicherheitswarnung. Der Reset-Button für **Editor**-Einstellungen verändert die Vorschau-Berechtigung nicht.
- `preview/html-preview.js`: Das iframe erhält standardmäßig nur `allow-scripts`; erst nach Opt-in kommt `allow-same-origin` hinzu. `htmlPreviewStorageBlockedError()` erkennt Sandboxing-Fehlermeldungen für Storage-APIs. `htmlPreviewLog()` öffnet die Konsole automatisch, `htmlPreviewRenderLogs()` zeigt den Freigabe-Button, `htmlPreviewGrantStorage()` speichert die Einstellung und ruft `htmlPreviewLoad()` für einen sofortigen Neustart auf.
- `preview/html-preview.css` und `ui/settings.css`: Sicherheitskennzeichnung und Warntext (Desktop/Mobil).
- **Sicherheitsgrenze:** `srcdoc` plus `allow-scripts allow-same-origin` ist für nicht vertrauenswürdiges HTML **keine isolierte Sandbox**. Das Vorschau-Dokument kann den Ursprung der App und das Parent-DOM erreichen, darunter potenziell die unverschlüsselt genutzten GitHub-Zugangsdaten zur Laufzeit. Die Freigabe bleibt deshalb opt-in (Standard aus); sie gilt global für alle Projekte. Es wird **nicht** behauptet, eine separate Storage-Partition bereitzustellen. Beim Deaktivieren ist nur der künftig geladene Frame wieder isoliert; etwaige zuvor gelesene Daten können nicht zurückgerufen werden.
- **Browsergrenzen:** Die Sandbox-Umschaltung ist automatisiert getestet. Die Testumgebung blockiert HTTP-/file-Navigation und erlaubt daher keinen aussagekräftigen End-to-End-Test von nativem `localStorage`/`IndexedDB` auf einem regulären Web-Ursprung. Diese Prüfung steht in `TESTS.md`. Keine Änderung an `mindfagg-db`, Projekt-ZIPs und VFS.
- Service Worker und Manifest nutzen den Cache-/Paketstand v38.
