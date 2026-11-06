# mindfagg v49

Delta-Update fuer eine vollstaendige v48-Installation. Das ZIP enthaelt ausschliesslich neue oder geaenderte Dateien, keine vollstaendige Anwendung.

## Neu in v49

- **Sidebar:** Unter der Repository-Zeile steht **Teilen** links und **Patch-Tool** rechts. Beide behalten ihre bisherigen Funktionen und Labels.
- **Patch-Ablehnung:** Wenn die JSON-Pruefung einen Fehler meldet (`Patch abgelehnt: ...`), ist die gesamte Fehlermeldung als Button anklickbar. Ein Klick oder Enter/Leertaste kopiert den vollstaendigen Text mit dem bestehenden Clipboard-Fallback. Ein Toast bestaetigt Erfolg oder Fehlschlag; die Fehlermeldung bleibt sichtbar.
- **Patch-Phrase:** Die JSON-Escape-Beispiele nennen nun ausdruecklich die Schreibweisen `\"` (Anfuehrungszeichen), `\\` (Backslash) und `\n` (Zeilenumbruch). Der gemeinsame `PATCH_TOOL_PROMPT` wird sowohl im Patch-Tool als auch ueber **Patch-Phrase kopieren** im Teilen-Dialog verwendet.
- **Offline-PWA:** Cache-Name und Modulmanifest auf `v49` angepasst. Keine Datenmigration oder zusaetzlichen Produktivmodule.

**Installation:** `mindfagg-v49.zip` in das vorhandene v48-App-Verzeichnis entpacken und Dateien ersetzen; die Verzeichnisstruktur beibehalten.

**Tests:** `node tests/check-structure.mjs`, `python tests/v49-browser.py` und die vorhandenen Patch-, Sidebar- und Editor-Regressionstests.

---

# mindfagg v48

Delta-Update fuer die vollstaendige Installation **mindfagg v47**. Das ZIP enthaelt ausschliesslich neue oder geaenderte Dateien; unveraenderte Module bleiben aus v47 bestehen.

## Neu in v48: Sidebar-Aktionen und einheitliche Dateimenue-Icons

- **Dateiliste:** **Patch-Tool** und **Teilen** stehen dauerhaft als zwei nebeneinander liegende Schaltflaechen unter der GitHub-/Repository-Zeile. Die beiden Eintraege wurden aus den `+`- bzw. `Download`-Dropdowns entfernt, damit die Aktionen an einer Stelle liegen. Beide verwenden weiterhin dieselben Dialoge und Speicher-/Editor-Flush-Funktionen. Ohne aktives Projekt sind sie deaktiviert.
- **Repository:** Der GitHub-Button wird nur angezeigt, wenn ein gepruefter Access Token im App-Speicher verfuegbar ist. Das gilt nach dem Laden, beim Speichern und beim Entfernen des Tokens. Die Repository-Zuordnung bleibt weiterhin projektbezogen; der Zugang kann jederzeit in den App-Einstellungen angelegt werden.
- **Download-Menue:** Das `⋯`-Menue besitzt jetzt den Tooltip **Download**. **ZIP herunterladen** und **ZIP importieren** verwenden ein Ordner-mit-Reissverschluss-Icon, **Aktuelle Datei herunterladen** ein Datei-Icon. Sein Untertext ist der echte Dateiname, einschliesslich Erweiterung (z. B. `index.html`); der bisherige Untertext **Originalformat** entfaellt. Der Dateiname wird bei jedem Oeffnen des Menues frisch ermittelt und HTML-sicher dargestellt.
- **Hinzufuegen-Menue:** **Neue Datei** verwendet ein Dokument-Icon, **Neuer Ordner** ein Ordner-Icon und **ZIP importieren** das ZIP-Ordner-Icon.
- **Offline-PWA:** Der Cache-Schluessel wechselt zu `mindfagg-v48`; Dateiformat und IndexedDB bleiben unveraendert.

**Installation:** Vorher Workspace sichern und `mindfagg-v48.zip` ueber die vorhandene vollstaendige v47-Installation entpacken; Verzeichnisstruktur beibehalten. Nicht eigenstaendig startbar.

**Tests:** `node tests/check-structure.mjs`, `python tests/v48-browser.py` und die bisherigen Regressionstests. Fuer native Berechtigungen sowie PWA-Cache-Wechsel auf dem Zielgeraet nochmals pruefen.

---

# mindfagg v47

Delta-Update fuer die vollstaendige Installation **mindfagg v46**. Das ZIP enthaelt nur neue und geaenderte Dateien und ist **nicht eigenstaendig lauffaehig**.

## Neu in v47: Dateien teilen und Browser-Zurueck-Navigation

### Dateien teilen

- **Globales Alle waehlen:** Eine Checkbox oberhalb der Dateiliste waehlt alle Projektdateien an oder ab. Sie ist bei einer teilweise getroffenen Auswahl im Zwischenzustand (indeterminate) und bei einem leeren Workspace deaktiviert. Die bisherigen Verzeichnis-Checkboxen und Einzeldatei-Checkboxen bleiben erhalten und synchronisieren sich gegenseitig.
- **Dateigroesse je Datei:** Rechts neben jedem Dateinamen steht die exportierte Dateigroesse in B/KB/MB/GB. Gezaehlt werden die tatsaechlichen exportierten Bytes, bei Text UTF-8 (bzw. unveraenderte Originalbytes) und bei binaeren Dateien die Binaerdaten, nicht die Groesse des komprimierten ZIPs.
- **Summe unter der Liste:** Anzahl der ausgewaehlten Dateien ("X von Y gewaehlt") und ihre addierte Dateigroesse ("Gesamtgroesse: ...") werden nach jeder Aenderung sofort aktualisiert. Ohne Auswahl bleibt der Teilen-Button gesperrt.
- **Patch-Phrase kopieren:** Neuer Button links von **Abbrechen** im Teilen-Dialog. Er kopiert exakt `PATCH_TOOL_PROMPT`, dieselbe KI-Phrase wie im Patch-Tool. Zuerst wird die Clipboard-API genutzt, bei Bedarf die vorhandene lokale Kopiermethode. Der Dialog bleibt dabei geoeffnet.
- **ZIP/Einzeldateien:** Unveraendert: geteilt werden nur markierte Dateien, Verzeichnisse bleiben im ZIP erhalten; mehrere Einzeldateien werden per System-Teilen oder Download-Fallback verarbeitet.

### Browser-Zurueck / History Back

