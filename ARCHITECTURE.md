# mindfagg v23 – Architektur und Modulgrenzen

**Stand:** Aufteilung der korrigierten Version `mindfagg-v23.html`. Die bestehende Anwendung bleibt bewusst bei HTML, CSS und klassischem JavaScript. Es gibt **keinen Build-Schritt** und keine zusätzliche Laufzeitbibliothek.

## 1. Verzeichnisstruktur

```text
mindfagg-modular/
├── index.html       # App-Grundgerüst, gemeinsamer CSS/JS-Kern
├── js/kanban.js        # Kanban-Ansicht, Tierlist und Drag-and-drop
├── css/kanban.css       # Kanban-/Tierlist-Styling
├── js/calendar.js      # Monatskalender, Navigation und Datumseinträge
├── css/calendar.css     # Kalender-Styling, auch mobil
├── js/extras.js        # Dialoge, Projekt-/Dokumentaktionen, ZIP, Knotenformulare
├── ARCHITECTURE.md  # Diese Datei
└── TESTS.md         # Regressions- und Prüfliste
```

**Start:** `index.html` öffnen. **Alle fünf externen Dateien müssen neben der HTML-Datei liegen.** Bei Browsern, die lokale Dateien einschränken, den gesamten Ordner über einen lokalen HTTP-Server bereitstellen. Die HTML-Datei allein ist nicht mehr vollständig lauffähig.

## 2. Zuständigkeiten

| Datei | Enthält | Änderungen hier vornehmen bei … |
| --- | --- | --- |
| `index.html` | HTML-Oberfläche, allgemeines CSS, App-State, IndexedDB, Speichern/Undo/Redo, Markdown-Scanner und -Parser, Editor/Minimap, Mindmap einschließlich Fold, globale Navigation und Initialisierung | Markdown-Syntax, Knotenstruktur, Mindmap, globale Daten und Abläufe |
| `kanban.js` | `kanbanTierlist`, `KANBAN_ALL_SCOPE`, `kanbanVisible()`, `renderKanban()`, `wireKanbanDrag()` | Kanban-Filter, Tickets, Statusspalten, Tierlist, Drag-and-drop |
| `kanban.css` | Regeln für `.kanban`, `.lane`, `.ticket`, `.kb-*`, `.kanban-toolbar`, `.scope`, `.count` einschließlich responsiver Varianten | Aussehen und Mobilverhalten des Kanban-Boards |
| `calendar.js` | Kalenderzustand (`calendarMonth`, `calendarSelectedDay`), Datums-/Anzeigehelfer, `calendarDatedNodes()`, `renderCalendar()`, Navigation | Monatsraster, Agenda, Auswahl, Navigation und Anzeige von Datumsmarkern |
| `calendar.css` | Regeln für `.calendar-*` einschließlich responsiver Varianten | Kalenderlayout und Kalenderdarstellung |
| `extras.js` | Modal- und Formularlogik, Projekt- und Dokumentverwaltung, Status-/Projekt-Einstellungen, Knoten-Dialog, ZIP-Erzeugung/Einlesen/Import/Export | Dialoge, Einstellungen, Import/Export, Knotenformulare |

**Nicht ausgelagert:** `index.html` enthält weiterhin die gemeinsame Markdown-/Mindmap-/Editor-Logik und das allgemeine CSS. Das ist absichtlich **keine vollständige Umstrukturierung**.

## 3. Lade- und Ausführungsreihenfolge

1. `index.html` definiert allgemeine CSS-Regeln; danach werden `kanban.css` und `calendar.css` geladen.
2. Das **erste Inline-Script** in `index.html` definiert App-Kern, globale Zustände, Markdown, Mindmap und Editor.
3. Anschließend laden die klassischen Scripts in dieser Reihenfolge: `kanban.js`, `calendar.js`, `extras.js`.
4. Das **letzte Inline-Script** in `index.html` verbindet die globalen UI-Buttons und führt `init()` aus.

Alle JavaScript-Dateien sind **klassische Scripts ohne `type="module"`**. Funktionen und deklarierte globale Bindungen werden daher zwischen diesen Scripts geteilt. Die externen Dateien dürfen nicht ungeprüft mit `defer`, `async`, `type="module"` oder in anderer Reihenfolge eingebunden werden. Bei späterer Einführung echter ES-Module müssen Importe/Exporte und die Initialisierung explizit umgebaut werden.

Das CSS wurde aus den vorhandenen Selektoren herausgelöst. Allgemeine Regeln bleiben in `index.html`; ansichtsbezogene Regeln stehen in den CSS-Dateien. Die Stylesheet-Reihenfolge ist bei Änderungen mit zu prüfen (CSS-Kaskade).

## 4. Wichtige Schnittstellen und Abhängigkeiten

