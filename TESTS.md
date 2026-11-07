# mindfagg v50 – Dateiliste und Icon-Regression

- [ ] In der Sidebar steht **Patchen** rechts von **Teilen**. Der Klick öffnet weiterhin das Patch-Tool.
- [ ] `.js`, `.mjs`, `.cjs` und `.jsx` zeigen ein gelbes JS-Quadrat.
- [ ] `.css` zeigt ein blaues Hash-Symbol (#).
- [ ] `.htm`, `.html`, `.xhtml` zeigen orange spitze Klammern (`<>`).
- [ ] `.md`, `.markdown`, `.mdown` zeigen einen blauen Pfeil nach unten.
- [ ] Weitere Dateitypen (z. B. Bild, Audio, Text) behalten die bisherigen Icons; Ordnersymbole bleiben unverändert.
- [ ] Dateiliste im Root und in Unterordnern, aktive Datei, Klick und mobile Darstellung prüfen.
- [ ] Offline-Cache `mindfagg-v50`, Manifest-Version `v50` und Delta-Installation über v49 prüfen.

**Automatisiert:** `node tests/check-structure.mjs`, `python tests/v50-browser.py`, ergänzend `python tests/v48-browser.py` und `python tests/v49-browser.py`.

---

# mindfagg v49 - Regressionen

- [ ] Sidebar: **Teilen** steht links von **Patch-Tool**, Desktop und Mobil, Buttons funktionieren weiterhin.
- [ ] Fehlerhaften JSON-Patch eingeben und pruefen: Anzeige `Patch abgelehnt: ...` ist vollstaendig anklickbar; Klick kopiert exakt diesen Text, meldet Erfolg und loescht die Meldung nicht.
- [ ] Mit Tab zum Fehler navigieren, Enter und Leertaste kopieren ebenfalls. Bei verweigerter Clipboard-API funktioniert der vorhandene `execCommand('copy')`-Fallback. Misslingt auch dieser, erscheint keine falsche Erfolgsanzeige.
- [ ] `Patch prüfen, um die Vorschau zu aktualisieren.` bleibt ein eigener roter, klickbarer Validierungs-Hinweis; normale Info- und Planungsfehler bleiben keine Kopierbuttons.
- [ ] Prompt zeigt die drei literalen Escapes: Anfuehrungszeichen (`\"`), Backslashes (`\\`), Newline (`\n`). Die Phrase ist im Patch-Tool und beim Teilen inhaltlich gleich.
- [ ] Keine Aenderung an Patch-Operationen, Vorschau, Batch-Undo/Redo, Dateifreigabe oder Projektstruktur.
- [ ] Offline-Cache `mindfagg-v49` und Manifest `v49`; alte Cache-Version wird beim Aktivieren ersetzt.

**Automatisiert:** `python tests/v49-browser.py`, `node tests/check-structure.mjs`, `node tests/v44-patch.mjs`, `node tests/v45-patch.mjs` und die vorhandenen Browserregressionen.

---

# mindfagg v48 - UI-Regressionspruefung

1. Ohne gespeicherten Access Token erscheint kein Repository-Button. **Patch-Tool** und **Teilen** sind weiterhin nebeneinander sichtbar und oeffnen die bisherigen Dialoge.
2. Nach hinterlegtem GitHub-Token erscheint der Repository-Button. Nach Entfernung des Tokens verschwindet er sofort. Bei Projektwechsel wird sein Zustand konsistent aktualisiert.
3. `⋯` zeigt als Tooltip **Download** und im Menue nur ZIP-Download und aktuelle Datei. Der Untertext der aktuellen Datei ist der echte Dateiname inklusive Erweiterung. Dateinamen mit HTML-Sonderzeichen bleiben als Text sichtbar.
4. In den Menues haben **Neue Datei** und **Aktuelle Datei herunterladen** Dokument-Icons, **Neuer Ordner** ein Ordner-Icon und **ZIP importieren** sowie **ZIP herunterladen** ein ZIP-Ordner-Icon (Reissverschluss).
5. Bei fehlendem Projekt sind die Direktbuttons deaktiviert. Auf Desktop und Mobil sind beide Buttons nebeneinander lesbar.
6. `node tests/check-structure.mjs` und `python tests/v48-browser.py` erfolgreich. Danach die bisherigen JavaScript- und Browser-Regressionen wiederholen.

---

# mindfagg v47 - Tests und Regressionen

## Neu in v47

- [ ] **Teilen - Globale Auswahl:** Oberhalb der gruppierten Dateiliste steht `Alle waehlen`. Standardmaessig sind alle Dateien angehakt. Ein Klick deaktiviert alle Verzeichnis- und Datei-Checkboxen und sperrt den Share-Button. Erneut aktivieren stellt die gesamte Auswahl wieder her.
- [ ] Bei Teilauswahl ist die globale Checkbox `indeterminate`; bei einer teilweise markierten Gruppe ist auch deren Checkbox `indeterminate`. Beidseitige Synchronisation zwischen allen drei Ebenen testen.
- [ ] **Groessen:** Jede Datei zeigt ihre tatsaechlich exportierte Dateigroesse. Binaere Inhalte, Unicode (UTF-8), unveraenderte Originalbytes und leere Dateien pruefen; die Anzeige darf nicht die komprimierte ZIP-Groesse sein.
- [ ] **Summen:** Direkt unter der Dateiliste stehen `X von Y gewaehlt` und `Gesamtgroesse: ...`. Die Summe veraendert sich bei globaler, gruppenweiser und einzelner Auswahl. Ohne Auswahl: 0 B. Leeres Projekt: globale Checkbox deaktiviert, Summe 0.
- [ ] **Patch-Phrase kopieren:** Button links von `Abbrechen` im Teilen-Dialog. Kopiert exakt die aktuelle KI-Phrase aus dem Patch-Tool, ohne den Dialog zu schliessen; Clipboard-API und Fallback pruefen.
- [ ] **Weiterhin teilen:** Nur ausgewaehlte Dateien als ZIP oder Einzeldateien versenden, inklusive Pfad-/Namenskollisionen, aller Elternordner, nativer Share-Abbruch und Download-Fallback.
- [ ] **Browser History Back:** Ein neu gestarteter App-Tab faengt die Zurueck-Taste ab. Bei offenem Dialog wird nur der Dialog geschlossen. Ohne Dialog: ein Druck oeffnet die mobile Sidebar, der naechste schliesst sie. Wiederholte Rueck-Navigation darf die Seite nicht verlassen.
- [ ] Ist beim Dialog ein mobiles Menue bereits offen, darf Back zunaechst nur den Dialog schliessen; weiterer Back-Druck schliesst das Menue. Auf breitem Bildschirm Sidebar ein-/ausblenden. Ein durch laufende GitHub-Aktion gesperrter Dialog darf nicht unterlaufen werden.
- [ ] Status nach Reload, Desktop/Mobil-Wechsel, Fokus, Tastatur, ZIP-Export, Undo/Redo und Offline-Neustart pruefen.

**Automatisiert:** `node tests/check-structure.mjs`; `node tests/v44-patch.mjs`; `node tests/v45-patch.mjs`; `python tests/v47-browser.py` und `python tests/v46-browser.py`. Die lokalen Browser-Skripte nutzen eingebettete Module (ohne echtes IndexedDB oder Service-Worker), zusaetzlich native mobile Hardware-Back- und PWA-Installation im Zielbrowser testen.

---

# mindfagg v46 - Tests und Regressionen

## Neu in v46

- [ ] **Patch pruefen:** Eigenstaendiger Button existiert nicht. Nach jeder manuellen Texteingabe wird die vorherige Vorschau versteckt und der **rote** klickbare Text **„Patch prüfen, um die Vorschau zu aktualisieren.“** eingeblendet. Maus, Tab/Enter/Leertaste pruefen.
- [ ] JSON aus Zwischenablage, Datei, Drag-and-drop und Projekt einlesen. Neues JSON aktualisiert die Vorschau sofort; Fehler zeigen das bisherige Formatpruefungs-Feedback.
- [ ] Jede `patch-preview-file` ist beim ersten Laden zugeklappt. Ein Klick auf die Datei-Kopfzeile zeigt die einzelnen Hunks/Operationen; nochmaliger Klick klappt zu.
- [ ] Kopfzeile enthaelt `operation` und **`patch / found / total`**; fuer einen Updateblock mit zwei Hunks und nur einem anwendbaren Treffer: zuerst `2 / 1 / 2`. Wird ein Hunk abgewaehlt, steht `1 / 1 / 2`; der Block bleibt aufgeklappt.
- [ ] Mehrere auf-/zugeklappte Dateibloecke unabhaengig testen. Neuer Patch setzt den Zustand zurueck, die angewaehlten Fehler verhindern weiter das Einspielen.
- [ ] **Teilen** mit Share-Icon im `⋯`-Menue oeffnet Dialog. Die Radios **Als ZIP** / **Als Einzeldateien** lassen sich wechseln (ZIP ist Default).
- [ ] Dateiliste zeigt die Kopfzeile **root (Wurzel)** und alle Verzeichnisse mit vollem relativen Pfad; eine **Alle wählen**-Checkbox pro Gruppe. Jede Datei hat eine eigene Checkbox. Angewaehlte Dateien beim Wechsel der Versandart beibehalten.
- [ ] Gruppen-Checkbox deaktiviert/aktiviert nur die Dateien ihrer Gruppe. Ein einzeln abgewaehlter Dateieintrag setzt die Gruppen-Checkbox auf `indeterminate`, erneutes Alle wählen markiert die Gruppe komplett.
- [ ] Ohne Auswahl ist Teilen deaktiviert; bei leerer Root-Gruppe ist deren Checkbox deaktiviert, die Ueberschrift bleibt sichtbar.
- [ ] Selektives ZIP teilen und wieder importieren: nur angewaehlte Dateien, ihre noetigen Ordner und passende Workspace-Metadaten. Normaler vollstaendiger ZIP-Download enthaelt weiterhin alle Dateien und auch leere Ordner.
- [ ] Einzeldateien an das native Share-Menue uebergeben; Bytes und MIME pruefen. Gleichnamige Dateien aus verschiedenen Ordnern haben eindeutige Share-Namen.
- [ ] Ohne `navigator.share` / bei `canShare() === false` werden nur die angewaehlten Dateien heruntergeladen. Native Freigabe abgebrochen (`AbortError`) erzeugt keinen Download; bei anderen Share-Fehlern wird ein Download angeboten.
- [ ] Desktop, Smartphone, Tastaturfokus, Dialog-Backdrop und bestehende v45-Patch-, Undo/Redo-, Editor- und ZIP-Funktionen durchtesten.

**Automatisiert in v46:** `node tests/check-structure.mjs`, `node tests/v44-patch.mjs`, `node tests/v45-patch.mjs`, `python tests/v44-browser.py`, `python tests/v45-browser.py`, `python tests/v46-browser.py` und vorhandene v36-v43-Tests.

**Grenze der Browser-Testumgebung:** Produktionsskripte werden zum Testen in ein temporaeres Dokument eingebettet; die Share-API wird kontrolliert simuliert. Ein tatsaechlicher System-Share-Dialog, Mehrfachdownloads und Service-Worker-Aktualisierung muessen unter HTTPS oder localhost mit echten Browserberechtigungen bestaetigt werden.

---

## Versionshistorie: v45


## Neu in v45

- [ ] Das Patch-Tool zeigt links vom Button **Ausgewaehlte Vorgaenge einspielen** die standardmaessig deaktivierte Checkbox **Patch speichern**.
- [ ] Checkbox aktiviert: Nach erfolgreicher Ausfuehrung erscheint im Projekt-Root genau eine Datei mit dem Namen `YYYY-MM-DD-HHmmss.patch.json` (6-stellige Uhrzeit, z. B. `2026-11-06-213105.patch.json`). Bei einer gleichnamigen Datei wird ein neuer, freier Sekundenwert genutzt.
- [ ] Gespeicherte Datei laden: Sie enthaelt nur angehakte Vorgangs-Bloecke und bei `update` nur angehakte Hunks; das Format ist gueltig, und die Datei erscheint in der Liste `.patch.json`.
- [ ] Checkbox aus: Keine neue Patch-Datei. Einspielen und Rueckgaengig funktionieren unveraendert.
- [ ] Alle fuenf Operationen `create`, `update`, `replace`, `delete`, `rename` einzeln und kombiniert testen; alle sind anfangs angehakt. Einzelne Update-Hunks lassen sich abwaehlen.
- [ ] `create` in neuem Unterordner und `rename` in einen anderen Ordner: Sidebar zeigt die erforderlichen Ordner. Nach Undo verschwindet die neu erstellte Struktur, nach Redo wird sie wiederhergestellt.
- [ ] Mehrere aufeinander folgende Operationen auf dieselbe Datei (z. B. `create` -> `update` -> `rename`) betreffen den jeweiligen Zwischenstand. `replace` mit leerem `content` wird akzeptiert.
- [ ] `delete`/`rename` auch auf Binaerdateien; `create`/`update`/`replace` fuer Binaerdaten zurueckweisen.
- [ ] Unbekannte Operationen, zusaetzliche Felder, absolute/Pfad-Traversal-Namen, Zielkonflikte (auch unterschiedliche Gross-/Kleinschreibung), ungültige Hunks und fehlende Dateien verweigern das Einspielen.
- [ ] Die Vorschau schreibt nichts in die Dateien. Eine fehlgeschlagene ausgewaehlte Operation verhindert alle Aenderungen, selbst wenn andere gueltig sind.
- [ ] Mit **einem Undo** sowohl alle Dateioperationen als auch eine ggf. gespeicherte Patch-Datei rueckgaengig machen. Mit **einem Redo** alles wiederherstellen.
- [ ] Altes v44-Format ohne `operation` bleibt als `update` nutzbar. Angepasste kopierbare KI-Phrase enthaelt alle fuenf Formate und korrekte Feldangaben.
- [ ] Auf Desktop und Smartphone die responsive Buttonzeile sowie HTML-Escaping in der Vorschau pruefen; Service-Worker-Cache `mindfagg-v45` aktualisieren.

**Automatisierte Tests:** `node tests/check-structure.mjs`, `node tests/v44-patch.mjs`, `node tests/v45-patch.mjs`, `python tests/v44-browser.py`, `python tests/v45-browser.py` sowie alle zuvor vorhandenen Regressionstests.

**Testumgebung:** Die Browser-Tests verwenden in dieser Umgebung in die Seite eingebettete Originalskripte und einen transaktionsbasierten IndexedDB-Simulator. Echte Persistenz ueber einen Neustart, PWA-Service-Worker und native Clipboard-Berechtigungen manuell unter HTTPS/localhost pruefen.

---

## Versionshistorie: v44

## Neu in v44

- [ ] Collapse-All-Button: gestrichelter Rahmen mit Minus, nur bei sichtbaren offenen Ordnern.
- [ ] Sidebar `+` zeigt **Patch-Tool**; Dialog enthaelt **Einspielen** und **Erstellen**.
- [ ] JSON manuell einfuegen, per Zwischenablage-Button laden, per `.json`-Dateiauswahl laden und per Drag&Drop importieren.
- [ ] Projektinterne `.patch.json`-Datei auswaehlen und laden; andere Dateiendungen / Projekte nicht anbieten.
- [ ] Ungültiges JSON, fehlende Pflichtfelder, zusätzliche Felder, leere Suchtexte, ungültige occurrence, unsichere Pfade, fehlende und binaere Dateien zurueckweisen bzw. als ungültig markieren.
- [ ] Preview zeigt jeden Hunk und die Beschreibung der Datei; anfangs alle Haken gesetzt. Fehlerhafte Vorgaenge koennen gezielt abgewaehlt werden.
- [ ] Literal-Treffer Nr. 2 sowie aufeinanderfolgende Ersetzungen im selben Dokument pruefen; Einspielen deaktiviert, wenn ein ausgewaehlter Vorgang nicht passt.
- [ ] Mehrere Dateien auf einmal patchen, mit **einem** Rueckgaengig alle Originaltexte zurueckholen, mit Redo beide wiederherstellen.
- [ ] Nach Editor-, Ordner- und Projektwechseln ist der Patch-Dialog weiterhin korrekt und die Sidebar bleibt benutzbar.
- [ ] Prompt-Erweiterung kopieren; Browserberechtigungen und Offline-Verhalten unter HTTPS/localhost manuell pruefen.

**Automatisiert:** `node tests/check-structure.mjs`, `node tests/v44-patch.mjs`, `python tests/v44-browser.py`, danach die v43- und aelteren Regressionen.

---

## Versionshistorie: v43

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