- Beim Start wird eine zusaetzliche gleichseitige Browser-History-Position angelegt. Dadurch fuehrt ein Druck auf die Browser-/Geraete-Zurueck-Taste innerhalb der App nicht zur vorherigen Webseite.
- **Bei geoeffnetem Dialog** wird dieser zuerst geschlossen. Ein waehrend der GitHub-Synchronisation gesperrter Dialog bleibt gemaess der bisherigen Sicherheitslogik offen.
- **Ohne Dialog** schaltet jeder weitere Zurueck-Druck die Sidebar um: auf schmalen Bildschirmen oeffnen/schliessen, auf breiten Bildschirmen ausblenden/einblenden. Das bestehende Menue-Symbol und dessen Bedienung bleiben erhalten.
- Die History-Position wird nach jedem Zurueck-Ereignis erneut aktiviert. Es werden keine Projektdateien oder Navigationseintraege gespeichert; die Funktion benoetigt keine Migration.

**Installation:** Vorher Workspace sichern. Das Delta-ZIP `mindfagg-v47.zip` im **bestehenden v46-App-Verzeichnis** entpacken, Dateien ersetzen und die Verzeichnisstruktur beibehalten. Offline-Cache ist `mindfagg-v47` (alte Cache-Version wird beim Aktivieren des neuen Service Workers abgeloest).

**Pruefen:** `node tests/check-structure.mjs`, `python tests/v47-browser.py`, `python tests/v46-browser.py` und die bisherigen Regressionstests. Der Browser-Test nutzt eingebettete Produktionsmodule und simulierte Dateifreigabe; native Geraete-Zurueck-Tasten, Clipboard-Berechtigungen und PWA-Service-Worker-Aktivierung sollten zusaetzlich auf dem Zielgeraet geprueft werden.

---

# mindfagg v46

Delta-Update fuer eine vorhandene **vollstaendige mindfagg v45**. Die Archivdatei enthaelt **nur neue oder veraenderte Dateien**; sie ist nicht eigenstaendig lauffaehig.

## Neu in v46: Einklappbare Patchvorschau und selektives Teilen

### Patch-Tool

- Der separate Button **Patch pruefen** entfällt. Sobald die JSON-Eingabe bearbeitet wird, erscheint der **rote, klickbare Hinweis** **„Patch prüfen, um die Vorschau zu aktualisieren.“**. Ein Klick darauf validiert den Inhalt und erzeugt die Vorschau neu. Der Hinweis ist als Button auch mit der Tastatur bedienbar.
- Jeder `.patch-preview-file`-Block ist nun ein nativ aufklappbares `<details>`-Element. Alle Dateibloecke sind **nach dem Einlesen standardmaessig eingeklappt**. Ein Klick auf die Ueberschrift oeffnet/schliesst die einzelnen Hunks und Operationen.
- In jeder Dateikopfzeile stehen Dateipfad, optional Beschreibung und Zielpfad, **`operation: update/create/replace/delete/rename`** sowie **`patch / found / total`**. `patch` ist die Anzahl ausgewaehlter Schritte/Hunks, `found` die Anzahl anwendbarer Treffer bei Simulation des **vollstaendigen** Patches und `total` die Anzahl der im JSON erwarteten Schritte/Hunks. Daher bleibt `found` bei manueller Abwahl gleich, waehrend `patch` sinkt.
- Die ausgeklappten Bereiche bleiben bei Checkbox-Aenderungen offen. Das Laden eines anderen Patches setzt die Vorschau wieder in den eingeklappten Ausgangszustand. Formatvalidierung, atomare Anwendung, Patch-Speicherung sowie Undo/Redo aus v45 bleiben erhalten.

### Dateien teilen

- Im `⋯`-Dropdown heisst **ZIP teilen** jetzt **Teilen** und hat ein Share-Icon. Der Eintrag oeffnet einen neuen Dialog statt sofort den bisherigen ZIP-Versand zu starten.
- Versandauswahl: **Als ZIP** (standardmaessig) oder **Als Einzeldateien** (mehrere separate Dateianhaenge in einer System-Teilen-Aktion).
- Darunter werden **alle Projektdateien nach ihrem direkten Verzeichnis gruppiert**. Die erste Gruppe lautet **root (Wurzel)** (auch falls dort keine Datei liegt), danach folgen die Unterverzeichnisse mit ihren relativen Pfaden. Jede Gruppe bietet **Alle wählen** und jede Datei eine eigene Checkbox. Ein teilweise ausgewaehltes Verzeichnis zeigt einen Zwischenzustand; ohne Dateiauswahl ist **Teilen** deaktiviert.
- Im ZIP befinden sich **nur die ausgewaehlten Dateien**, ihre notwendigen Elternordner und die passende `mindfagg-workspace.json`-Metadaten-Datei, damit das ZIP weiterhin importierbar bleibt. Der normale Befehl **ZIP herunterladen** exportiert unveraendert das gesamte Projekt inklusive leerer Ordner.
- Beim Einzelversand bleiben Dateiinhalte originalgetreu. Da die Web-Share-API keine Ordnerstruktur in Dateianhaengen bereitstellt, erhalten **gleichnamige Dateien aus unterschiedlichen Ordnern** unterschiedliche Dateinamen mit einem Pfadpraefix (z. B. `src__app.js`). Ist systemweites Datei-Teilen nicht verfuegbar, werden die ausgewaehlten Dateien als Downloads angeboten; der Browser kann mehrere Downloads gesondert bestaetigen oder blockieren.

**Installation:** Workspace vorher sichern. `mindfagg-v46.zip` **ueber die vorhandene v45-Installation entpacken**, vorhandene Dateien ersetzen und `workspace/`, `tests/` als Unterordner beibehalten. Service-Worker-Cache: `mindfagg-v46`.

**Tests:** `node tests/check-structure.mjs`, `node tests/v44-patch.mjs`, `node tests/v45-patch.mjs`, `python tests/v46-browser.py`, aktualisierte `v44-browser.py` und `v45-browser.py` sowie bisherige Regressionstests. Browser-Tests arbeiten mit temporaer eingebetteten Produktionsskripten; natives Teilen und Langzeit-PWA-Persistenz sind zusaetzlich auf echten Geraeten zu testen.

---

## Versionshistorie: v45


Delta-Update fuer eine bereits installierte **vollstaendige mindfagg v44**. Das ZIP enthaelt **nur neue und geaenderte Dateien** und ist alleine nicht lauffaehig.

## Neu in v45: Erweiterte Patch-Operationen und Patch speichern