```text
index.html (gemeinsamer Zustand / Daten / Parser / Mindmap / Editor)
    ├── render() -> renderKanban()         [kanban.js]
    ├── render() -> renderCalendar()       [calendar.js]
    ├── Modale/Knotenaktionen -> extras.js
    ├── kanban.js -> aktueller Knotenbaum, Status, patchNode(), editNode()
    ├── calendar.js -> aktueller Knotenbaum, nodeDateEnd(), editNode()
    └── extras.js -> Datenhaltung, Parser, put(), render(), History
```

- **Eine Datenquelle:** Markdown (`docs[].content`) ist das verbindliche Dokumentformat. `parseMarkdown()` erzeugt daraus `currentModel` und Pfade wie `0.0.1`.
- **Zentraler Render-Einstieg:** `render()` wählt Editor, Mindmap, Kanban oder Kalender. Die beiden ausgelagerten Ansichten werden nur darüber bzw. durch ihre eigenen UI-Handler aktualisiert.
- **Knoten-Änderungen:** Kanban-Statusänderungen und Knotenformulare müssen über die bestehenden zentralen Bearbeitungs-/Speicherfunktionen laufen, nicht über eine zweite Kopie des Dokumentzustands.
- **Status:** `STATUS`, `statusLabel()` und `statusColor()` bleiben im Kern. Kanban nutzt die projektbezogenen Bezeichnungen und Farben.
- **Datum:** `parseNodeDatePayload()`, `nodeDatePrefix()`, `serializeNodeDate()` und `nodeDateEnd()` bleiben im Kern, weil sie auch der Markdown-Editor und die Knotenformulare verwenden. `calendar.js` ist ausschließlich für die Kalenderansicht zuständig.
- **Mindmap-Fold:** `mapCollapsedPaths`, `mapCollapsed()`, `toggleMapChildren()` und `setAllMapChildrenCollapsed()` bleiben in `index.html`, weil sie Teil der Mindmap sind. Die zuvor behobene `finishMapInlineEdit()`-Rückgabe ist erhalten.
- **Knoten-Dialog:** `editNode()` liegt in `extras.js` und wird von Mindmap, Kanban und Kalender aufgerufen. Änderungen an Formulareingaben müssen daher über alle drei Ansichten getestet werden.
- **Initialisierung:** Die Event-Registrierung und `init()` befinden sich weiterhin ganz am Ende der HTML-Datei, nachdem alle externen Scripts geladen wurden.

## 5. Persistenz und Datensicherheit

- **IndexedDB:** Datenbank `mindfagg-db`, Version `1`, Stores `projects` und `docs`. Sie wird im gemeinsamen Kern geöffnet.
- **LocalStorage:** `msProject` (gewähltes Projekt), `mfLastView` (letzte Ansicht) und `mfKanbanLayout` (Board/Tierlist).
- **Fold-Zustand:** pro Dokument in `mapCollapsedPaths` und während der Sitzung in `mapCollapsedPaths`-Map im gemeinsamen Kern.
- **ZIP:** Export und Import liegen in `extras.js`; die bisherigen Projektdaten und Markdown-Dateien werden weiter über die vorhandene ZIP-Struktur übertragen.

**Vor dem Wechsel zur modularen Variante ein ZIP-Backup der Projekte mit der alten Version erstellen.** Wird die Anwendung unter einem neuen Datei-Pfad oder über `http://localhost` statt `file://` geöffnet, können Browser die Anwendung einem anderen Speicher-Ursprung zuordnen. In diesem Fall sind die alten IndexedDB-Daten nicht automatisch sichtbar; sie müssen über ZIP wieder importiert werden. Die Originaldatei und die alten Browserdaten deshalb zunächst behalten.

## 6. Arbeiten an Teilmodulen im Chat

Für gezielte Änderungen genügen normalerweise folgende Dateien:

| Aufgabe | Zuerst bereitstellen |
| --- | --- |
| Kanban-Logik | `kanban.js` + `ARCHITECTURE.md` |
| Kanban-Darstellung | `kanban.css` (+ `kanban.js`, falls Verhalten betroffen) |
| Kalender-Logik | `calendar.js` + `ARCHITECTURE.md` |
| Kalender-Darstellung | `calendar.css` |
| Dialoge/Import/Export | `extras.js` + `ARCHITECTURE.md` |
| Mindmap, Fold, Parser, Undo/Redo | `index.html` + `ARCHITECTURE.md` |

Werden **globale Variablen, Funktionssignaturen, Markdown-Knotenpfade, Datenformate oder die Initialisierung** verändert, zusätzlich die abhängigen Module prüfen. Änderungen sollten zuerst in den Quelldateien erfolgen und anschließend mit `TESTS.md` gegen alle Ansichten geprüft werden.
