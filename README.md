# mindfagg v35

Offline-fähiger Workspace mit Markdown, Mindmap, Kanban, Kalender, Scripteditor, Bild-/HTML-Vorschau und dateibasierter ZIP-Verwaltung.

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