- **Patch speichern:** Option (Checkbox) links von **Ausgewaehlte Vorgaenge einspielen**. Ist sie aktiviert, legt das Patch-Tool nach erfolgreichem Einspielen im **Projekt-Root** eine Datei namens `YYYY-MM-DD-HHmmss.patch.json` ab (Beispiel: `2026-11-06-213105.patch.json`). Bei einer Kollision innerhalb derselben Sekunde wird der naechste freie Sekundenname gewaehlt; bestehende Dateien werden niemals ueberschrieben.
- **Gespeicherter Inhalt:** Die Datei enthaelt ausschliesslich die **tatsaechlich ausgewaehlten und eingespielten Operationen**, in Originalreihenfolge. Bei `update` werden abgewaehlte Hunks nicht mitgespeichert. Die .patch.json-Datei und alle Datei-/Ordneraenderungen werden als **eine einzige atomare Undo-/Redo-Aktion** gespeichert. Mit einem Undo verschwindet auch die neue Patch-Datei, mit Redo erscheint sie wieder.
- **Format:** Das Wurzelobjekt enthaelt `patches` als nichtleere Liste. Pro Patchblock sind `operation` und `file` erforderlich; `description` ist optional. Andere Felder als die unten beschriebenen werden zurueckgewiesen.

| `operation` | Wirkung | Weitere Pflichtfelder |
| --- | --- | --- |
| `create` | Neue Textdatei anlegen (inkl. erforderlicher Unterordner) | `content` (String, auch leer) |
| `update` | In einer vorhandenen Textdatei wortgetreu suchen und ersetzen | `hunks`: nichtleere Liste mit `search` (nichtleer), `replace` (String), `occurrence` (positive 1-basierte Ganzzahl) |
| `replace` | Gesamten Inhalt einer vorhandenen Textdatei ersetzen | `content` (String, auch leer) |
| `delete` | Vorhandene Datei entfernen (auch binaer) | keine |
| `rename` | Vorhandene Datei umbenennen oder verschieben (auch binaer) | `to` (neuer projekt-relativer Pfad) |

Beispiel:

```json
{
  "patches": [
    {"operation": "update", "file": "index.html", "description": "Titel", "hunks": [{"search": "<h1>Alt</h1>", "replace": "<h1>Neu</h1>", "occurrence": 1}]},
    {"operation": "create", "file": "src/hello.js", "content": "const name = 'Welt';"},
    {"operation": "replace", "file": "src/app.js", "content": "console.log('neu');"},
    {"operation": "rename", "file": "src/old-name.js", "to": "src/new-name.js"},
    {"operation": "delete", "file": "src/unused.js"}
  ]
}
```

Alle **ausgewaehlten** Vorgaenge werden der Reihe nach auf einen virtuellen Dateistand angewendet. Die Vorschau meldet fehlende Dateien, Trefferfehler, Kollisionen mit Dateien/Ordnern, unsichere Pfade und nicht editierbare Binaerdateien. Wenn irgendein ausgewaehlter Vorgang nicht passt, wird nichts geschrieben. Ein einzelner `update`-Hunk laesst sich weiterhin abwaehlen; andere Operationen koennen als Ganzes abgewaehlt werden. Das bisherige v44-Format ohne `operation` wird als `update` unter Beibehaltung seines bisherigen Pflichtfelds `description` akzeptiert.

Die kopierbare **KI-Prompt-Phrase** ist fuer alle fuenf Operationen angepasst. Keine automatische KI-Ausfuehrung und keine Ausfuehrung von Patch-Inhalten als Programmcode.

**Installation:** Vorher ein Workspace-ZIP sichern, dann den Inhalt von `mindfagg-v45.zip` im **bestehenden v44-App-Ordner** entpacken und vorhandene Dateien ersetzen. `workspace/` und `tests/` als Unterordner beibehalten. Der Offline-Service-Worker verwendet nun den Cache `mindfagg-v45`. Die Anwendung benoetigt weiterhin alle unveraenderten Dateien aus v44.

**Tests:** `node tests/check-structure.mjs`, `node tests/v44-patch.mjs`, `node tests/v45-patch.mjs`, `python tests/v44-browser.py`, `python tests/v45-browser.py` und die bereits bestehenden Regressionstests. Browser-Tests verwenden in der isolierten Testumgebung einen simulierten IndexedDB-Transaktionsspeicher; echte Persistenz und Service-Worker-Aktualisierung unter HTTPS/localhost zusaetzlich pruefen.

---

## Versionshistorie: v44

Offline-Patch fuer die bestehende vollstaendige mindfagg-v43-Installation. **Das v44-ZIP enthaelt ausschließlich neue und geaenderte Dateien** und wird ueber die bestehende v43-Ordnerstruktur entpackt; alleine ist das ZIP nicht startfaehig.

## Neu in v44: Patch-Tool und Collapse-Symbol

- **Sidebar:** Das Symbol von **Alle Ordner einklappen** zeigt jetzt ein Minus innerhalb eines gestrichelten Rahmens. Die bisherige Sichtbarkeits- und Speicherlogik bleibt erhalten.
- **Datei-/Ordner-Dropdown (+):** Zusaetzlicher Eintrag **Patch-Tool**. Der Dialog ist in **Einspielen** und **Erstellen** gegliedert.
- **Patch-Import:** JSON in das Eingabefeld einfuegen oder mit **Aus Zwischenablage einfuegen** lesen, eine `.json`-Datei auswaehlen, eine `.json`-Datei auf die Drop-Zone ziehen oder eine bestehende `.patch.json`-Datei aus dem Projekt laden. Diese Wege verwenden dieselbe Formatpruefung.
- **Patch-Format:** Nur `{"patches":[{"file":"index.html","description":"...","hunks":[{"search":"alter Text","replace":"neuer Text","occurrence":1}]}]}`. Alle Felder muessen vorhanden sein; keine fremden Felder, regulare Ausdruecke oder ausfuehrbarer Patch-Code. `search` ist ein nichtleerer, wortgetreuer Text. `occurrence` ist 1-basiert; Treffer werden nicht ueberlappend gezaehlt. Mehrere Hunks werden nacheinander auf die jeweils aktualisierte Datei angewendet. `replace` darf leer sein. Nur bereits vorhandene, textbasierte Projektdateien werden geaendert.
- **Vorschau:** Zeigt jede Datei mit Beschreibung sowie jeden einzelnen Such-/Ersetzungsvorgang mit Checkbox, Trefferpruefung und den Quelltext-Ausschnitten. Alle Vorgaenge sind anfangs ausgewaehlt. Fehlende Dateien bzw. Suchtexte blockieren das Einspielen, bis die betroffenen Vorgaenge korrigiert oder abgewaehlt sind. Vor dem Schreiben wird die aktuelle Projektversion nochmals ueberprueft.
- **Einspielen / Undo:** Alle ausgewaehlten Ersetzungen werden **atomar** in einer Workspace-Transaktion gespeichert; ein einziges Rueckgaengig stellt alle betroffenen Dateien wieder her. Die vorherige Datei-/Ordnerstruktur bleibt unangetastet. Keine neuen Datenbanktabellen, keine Formatmigration.
- **Erstellen:** Kopierbare Prompt-Erweiterung zur Erzeugung eines exakt passenden JSON-Patches durch eine KI. Fuer sichere exakte Suchtexte muessen der KI die betroffenen Originaldateien bereitgestellt werden. Es gibt keinen direkten KI-Aufruf.
- **Offline-PWA:** Cache-Version `mindfagg-v44`, neue Module `workspace/patch-tool.js` und `workspace/patch-tool.css`.

