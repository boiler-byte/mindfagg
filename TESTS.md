# mindfagg v23 – Test- und Regressionscheckliste

**Bezug:** Modularisierte Version mit `index.html`, `kanban.js`, `kanban.css`, `calendar.js`, `calendar.css` und `extras.js`.

## 1. Vor dem Test

1. Alle Dateien im **selben Ordner** ablegen. `index.html` darf nicht ohne die fünf Dateien weitergegeben werden.
2. Vor dem Umstieg aus der bisherigen Anwendung **alle Projekte als ZIP exportieren**. Bei geändertem Datei-Pfad oder Browser-Ursprung den Import testen, bevor alte Daten gelöscht werden.
3. Die Browser-Konsole öffnen. Es dürfen keine Fehler beim Laden der drei JS- und zwei CSS-Dateien auftreten.
4. Tests mit einem Projekt durchführen, das Überschriften, verschachtelte Listen, Checkboxes, mehrere Status und gültige `[date:...]`-Marker enthält.

## 2. Smoke-Test: Anwendung und Ansichten

- [ ] `index.html` öffnet ohne JavaScript-Laufzeitfehler; ein Projekt und Dokument lassen sich auswählen.
- [ ] Zwischen **Markdown**, **Mindmap**, **Kanban** und **Kalender** wechseln; jede Ansicht wird korrekt angezeigt.
- [ ] Projekte und Dokumente lassen sich anlegen, umbenennen und wechseln.
- [ ] Änderungen führen zur passenden Speicheranzeige; nach Neuladen sind sie noch vorhanden.
- [ ] Undo/Redo funktioniert nach Knotenbearbeitung und Dokumentänderungen.
- [ ] Desktop (z. B. 1280 px Breite) und Smartphone (z. B. 390 px Breite) auf Darstellungsfehler prüfen.

## 3. Mindmap und Fold (Regression des behobenen Fehlers)

- [ ] Fold-Button eines Knotens mit Kindern: **einklappen**, die Unterknoten verschwinden.
- [ ] Denselben Button erneut betätigen: **ausklappen**, Unterknoten erscheinen wieder.
- [ ] **Alle einklappen** (−): nur der Root ist sichtbar.
- [ ] **Alle ausklappen** (+): die vollständige Struktur erscheint.
- [ ] Fold-Zustand bleibt bei einem Wechsel zu Kanban/Markdown und zurück erhalten.
- [ ] Fold-Zustand bleibt nach Speichern und Neuladen erhalten.
- [ ] Fold nach der Inline-Titelbearbeitung; Änderungen am Titel werden nicht verworfen.
- [ ] Auswahl, Verschieben, Zoom, Pan und Knotenerstellung weiter funktionsfähig.

## 4. Kanban und Tierlist (`kanban.js`, `kanban.css`)

- [ ] Die fünf Statusspalten erscheinen mit den projektbezogenen Statusnamen und -farben.
- [ ] Scope-Auswahl zwischen direktem Unterbaum und **Allen Knoten** funktioniert.
- [ ] Wechsel **Board ↔ Tierlist** funktioniert; beim Neuladen wird die Präferenz wiederhergestellt.
- [ ] Ein Ticket öffnen: Knoten-Dialog erscheint und Änderungen werden gespeichert.
- [ ] Ticket lang drücken, in andere Statusspalte ziehen: Status/Markdown aktualisiert sich.
- [ ] Unterknoten-Navigation und Fortschrittsanzeige bleiben korrekt.
- [ ] Board und Tierlist auch auf schmalen Bildschirmen auf Scrollbarkeit prüfen.

## 5. Kalender (`calendar.js`, `calendar.css`)

- [ ] Monatsansicht zeigt den aktuellen Monat und korrekt angeordnete Wochentage.
- [ ] Vorheriger/nächster Monat und **Heute** funktionieren.
- [ ] Knoten mit gültigem `[date:YYYY-MM-DD]` erscheinen am Datum.
- [ ] Knoten mit Dauer (z. B. `[date:2026-10-30 +1m +2d]`) erscheinen über den Zeitraum.
- [ ] Datum auswählen: passende Einträge werden in der Agenda angezeigt.
- [ ] Kalendereintrag öffnen: Knoten-Dialog erscheint.
- [ ] Ohne datierte Knoten erscheint der entsprechende Leerzustand.
- [ ] Auf dem Smartphone sind Datumsauswahl, Markierungen und Agenda nutzbar.

## 6. Extras (`extras.js`)

- [ ] Projekt-Einstellungen: Projektname, Akzentfarbe und Statusbezeichnungen lassen sich bearbeiten.
- [ ] Projekt/Document erstellen, umbenennen und löschen; anschließend Undo/Redo prüfen.
- [ ] Knoten-Dialog: Titel, Typ (Überschrift/Liste), Status, Checkbox, Beschreibung und Datum bearbeiten.
- [ ] Projekt als ZIP exportieren; ZIP enthält Projektmetadaten und Markdown-Dokumente.
- [ ] ZIP erneut importieren; Inhalt, Projekteinstellungen und Fold-Zustände prüfen.
- [ ] Abbrechen/Schließen eines Dialogs verändert keine Daten.

## 7. Markdown-Editor und gemeinsame Logik

- [ ] Syntaxhervorhebung, Zeilennummern, Minimap und Autocomplete funktionieren.
- [ ] Änderungen im Editor erscheinen nach Ansichtswechsel in Mindmap, Kanban und Kalender.
- [ ] Checkbox-, Status- und Datumsmarker werden korrekt interpretiert.
- [ ] Dokumente mit fehlender oder mehrfacher H1 zeigen weiter die Validierung statt einer fehlerhaften Mindmap.
- [ ] Nach Änderungen im Parser mindestens einen Kanban- und einen Kalender-Test erneut durchführen.

## 8. Durchgeführte Prüfungen bei dieser Aufteilung

| Prüfung | Ergebnis |
| --- | --- |
| JavaScript-Syntaxprüfung für `kanban.js`, `calendar.js`, `extras.js` sowie beide Inline-Scripts | **Bestanden** (`node --check`) |
| CSS-Parsing der getrennten Stylesheets | **Bestanden** (PostCSS-Parser) |
| Browser-Smoke-Test mit vergleichbarem Testdokument: Einzel-Fold, Gesamt-Fold, Kanban, Tierlist, Kalendernavigation, Projekt-Einstellungen, Markdown-Editor | **Bestanden** |
| Vergleiche von Verhalten und ausgewählten berechneten CSS-Werten mit der korrigierten HTML-Ausgangsversion | **Identisch** |
| Visueller Browser-Vergleich (4 Ansichten, Desktop 1280 × 800 und Mobil 390 × 844) | **8 von 8 Ansichten pixelgleich** |

**Einschränkung:** In der automatisierten Browserumgebung waren externe Navigationen (`file://` und lokaler HTTP-Server) sowie IndexedDB nicht freigegeben. Für die Browser-Smoke- und Bildtests wurden die fünf Dateien deshalb **nur für den Test temporär in die HTML-Struktur eingebettet**; die eigentlichen Quelldateien bleiben getrennt. Die automatischen Tests verwendeten Testdaten und einen simulierten Speicheraufruf. **Das echte Laden der externen Dateien, IndexedDB-Persistenz über Browser-Neustarts, ZIP-Import/-Export mit echten Benutzerdaten sowie vollständiges Drag-and-drop** müssen daher in einem regulären Browser anhand der obigen Checkliste bestätigt werden.