**Installation:** Vorher den Workspace als ZIP sichern. Das v44-Update in denselben Ordner bzw. unter demselben HTTPS-/localhost-Ursprung wie v43 einspielen, wobei vorhandene Dateien ueberschrieben und neue Module unter `workspace/` hinzugefuegt werden. Ohne die unveraenderten v43-Dateien ist v44 nicht vollstaendig.

**Tests:** `node tests/check-structure.mjs`, `node tests/v44-patch.mjs`, `python tests/v44-browser.py` und bisherige Regressionen. Der Browser-Test verwendet temporaer inline eingebettete Module, einen simulierten lokalen Transaktionsspeicher sowie simulierte Clipboard-Berechtigungen. Einen echten PWA-Cache-Wechsel sowie Clipboard-Rechte und Langzeit-Persistenz unter HTTPS/localhost zusaetzlich manuell pruefen.

---

## Versionshistorie: v43

Offline-fähiger Workspace mit Markdown, Mindmap, Kanban, Kalender, Scripteditor und GitHub-Synchronisation.

## Neu in v43: Editor, Dialoge, Sidebar und Ordnerverwaltung

- **Rote Zeilen in der Script-Minimap:** Syntaxfehler aus der integrierten HTML/CSS/JavaScript-Prüfung werden auf denselben sichtbaren Zeilen wie im Editor rot markiert, auch in Codefaltungen. Nach einer Korrektur verschwinden die roten Minimap-Zeilen bei der nächsten Prüfung.
- **Dialoge:** Ein Dialog wird nur durch einen echten Klick auf den Hintergrund (Drücken **und** Loslassen außerhalb) oder durch seine vorhandenen Schließen-/Abbrechen-Aktionen geschlossen. Das Ziehen einer Markierung aus einem Input heraus schließt ihn nicht mehr versehentlich.
- **Sidebar:** Neuer **Alle Ordner einklappen**-Button vor **+** und **⋯**. Er erscheint nur, wenn ein sichtbarer Ordner aufgeklappt ist. Eingeklappte Ordner werden für jedes Projekt getrennt in `localStorage` gespeichert und beim Wiederöffnen wiederhergestellt. Ein explizit ausgewählter Ordner kann weiterhin seine Vorfahren öffnen.
- **Ordner verwalten:** In einem leeren Ordner steht **Leeren Ordner löschen**. Für Ordner mit Dateien oder Unterordnern steht **Ordner löschen** mit Sicherheitsabfrage zur Verfügung. Dateien und Unterordner werden gemeinsam in einer atomaren Workspace-Transaktion gelöscht; **Rückgängig** kann die Löschung innerhalb der Sitzung wiederherstellen.
- **Script-Editor-Toolbar:** Neues Dropdown **Einfügen ▾** mit **Einfügen** (Clipboard-Text an der Cursorposition bzw. über markierten Text) und **Ersetzen** (vollständiger Quelltext). Beide verwenden die bestehende Bearbeitungs-, Undo-/Redo-, Syntaxprüfungs- und Autosave-Pipeline. Benötigt im Browser Clipboard-Leseberechtigung und einen sicheren Ursprung (HTTPS oder localhost); bei fehlender Berechtigung bleibt der Inhalt unverändert.
- **Offline-PWA:** Neuer Cache-Schlüssel `mindfagg-v43`. Keine IndexedDB- oder ZIP-Formatmigration.

**Installation:** `mindfagg-v43.zip` enthält die vollständige App. Über dieselbe HTTPS-/localhost-Adresse wie bisher installieren, um vorhandene IndexedDB-Projekte zu behalten. Vor dem Update ein Workspace-ZIP sichern.

**Prüfen:** `node tests/check-structure.mjs`, `python tests/v43-browser.py`, `python tests/v42-browser.py`, `python tests/v41-browser.py`, `python tests/v40-browser.py` sowie die übrigen Regressionen. Browserprüfungen arbeiten mit isoliertem Testspeicher und simuliertem Clipboard; Berechtigungen und Service-Worker-Aktualisierung sind im echten HTTPS-/localhost-Browser zu prüfen.

---

# Versionshistorie: v42

Offline-fähiger Workspace mit Markdown, Mindmap, Kanban, Kalender, Scripteditor und GitHub-Synchronisation.

## Neu in v42: native Repository- und Dateinamen-Datalists

- **GitHub-Repository zuordnen:** Das Repository-Eingabefeld verwendet jetzt eine native HTML-`datalist` statt eines eigenen Dropdowns. Die Vorschläge kommen weiterhin ausschließlich aus den vom hinterlegten GitHub-Token erreichbaren Repositories (bis zu zehn API-Seiten mit je 100 Einträgen). Die Browser-Datalist filtert bei der Eingabe; `owner/repo` bleibt auch dann frei editierbar, wenn der API-Abruf fehlschlägt. Der Repository-Link wird weiterhin beim Ändern des Eingabefeldes aktualisiert.
- **Zwischenablage als Datei einfügen:** Das Eingabefeld **Dateiname** besitzt eine Datalist mit den bereits vorhandenen Dateien **im gewählten Zielordner** und mit der zur Zwischenablage passenden Dateiendung (z. B. `.css`, `.js`, `.html` oder `.png`). Beim Wechsel des Zielordners werden die Vorschläge neu aufgebaut; Unterordner und andere Projekte sind ausgeschlossen. Dateinamen bleiben frei editierbar. Bei identischem Dateinamen gelten weiterhin **Umbenennen**, **Ersetzen** und **Überspringen**.
- **HTML-Standardname:** Wird HTML eingefügt und enthält der Zielordner noch keine `.html`- oder `.htm`-Datei, steht zunächst `index.html` im Feld. Bei einem Ordnerwechsel wird der automatisch vorgeschlagene Name angepasst, solange der Dateiname nicht manuell verändert wurde. HTML-Fragmente mit dem MIME-Typ `text/html` werden ebenfalls als HTML erkannt.
- **Offline-PWA:** Neuer Cache-Schlüssel `mindfagg-v42`; keine Datenbankmigration und keine Änderung am ZIP-Format.

**Installation:** `mindfagg-v42.zip` ist das **vollständige App-Paket** auf Basis von v41. Die Dateien unter derselben HTTPS-/localhost-Adresse wie bisher bereitstellen, damit IndexedDB-Daten erhalten bleiben. Vor dem Aktualisieren ein Workspace-ZIP-Backup erstellen.

**Prüfen:** `node tests/check-structure.mjs`, `python tests/v42-browser.py`, `python tests/v41-browser.py`, `python tests/v40-browser.py` und die weiteren Regressionstests. Die GitHub-API wird in Browser-Tests simuliert; echte Token-Rechte und native Datalist-Popup-Darstellung bitte im regulären Browser überprüfen.

---

# Versionshistorie: v41

Offline-fähiger Workspace mit Markdown, Mindmap, Kanban, Kalender, Scripteditor und GitHub-Synchronisation.

## Neu in v41: Pretty Code und echte GitHub-Repository-Vorschläge

- **Pretty Code:** Neuer Button in der bestehenden Script-Editor-Toolbar für HTML (`.html`, `.htm`), JavaScript (`.js`, `.mjs`, `.cjs`), CSS (`.css`), XML (`.xml`, `.xhtml`) und SVG (`.svg`). Die Formatierung läuft vollständig lokal, ohne Internet oder externe Laufzeitbibliothek. Strukturblöcke werden eingerückt, CSS-Deklarationen lesbarer und JavaScript-Token auf lesbare Zeilen verteilt. Dies ist ein konservativer integrierter Formatter, **nicht** die vollständige Prettier-Engine.
- **Sicherheit und Undo:** JavaScript wird vor und nach der Formatierung mit dem bestehenden Acorn-Parser geprüft. Bei Syntaxfehlern oder einer veränderten AST-Struktur wird **nichts** gespeichert. XML/SVG wird bei verfügbarem DOMParser auf Wohlgeformtheit geprüft. Faltungen werden vor einer tatsächlichen Formatierung geöffnet; der Originalinhalt kommt aus `codeFoldFull()`. Alle Änderungen benutzen die vorhandene Input-, Autosave- und Undo/Redo-Pipeline. Für reine HTML/CSS/XML-Dateien ist dies eine strukturelle Formatierung, keine vollständige semantische Validierung.
- **GitHub-Repository-Autocomplete:** Der Zuordnungsdialog ruft `GET /user/repos` mit dem lokal gespeicherten Token ab. Die API liefert die für den Token zugänglichen Repositories (auch private, sofern berechtigt). Bis zu zehn Seiten mit je 100 Repositories werden geladen; Ergebnisse erscheinen schon nach der ersten Seite. Beim Tippen wird `owner/repo` gefiltert, bis zu neun Treffer werden als auswählbare Liste gezeigt. Pfeiltasten, Enter, Escape und Mausbedienung werden unterstützt. Alte Projektzuordnungen werden **nicht** als separate Vorschläge verwendet.
- **Token-Rechte und Fehler:** Für private Repositories benötigt der Token den entsprechenden Repository-Zugriff (GitHub-Metadaten-Leserecht). Bei Offline-/API-/Rechtefehlern wird eine Meldung angezeigt; `owner/repo` kann weiterhin frei eingetragen werden. Die geladene Liste wird nicht in den Browser-Speicher oder den Projekt-Export übernommen.
- **Offline-PWA:** Cache-Version `mindfagg-v41` und neue lokale Datei `script/pretty-code.js`. Keine Datenbankmigration und keine Änderung am Projekt-ZIP-Format.

**Patch-Installation:** `mindfagg-v41.zip` enthält ausschließlich gegenüber **v40** geänderte bzw. neue Dateien. In den vorhandenen v40-App-Ordner entpacken und die Ordnerstruktur behalten. Das Patch-ZIP ist nicht eigenständig lauffähig. Vor dem Update eigene Projekte sichern.

**Prüfen:** `node tests/check-structure.mjs`, `python tests/v41-browser.py`, `python tests/v40-browser.py`, `node tests/github-sync.mjs`, `node tests/github-credentials.mjs`. Automatisierte GitHub-Tests simulieren API-Antworten; ein Live-Zugriff mit dem eigenen GitHub-Token und PWA-Cache-Update sollten im eigenen Browser verifiziert werden.

---

# Versionshistorie: v40


Offline-fähiger Workspace mit Markdown, Mindmap, Kanban, Kalender, Scripteditor, Bild-/HTML-Vorschau und dateibasierter ZIP-Verwaltung.

## Neu in v40: Script-Suchen und -Ersetzen, GitHub-Vorschlag und Folding-Voreinstellung

- **Code Folding:** Unter **App-Einstellungen** standardmäßig **aus**, auch beim Zurücksetzen auf Editor-Standardwerte. Bereits explizit gespeicherte Einstellungen bleiben erhalten, einschließlich `codeFolding: true`. Der bestehende lokale Einstellungsschlüssel bleibt unverändert.
- **GitHub-Repository:** Im Zuordnungsdialog erscheint beim Fokussieren oder Tippen eines passenden Präfixes der Vorschlag `<eigener GitHub-Benutzername>/`. Die Auswahl per Klick oder Pfeiltaste/Enter übernimmt ihn in das Feld; beliebige `owner/repo`-Angaben bleiben weiterhin möglich. Der Vorschlag verwendet den Login des bereits gespeicherten GitHub-Zugangs, nicht einen hartkodierten Namen.
- **Script-Editor-Toolbar:** Suchen & Ersetzen für HTML, CSS, JS, XML und SVG (sowie weitere Textdateien des Script-Editors). Desktop: Leiste über dem Quelltext; auf schmalen Bildschirmen am unteren Rand des Editors, oberhalb der Bildschirmtastatur. **Strg/⌘+F** öffnet Suchen, **Strg/⌘+H** Suchen mit Ersetzen (soweit im Browser verfügbar).
- **Suchen-Panel:** VS-Code-artiges schwebendes Panel. Initial nur die Suche mit Groß-/Kleinschreibungs-Schalter `Aa` im Suchfeld, Vorwärts-/Rückwärts-Navigation und Trefferzähler. Der Pfeil links klappt die Ersetzen-Zeile mit **Ersetzen** und **Alle ersetzen** auf. *Kein Regex*, *kein Find in Section*.
- **Mehrzeilig:** Suche und Ersatz können echte Zeilenumbrüche enthalten (Text einfügen oder **Umschalt+Enter**). **Enter** navigiert zum nächsten Treffer, **Escape** schließt das Panel. Ersetzungen werden über die vorhandene History, Syntaxprüfung und automatische Speicherung verarbeitet; Code Folding verbirgt niemals Teile des Suchraums. Treffer hinter Faltungen werden bei Navigation gezielt sichtbar gemacht.
- **Offline-PWA:** Cache `mindfagg-v40`; keine Änderung an IndexedDB-, Projekt- oder ZIP-Datenformaten.

**Patch-Installation:** `mindfagg-v40.zip` enthält **nur gegenüber v39 geänderte und neue Dateien**. Auf den vollständigen installierten **v39-App-Ordner** entpacken und die Ordnerstruktur einschließlich `script/` beibehalten. Das ZIP ist nicht eigenständig lauffähig. Vor dem Update ein Projekt-ZIP sichern.

**Tests:** `node tests/check-structure.mjs`, `node tests/v39-preferences.mjs`, `python tests/v40-browser.py` sowie die älteren Regressionstests. Die Browser-Tests verwenden temporär eingebettete Dateien mit isolierten Testdaten; echte GitHub-Zugriffe werden dadurch nicht ausgeführt.

---

# Versionshistorie: v39

Offline-fähiger Workspace mit Markdown, Mindmap, Kanban, Kalender, Scripteditor, Bild-/HTML-Vorschau und dateibasierter ZIP-Verwaltung.

## Neu in v39: Code Folding

- **Sprachen:** HTML, CSS, JavaScript, SVG, XML und Markdown. Aufklappbare Bereiche werden durch Pfeile links neben den Zeilennummern angezeigt. Unterstützt werden u. a. HTML-/XML-Elemente, CSS-/JS-Klammerblöcke und Kommentare sowie Markdown-Überschriften, verschachtelte Listen und eingezäunte Codeblöcke.
- **App-Einstellungen → Code Folding aktivieren:** In v39 standardmäßig eingeschaltet; seit v40 standardmäßig deaktiviert (gespeicherte Werte gelten weiterhin). Der Schalter gilt für beide Editoren und wird unter dem bisherigen Einstellungsschlüssel gespeichert. „Editor-Standardwerte wiederherstellen“ deaktiviert Code Folding seit v40.
- **Datenintegrität:** Die Faltansicht blendet nur Zeilen aus und speichert niemals ihre Platzhalter. Der vollständige Text bleibt für Auto-Save, Undo/Redo, ZIP/GitHub-Sync, Quelltextprüfung und Vorschau erhalten. Beim Bearbeiten ausgeblendeter Bereiche wird deren Quelltext vorher wieder eingeblendet; Copy/Cut über Faltbereiche benutzt den Originaltext.
- **Syntaxdiagnosen:** Eine Fehlerstelle in einem eingeklappten Bereich wird beim Anklicken des Fehlers wieder eingeblendet. Die Faltzustände sind sitzungsgebunden und werden nicht als Teil der Projektdateien exportiert.
- **Offline-Cache:** `mindfagg-v39`, mit den neuen Dateien `core/code-folding.js` und `css/code-folding.css`. Keine Änderung am IndexedDB- oder ZIP-Schema.

**Patch-Installation:** Das v39-Änderungsarchiv enthält **nur neue oder geänderte Dateien**. Über den vorhandenen **v38-App-Ordner** entpacken (Dateien überschreiben, Ordnerstruktur erhalten). Es ist kein vollständiges App-Paket und läuft nicht allein.

**Prüfen:** `node tests/check-structure.mjs`, `node tests/v39-preferences.mjs`, `python tests/v39-browser.py`, `python tests/v39-advanced.py`. Browser-Smoke-Tests liefen mit temporär inline eingebetteten lokalen Ressourcen; das echte PWA-Service-Worker-Update sollte zusätzlich auf localhost/HTTPS geprüft werden.

## Neu in v38: Speicherzugriff in der HTML-Vorschau (opt-in)

- **Standard:** `iframe sandbox="allow-scripts"` bleibt unverändert; Vorschau-Skripte haben keine Speicherrechte.
- **App-Einstellungen → HTML-Vorschau · Sicherheit:** Der neue Schalter **localStorage und IndexedDB erlauben** ist anfänglich ausgeschaltet. Bei Aktivierung verwendet das Vorschau-iframe `sandbox="allow-scripts allow-same-origin"`. Dadurch funktionieren die nativen Browser-APIs, sofern der Browser den Speicherzugriff für den App-Ursprung zulässt. Die Entscheidung wird lokal und appweit unter den Editor-/App-Einstellungen gespeichert.
- **Direkt aus einer Fehlermeldung:** Wenn die Vorschau-Konsole einen Sandbox-`SecurityError` für `localStorage` oder `IndexedDB` erkennt, öffnet sie sich automatisch und bietet direkt in der Meldung **Speicherzugriff jetzt freigeben** an. Ein Klick aktiviert die Option und lädt die Vorschau neu. Wird die Option in den App-Einstellungen ausgeschaltet, erhalten neu geladene Vorschauen sofort wieder die restriktive Sandbox.
- **Wichtige Sicherheitswarnung:** `allow-scripts` und `allow-same-origin` in einem `srcdoc`-iframe lassen Vorschau-Skripte **denselben Ursprung wie die Hauptanwendung** verwenden. Skripte können damit auf **alle App-Daten und GitHub-Zugangsdaten** zugreifen und potenziell die Hauptanwendung steuern. Die Freigabe ist **keine pro Projekt isolierte Speicherfreigabe**. Sie darf nur bei vertrauenswürdigen HTML-Dateien eingeschaltet werden und gilt für alle Projekte, bis sie wieder ausgeschaltet wird. Das Deaktivieren entzieht keine Daten, die bereits während der Freigabe gelesen wurden.
- **Browser:** Auf `file://` und in eingeschränkten/privaten Browserumgebungen kann die Freigabe weiterhin blockiert sein; HTTPS oder `localhost` wird empfohlen.
- **PWA und Daten:** Offline-Cache `mindfagg-v38`, keine Änderung am IndexedDB-Schema oder ZIP-Format.

**Prüfen:** `node tests/check-structure.mjs`, `node tests/v38-regression.mjs`, `python tests/v38-browser.py`. Der Testbrowser erlaubt keine HTTP-/`file://`-Navigation; native Storage-Persistenz muss zusätzlich in einem regulären Browser auf HTTPS/localhost überprüft werden.

## Neu in v37: Mindmap-Abstände und einheitlicher Knotendialog

- **Mindmap:** Der Abstand zwischen direkten Geschwisterknoten wird gegenüber v36 auf allen tieferen Ebenen verdoppelt (30/18/12 px statt 15/9/6 px). Zwischen den übergeordneten Teilbäumen kommen 24 px hinzu (64 statt 40 px). Die Anordnung wird weiterhin aus dem Markdown-Baum abgeleitet, auch bei eingeklappten Knoten.
- **Kanban:** Öffnet exakt denselben Dialog „Knoten bearbeiten“ wie Mindmap und Kalender, einschließlich Status-Auswahl. Ein geänderter Status wird wie gewohnt als Markdown-Eigenschaft gespeichert und das Board wird aktualisiert.
- **PWA:** Der Offline-Cache erhält den neuen Versionsschlüssel `mindfagg-v37`; an IndexedDB und ZIP-Format sind keine Änderungen notwendig.

**Prüfen:** `node tests/v37-regression.mjs` und `python tests/v37-browser.py` (Chromium/Playwright erforderlich). Die bisherigen v36-Tests bleiben erhalten.

## Neu in v36: kompaktere Mindmap, GitHub-Links und Codevalidierung

- **Mindmap:** Geschwisterknoten innerhalb eines Teilbaums stehen enger zusammen (absteigender vertikaler Abstand pro Hierarchietiefe: 40/15/9/6 px). Zwischen zwei übergeordneten Zweigen bleibt der Kontextwechsel sichtbar.
- **App-Einstellungen / GitHub:** Ein direkter Link zur Erstellung eines Fine-grained Personal Access Tokens erläutert die benötigten Repository-Rechte (`Contents: Read and write`). Um das Passwort-Speicherangebot des Browsers nach Möglichkeit zu vermeiden, wird der Token in Chromium/WebKit über ein maskiertes Textfeld (`-webkit-text-security`) eingegeben; falls dies nicht unterstützt wird, nutzt die App aus Sicherheitsgründen weiterhin ein Passwortfeld. **Ein Speicherangebot lässt sich browserübergreifend nicht garantieren verhindern.** Der Token wird weiterhin nur im verschlüsselten lokalen App-Speicher abgelegt.
- **Repository-Zuordnung:** Während der Eingabe von `owner/repo` entsteht automatisch ein klickbarer Link zum jeweiligen GitHub-Repository; daneben öffnet ein zweiter Link `https://github.com/new`. Beide Links öffnen neue Tabs, ohne die Zuordnung in der App zu ändern.
- **Script-Editor:** Offline-Syntaxprüfungen für `.js/.mjs/.cjs` (gebündelter Acorn-Parser), `.css` (Struktur-/Deklarationsprüfung sowie `CSS.supports()` für unterstützte Eigenschaften) und `.html/.htm` (HTML-Tag-Prüfung mit Checks für eingebettetes CSS/JS). Diagnosen markieren Zeilen und Fehlerstellen und lassen sich anklicken. Für TypeScript, JSX, SCSS, Vue etc. wird **keine vollständige Syntaxvalidierung behauptet**. Die HTML-/CSS-Prüfung ist bewusst keine vollständige W3C-/WHATWG-Konformitätsprüfung.
- **Dateiaktionen:** Trennlinie zwischen „Neuer Ordner“ und „Dateien hochladen“. Eingefügter Klartext aus der Zwischenablage wird bei erkennbar gültigem CSS oder JavaScript als `clipboard.css` bzw. `clipboard.js` vorgeschlagen; sonst bleibt `clipboard.txt`.
- **Offline-Version in v36:** Damaliger Cache-Schlüssel `mindfagg-v36`. Das IndexedDB-Schema und das GitHub-Synchronisationsformat bleiben unverändert.

### Prüfen

```sh
node tests/check-structure.mjs
node tests/v36-validation.mjs
node tests/v35-editor-dialog.mjs
python tests/v36-browser.py
```

Der Browser-Smoke-Test verwendet eine ausschließlich testinterne, inline eingebettete Variante mit Testdaten, da der automatische Testbrowser in dieser Umgebung lokale HTTP-Navigation blockiert. Für echte Persistenz, Token-Zugriff und GitHub-Synchronisation bitte zusätzlich die manuelle Checkliste in `TESTS.md` durchgehen.

## Neu in v35: Editor-Autovervollständigung und Knotenformular

- Die Browser-Autovervollständigung ist bei den Textfeldern des **Markdown-Editors** (`#source`) und des **Scripteditors** (`#scriptSource`) mit `autocomplete="off"` deaktiviert. Diese Attribute waren schon in v34 gesetzt und bleiben erhalten. Die anwendungsinterne Markdown-Vervollständigung (Wiki-Links, Syntax) bleibt verfügbar.
- Im Dialog **Knoten bearbeiten** steht die **Beschreibung (Markdown)** nun **vor dem Datum / Zeitraum**. Die Erstellungsmaske bleibt unverändert.
- Auch für die Beschreibung im Knoten-Dialog ist jetzt `autocomplete="off"` gesetzt.
- Der Offline-Cache ist auf `mindfagg-v35` erhöht; die Datenbank und GitHub-Synchronisation bleiben unverändert.

## Neu in v34: dauerhaft verbundenes GitHub und Ein-Klick-Sync

Die GitHub-Verbindung wird **einmal zentral** in den App-Einstellungen autorisiert. Jedes Projekt hat seine **eigene Repository-Zuordnung**. Ein Klick auf den Sync-Button unter **DATEIEN** synchronisiert automatisch beide Richtungen.

### Einrichtung

1. Die App über **HTTPS oder localhost** öffnen; den bisherigen Browser-Ursprung beibehalten, um bestehende Projekte zu sehen.
2. Auf das **mindfagg-Logo** klicken, um **App-Einstellungen** zu öffnen. Unter **GitHub-Zugangsdaten** einen Fine-grained Personal Access Token (PAT) mit Repository-Berechtigung **Contents: Read and write** eingeben und **Token prüfen und speichern** wählen.
3. Das gewünschte Projekt wählen, **Projekteinstellungen** → **GitHub-Repository** → **Zuordnen** öffnen. `owner/repo` oder `https://github.com/owner/repo` angeben, Branch standardmäßig `main`. Repository und Branch müssen existieren.
4. In der Sidebar auf die Sync-Schaltfläche klicken. Sie zeigt beispielsweise **Synchronisiert**, **3 lokale Änderungen**, **2 GitHub-Änderungen**, **Konflikt erkannt** oder **GitHub nicht erreichbar**.

Die GitHub-Zugangsdaten gelten appweit. Repository, Branch und letzter erfolgreicher Dateiabgleich werden **projektweise** gespeichert. Eine weitere Eingabe des Tokens nach einem normalen Browser-Neustart ist nicht notwendig, solange derselbe Browser, dasselbe Profil und derselbe Web-Ursprung verwendet werden. Bei anderen Geräten oder gelöschten Browserdaten ist die Authentifizierung erneut erforderlich.

### Abgleichsregeln

| Situation je Datei | Ergebnis |
| --- | --- |
| Nur lokal seit dem letzten Abgleich geändert | Nach GitHub hochladen |
| Nur auf GitHub geändert | Lokal übernehmen |
| Beide Seiten unverändert | Keine Änderung |
| Lokal und GitHub unabhängig geändert | Konflikt; nicht automatisch überschreiben |
| GitHub nicht erreichbar | Lokale Änderungen bleiben erhalten |

Neue Dateien, Änderungen und Löschungen werden erkannt. Konfliktfreie Änderungen können bei demselben Klick in beide Richtungen übertragen werden. Alle hochgeladenen Änderungen werden nach Möglichkeit in **einem Commit** zusammengefasst; es wird **niemals Force-Push** verwendet.

### Konflikte

Bei mehreren Konflikten erscheint ein **gemeinsamer Dialog**. Jede betroffene Datei zeigt die beiden Versionen nebeneinander: **Dieser Computer** und **GitHub**, jeweils mit Dateigröße und letztem verfügbaren Änderungszeitpunkt. Für jede Datei lässt sich **Lokale Version behalten**, **GitHub-Version behalten** oder **Noch nicht entscheiden** auswählen. **Alle lokal** und **Alle GitHub** sind Abkürzungen. Unentschiedene Dateien werden nicht überschrieben und bleiben beim nächsten Sync konfliktbehaftet. Es findet kein automatisches Zusammenführen statt.

**Zeitangaben:** Git speichert keine Dateisystem-Änderungszeiten. Die App verwendet lokal den gespeicherten Änderungszeitpunkt und auf GitHub den letzten Commit, der den Dateipfad verändert hat (wenn abrufbar). Das ist nicht unbedingt die ursprüngliche Dateizeit.

### Datensicherheit und Grenzen

- Der GitHub-Token wird **verschlüsselt mit AES-GCM** im lokalen IndexedDB-Store `settings` gespeichert, zusammen mit einem **nicht exportierbaren** Browserschlüssel. Er steht nicht in Projekt-ZIPs, GitHub-Dateien oder im Service-Worker-Cache. Der Token wird nur direkt an `https://api.github.com` gesendet. **Diese lokale Verschlüsselung schützt nicht vor schädlichen Skripten auf demselben App-Ursprung oder einer kompromittierten geöffneten Browsersitzung.** App nur auf vertrauenswürdigem HTTPS/localhost betreiben.
- `mindfagg-db` wird von **Version 1 auf Version 2** aktualisiert und um den Store `settings` ergänzt. Projekte und Dateien bleiben bestehen; ein ZIP-Backup vor dem Umstieg wird dennoch empfohlen.
- Unterstützt reguläre Text- und Binärdateien einschließlich Markdown, Bildern und Audio. Grenzen: **20 MiB pro Datei**, **80 MiB je Upload/Download**, maximal **750 heruntergeladene Dateien** pro Abgleich. Keine Bearbeitung von Git LFS, Submodulen oder Symlinks; leere Git-Verzeichnisse können nicht übertragen werden.
- Dateien werden **nicht automatisch im Hintergrund synchronisiert**: Die Schaltfläche löst den eigentlichen Transfer aus. Ihr Status wird beim Projektwechsel, nach lokalen Bearbeitungen und nach einem Abgleich aktualisiert; externe Änderungen werden beim nächsten GitHub-Check erkannt.
- Die GitHub-Rechte und Branchschutzregeln gelten weiter. Die echte Kommunikation mit einem Benutzer-Repository konnte in der isolierten Testumgebung nicht geprüft werden.

**Vor dem ersten Sync ein Projekt-ZIP sichern.** GitHub-Dateien enthalten nicht automatisch lokale App-Einstellungen, Mindmap-Zustände oder leere Ordner.

## Neu in v32: Import, Export und Dateiverwaltung

- **`+` neben DATEIEN:** Neue Datei, neuer Ordner, mehrere Dateien hochladen, Text/Bilder aus der Zwischenablage als Datei einfügen oder ZIP importieren.
- **`⋯` neben DATEIEN:** Workspace als ZIP herunterladen, über den nativen Teilen-Dialog teilen oder die aktuell geöffnete Datei herunterladen.
- **ZIP-Import:** Wahl zwischen einem neuen Projekt und dem Import in einen Ordner des bestehenden Projekts. Optional den gemeinsamen obersten ZIP-Ordner entfernen. Leere Ordner, Textdateien, Bilder und Binärdateien bleiben erhalten.
- **Konflikte:** Vor dem Import werden Namenskollisionen angezeigt. Es gibt die Optionen **Umbenennen**, **Ersetzen** und **Überspringen**.
- **Drag-and-drop:** Dateien oder eine ZIP-Datei auf einen Ordner in der Sidebar ziehen.
- **Zwischenablage:** Text oder Bilder per Menü einfügen. Falls `navigator.clipboard.read()` blockiert wird, steht ein Paste-Dialog mit Strg+V / ⌘V zur Verfügung. Mit Fokus auf der Sidebar kann Strg+V / ⌘V den Import ebenfalls auslösen.
- **Undo/Redo:** Neue Dateien, Ordneränderungen, einzelne/mehrere hochgeladene Dateien, Überschreiben und ZIP-Importe in bestehende Projekte werden als gruppierte Workspace-Aktion rückgängig gemacht. Import als **neues Projekt** ist davon ausgenommen und kann über die bestehende Projektlöschung mit Wiederherstellung rückgängig gemacht werden.

## Neu in v32: Audio und HTML-Vorschau-Konsole

- Audio-Dateien (u. a. `.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`) werden beim Anklicken mit einem einfachen nativen Player für Abspielen, Pause, Lautstärke und Zeitleiste geöffnet. Bereits in v31 importierte Audiodateien werden ohne Datenmigration erkannt.
- In der HTML-Vorschau gibt es einen **Vollbild-Button** (native Fullscreen API, ansonsten bildschirmfüllende Darstellung) und eine **Fehlerkonsole** mit maximal 100 Meldungen.
- Die Konsole erfasst `console.log/info/warn/error/debug`, Laufzeitfehler, unhandled Promise-Rejections und fehlgeschlagene Ressourcen. Jede Meldung ist einzeln kopierbar; die Konsole kann geleert werden.
- HTML bleibt in einem `iframe sandbox="allow-scripts"` ohne gemeinsamen Ursprung mit der App. Die Konsole erhält ausschließlich begrenzte Textmeldungen über die bestehende, auf ein einzelnes Frame und Sitzungstoken eingeschränkte Nachrichtenbrücke.

## Start

1. ZIP vollständig entpacken und die **gesamte Ordnerstruktur beibehalten**.
2. `index.html` öffnen. Für PWA, Service Worker und weitere Browser-Funktionen die App über HTTPS oder einen lokalen HTTP-Server bereitstellen.
3. Bei Updates **denselben Browser-Ursprung** verwenden, um die vorhandene IndexedDB weiterzunutzen. Vor einem Update ein Projekt-ZIP sichern.

**Ohne Framework, CDN und Build-Schritt.** Die App verwendet klassische JavaScript-Dateien in einer festgelegten Lade-Reihenfolge. Der optionale Strukturtest benötigt Node.js:

```sh
node tests/check-structure.mjs
node tests/github-sync.mjs
```

`ARCHITECTURE.md` erläutert Module und Datenflüsse, `TESTS.md` enthält Prüfungen und bekannte Testgrenzen.
