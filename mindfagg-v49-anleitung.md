# mindfagg – Vollständige Bedienungsanleitung

**Stand:** Version 49 (v49)  
**Sprache:** Deutsch  
**Anwendungsart:** Offline-fähiger, browserbasierter Workspace für Dateien, Markdown, Mindmaps, Aufgaben, Kalender und Quelltext

> Diese Anleitung beschreibt die Benutzeroberfläche und die Funktionen der Anwendung **mindfagg v49**. Sie basiert auf der Anwendung selbst und ihren Versionshinweisen bis v49. Browserabhängige Funktionen wie Teilen, Zwischenablage, Installieren als PWA und die Hardware-Zurück-Taste können sich je nach Gerät und Berechtigungen unterscheiden.

## Inhaltsverzeichnis

1. [Was ist mindfagg?](#1-was-ist-mindfagg)
2. [Start, Installation und Datenspeicherung](#2-start-installation-und-datenspeicherung)
3. [Aufbau der Oberfläche](#3-aufbau-der-oberfläche)
4. [Projekte verwalten](#4-projekte-verwalten)
5. [Dateien und Ordner verwalten](#5-dateien-und-ordner-verwalten)
6. [Dateien importieren, exportieren und teilen](#6-dateien-importieren-exportieren-und-teilen)
7. [Markdown-Dateien und Syntax](#7-markdown-dateien-und-syntax)
8. [Markdown-Editor](#8-markdown-editor)
9. [Mindmap](#9-mindmap)
10. [Kanban und Tierlist](#10-kanban-und-tierlist)
11. [Kalender](#11-kalender)
12. [Script-Editor und Dateivorschauen](#12-script-editor-und-dateivorschauen)
13. [Patch-Tool und KI-Prompt](#13-patch-tool-und-ki-prompt)
14. [GitHub-Zugang und Repository-Synchronisation](#14-github-zugang-und-repository-synchronisation)
15. [App-Einstellungen](#15-app-einstellungen)
16. [Navigation, Tastatur und Rückgängig](#16-navigation-tastatur-und-rückgängig)
17. [Datensicherung, Sicherheit und Fehlerbehebung](#17-datensicherung-sicherheit-und-fehlerbehebung)
18. [Kurzübersicht häufiger Aufgaben](#18-kurzübersicht-häufiger-aufgaben)

---

## 1. Was ist mindfagg?

**mindfagg** verwaltet mehrere Projekte in einem browserbasierten Workspace. Ein Projekt enthält eine hierarchische Datei- und Ordnerstruktur; dazu können Markdown-Dokumente, Quelltextdateien, Bilder, Audiodateien und andere Dateien gehören.

Die wichtigsten Arbeitsbereiche sind:

| Bereich | Zweck |
|---|---|
| **Dateiliste** | Dateien und Ordner anlegen, öffnen, organisieren und verwalten |
| **Markdown** | Strukturierte Notizen und Aufgaben direkt als Markdown bearbeiten |
| **Mindmap** | Den Inhalt einer Markdown-Datei als interaktiven Knotenbaum sehen und bearbeiten |
| **Kanban / Tierlist** | Markdown-Knoten als Aufgaben in Statusgruppen organisieren |
| **Kalender** | Knoten mit Datumsangaben in einem Monatskalender anzeigen |
| **Script** | HTML, CSS, JavaScript, SVG und andere Textdateien mit Syntaxdarstellung bearbeiten |
| **Vorschau** | HTML-Seiten, SVG-Dateien, Bilder und Audiodateien anzeigen bzw. abspielen |
| **Patch-Tool** | Strukturierte JSON-Änderungen prüfen und gebündelt auf Projektdateien anwenden |
| **Teilen / ZIP** | Ganze Projekte oder ausgewählte Dateien exportieren bzw. teilen |
| **GitHub** | Ein Projekt einem Repository/Branch zuordnen und Änderungen abgleichen |

**Wichtig:** Die vier Register **Markdown**, **Mindmap**, **Kanban** und **Kalender** beziehen sich auf **Markdown-Dateien**. Bei Script-, Bild-, Audio- und sonstigen Dateien erscheinen stattdessen die dafür vorgesehenen Dateiansichten.

## 2. Start, Installation und Datenspeicherung

### 2.1 Anwendung starten

1. Lege die Dateien der Anwendung mit ihrer vorhandenen Ordnerstruktur an einem gemeinsamen Ort ab.
2. Öffne `index.html` über einen dafür geeigneten Browser-Ursprung. Für eine zuverlässige Nutzung, insbesondere bei GitHub und PWA-Funktionen, empfiehlt sich **HTTPS** oder **`localhost`**.
3. Erlaube dem Browser das Speichern lokaler Website-Daten.
4. Wähle ein bestehendes Projekt oder erstelle über das `+` im Bereich **PROJEKTE** ein neues.

Die Anwendung besitzt eine Web-App-Konfiguration (PWA) und einen Service Worker für die Offline-Nutzung. Ob sie über das Browsermenü als App installiert werden kann, hängt von Browser und Umgebung ab.

### 2.2 Wo liegen meine Projekte?

Projekte und Dateien werden im **lokalen Browserspeicher (IndexedDB)** verwaltet. Das bedeutet:

- Dateien müssen nicht einzeln auf der Festplatte gespeichert werden, um in mindfagg bearbeitet zu werden.
- Änderungen werden in der Regel **automatisch gespeichert**; der Status erscheint im oberen Bereich.
- Browserprofile, private Fenster und unterschiedliche Ursprünge (`file://`, `localhost`, HTTPS-Domain) besitzen unter Umständen **getrennte Datenspeicher**.
- Das Löschen von Website-Daten oder des Browserprofils kann Projekte entfernen.
- Ein exportiertes **ZIP** ist deshalb die wichtigste transportable Sicherung.

Die Daten sind zunächst lokal. Eine zusätzliche Synchronisation mit GitHub erfolgt nur, wenn du dafür Zugangsdaten und eine Projektzuordnung eingerichtet hast.

## 3. Aufbau der Oberfläche

### 3.1 Linke Sidebar

Die Sidebar gliedert sich in:

**mindfagg-Logo:** Öffnet die **App-Einstellungen**.

**PROJEKTE:** Über die Auswahlliste wechselst du zwischen Projekten. Das `+` erstellt ein Projekt; das Zahnrad öffnet die Einstellungen des ausgewählten Projekts.

**DATEIEN:** Hier findest du die Ordner und Dateien des Projekts. Im Kopf stehen drei Aktionen:

| Symbol | Funktion |
|---|---|
| Gestrichelt umrahmtes **Minus** | Alle derzeit sichtbaren/geöffneten Ordner einklappen; nur sichtbar, wenn es aufgeklappte Ordner gibt |
| `+` | Menü **Dateien und Ordner hinzufügen** |
| `⋯` | Menü **Download** |

Unter diesen Aktionen können folgende Schaltflächen stehen:

- **Repository zuordnen / Synchronisationsstatus:** Nur sichtbar, wenn ein GitHub Access Token hinterlegt ist.
- **Teilen:** Öffnet den Dialog **Dateien teilen**.
- **Patch-Tool:** Öffnet den JSON-Patch-Dialog.

In **v49** steht **Teilen links** und **Patch-Tool rechts**.

### 3.2 Hauptbereich

Oben erscheinen der aktuelle Projekt-/Dateipfad und der Speicherstatus. Daneben befinden sich **Umbenennen**, **Rückgängig** und **Wiederherstellen**.

Für Markdown-Dateien liegen darunter die Register **Markdown**, **Mindmap**, **Kanban** und **Kalender**. Bei anderen Dateitypen werden zum Beispiel **Script**, **Vorschau**, **Functions**, **Bild**, **Audio** oder **Datei** angezeigt.

### 3.3 Mobilgeräte

Auf schmalen Bildschirmen öffnest du die Sidebar mit dem Menüsymbol in der oberen Leiste. Tippe auf den abgedunkelten Bereich außerhalb der Sidebar, um sie zu schließen. Die Editor-Werkzeugleisten und Dialoge sind auf mobile Ansichten angepasst.

Die Browser-/System-**Zurück**-Taste hat außerdem eine eigene Funktion; siehe [Kapitel 16](#16-navigation-tastatur-und-rückgängig).

## 4. Projekte verwalten

### 4.1 Projekt erstellen

1. Klicke in der Sidebar neben **PROJEKTE** auf `+`.
2. Gib den **Projektnamen** ein.
3. Wähle **Projekt erstellen**.

Die App legt zugleich ein erstes Markdown-Dokument namens **Projekt** an.

### 4.2 Zwischen Projekten wechseln

Wähle das gewünschte Projekt aus der Liste **PROJEKTE**. Diese ist nach dem letzten Änderungszeitpunkt sortiert. Jedes Projekt besitzt eine eigene Datei- und Ordnerstruktur und kann ein eigenes GitHub-Repository verwenden.

### 4.3 Projekteinstellungen

Öffne das **Zahnrad** neben der Projektauswahl. Dort kannst du:

- den Projektnamen ändern;
- die **Akzentfarbe** der Projektoberfläche einstellen;
- die Bezeichnungen und Farben der fünf Knotenstatus anpassen;
- die projektbezogene **GitHub-Repository-Zuordnung** öffnen;
- das gesamte Projekt löschen.

Die technischen Statuskennungen `story`, `todo`, `doing`, `review` und `done` bleiben in Markdown erhalten, auch wenn du ihre angezeigten Namen änderst.

### 4.4 Projekt löschen

1. Öffne die Projekteinstellungen.
2. Wähle **Projekt löschen**.
3. Lies die Sicherheitsabfrage und bestätige die Löschung.

Dabei werden die Dateien des Projekts mit entfernt. Die Anwendung unterstützt die Wiederherstellung über **Rückgängig in der laufenden Sitzung**. Für langfristige Sicherheit ist vorher ein ZIP-Export zu empfehlen.

## 5. Dateien und Ordner verwalten

### 5.1 Ordner anzeigen und auswählen

In der Dateiliste erscheinen Ordner als aufklappbarer Baum. Ein Pfeil links am Ordner klappt seinen Inhalt auf bzw. zu. Wenn du einen Ordner auswählst, kann dieser als Zielordner für neue Dateien und Importe dienen.

Der Aufklappzustand wird **projektbezogen lokal gespeichert**. Auch nach einem Neuladen bleibt die Ordneransicht dadurch erhalten. Der gestrichelt gerahmte Minus-Button im Kopf von **DATEIEN** klappt alle aufgeklappten Ordner ein.

### 5.2 Neue Datei

1. Öffne `+` neben **DATEIEN**.
2. Wähle **Neue Datei**.
3. Gib den Dateinamen und den Zielordner an.
4. Bestätige mit **Datei erstellen**.

Beispiele:

- `Ideen.md` – Markdown mit vier Ansichten.
- `index.html` – HTML im Script-Editor mit Vorschau.
- `app.js` – JavaScript mit Script-Editor und Funktionsübersicht.
- `style.css` – CSS im Script-Editor.
- `config.json` – JSON im Script-Editor.

Wenn du **keine Dateiendung** angibst, ergänzt die App `.md`. Eine neue Markdown-Datei bekommt automatisch eine H1-Überschrift. Neue Dateien müssen einem unterstützten Textformat entsprechen; Binärdateien importierst du stattdessen.

### 5.3 Neuer Ordner

1. Öffne `+` → **Neuer Ordner**.
2. Wähle den übergeordneten Ordner aus.
3. Trage einen Namen oder einen relativen Unterpfad ein, etwa `src/components`.
4. Wähle **Ordner erstellen**.

### 5.4 Datei umbenennen oder verschieben

1. Öffne die Datei in der Dateiliste.
2. Klicke oben auf **Umbenennen**.
3. Ändere den **Dateinamen** und/oder den **Ordner**.
4. Speichere die Änderung.

Im selben Dialog kannst du die Datei über **Löschen** entfernen. Löschen ist über die integrierte Verlaufshistorie grundsätzlich rückgängig zu machen, solange der zugehörige Verlauf noch verfügbar ist.

### 5.5 Ordner umbenennen oder löschen

1. Klicke beim Ordner auf `⋯`.
2. Der Dialog **Ordner verwalten** wird geöffnet.
3. Ändere den Namen und bestätige **Umbenennen**, oder verwende den Lösch-Button.

Der Lösch-Button richtet sich nach dem Inhalt:

- **Leeren Ordner löschen** erscheint, wenn keine Dateien und keine Unterordner vorhanden sind.
- **Ordner löschen** erscheint bei nicht leeren Ordnern. Vor dem Löschen von Dateien und Unterordnern erscheint eine **Sicherheitsabfrage**.

Eine solche Ordnerlöschung kann in der laufenden Sitzung über **Rückgängig** wiederhergestellt werden.

### 5.6 Dateitypen und Anzeigen

| Datei | Anzeige/Bearbeitung |
|---|---|
| `.md`, `.markdown` | Markdown, Mindmap, Kanban und Kalender |
| `.html`, `.htm`, `.xhtml` | Script und HTML-Vorschau |
| `.svg` | Script und SVG-Vorschau |
| `.js`, `.mjs`, `.cjs`, `.jsx` | Script und **Functions**-Ansicht |
| `.css`, `.json`, `.xml` und viele weitere Textformate | Script-Editor |
| PNG, JPG, GIF, WebP usw. | Bildansicht |
| MP3, WAV, OGG und weitere unterstützte Audioformate | Audioplayer |
| Andere Binärdateien | Dateiansicht mit Namen und Größe; kein integrierter Quelltexteditor |

Die konkrete Wiedergabe bzw. Anzeige eines Medienformats hängt zusätzlich vom Browser ab.

## 6. Dateien importieren, exportieren und teilen

### 6.1 Das `+`-Dropdown

| Menüpunkt | Funktion |
|---|---|
| **Neue Datei** | Text-/Markdown-Datei im Projekt erstellen |
| **Neuer Ordner** | Ordner oder Unterordner erstellen |
| **Dateien hochladen** | Eine oder mehrere lokale Dateien übernehmen |
| **Aus Zwischenablage** | Text, HTML, Bilder oder andere unterstützte Zwischenablage-Inhalte als Datei einfügen |
| **ZIP importieren** | ZIP als neues Projekt oder in einen vorhandenen Workspace importieren |

Dateien können je nach Zielbereich auch per Drag-and-drop importiert werden.

### 6.2 Dateien hochladen

1. Wähle `+` → **Dateien hochladen**.
2. Markiere eine oder mehrere Dateien.
3. Wähle im Importdialog den **Zielordner**.
4. Entscheide, wie Namenskonflikte behandelt werden.
5. Starte den Import.

Bei bestehenden Dateinamen stehen diese Strategien zur Verfügung:

- **Automatisch umbenennen:** Eine neue eindeutige Variante erstellen.
- **Ersetzen:** Die bereits vorhandene Datei durch den Import ersetzen.
- **Überspringen:** Eine kollidierende Datei nicht importieren.

Ein Mehrdatei-Import wird als gemeinsame Dateitransaktion behandelt und kann gebündelt rückgängig gemacht werden.

### 6.3 Zwischenablage als Datei einfügen

Öffne `+` → **Aus Zwischenablage**. Je nach Inhalt und Browserberechtigung liest die App die Zwischenablage direkt oder fordert dich auf, den Inhalt über **Strg+V** beziehungsweise **⌘V** in ein Eingabefeld einzufügen.

Im Dialog **Zwischenablage als Datei einfügen**:

1. Überprüfe die Text- oder Bildvorschau.
2. Wähle einen Zielordner.
3. Prüfe bzw. ändere den Dateinamen.
4. Lege die Strategie bei einer vorhandenen Datei fest.
5. Klicke auf **Datei einfügen**.

Das Dateinamenfeld hat eine **Datalist**, die bereits existierende Dateien **aus dem gewählten Zielordner** und **mit der bevorzugten Dateiendung des Zwischenablageinhalts** anbietet.

**HTML-Sonderfall:** Wenn HTML eingefügt wird und im Zielordner noch keine HTML-Datei vorhanden ist, wird automatisch `index.html` vorgeschlagen. Manuell eingetragene Namen werden nicht ungefragt überschrieben.

### 6.4 ZIP importieren

1. Öffne `+` → **ZIP importieren** und wähle eine ZIP-Datei.
2. Entscheide zwischen **Neues Projekt** und **In aktuellen Workspace**.
3. Beim Import in den aktuellen Workspace wähle einen Zielordner und die Konfliktstrategie.
4. Falls angeboten, kannst du den einzigen obersten ZIP-Ordner entfernen.
5. Bestätige **ZIP importieren**.

Der ZIP-Import übernimmt Dateien, Ordner und – soweit die passende mindfagg-Metadatendatei im Archiv enthalten ist – zusätzliche Projektinformationen. Der Import als neues Projekt legt ein separates Projekt an.

### 6.5 Dateien herunterladen

Öffne das `⋯`-Dropdown im Kopfbereich **DATEIEN**. Der Tooltip lautet **Download**.

- **ZIP herunterladen:** Exportiert den gesamten aktuellen Workspace als ZIP, einschließlich der gespeicherten Projektmetadaten und vorhandenen Ordner.
- **Aktuelle Datei herunterladen:** Lädt die geöffnete Datei im Originalformat herunter. Im Menü steht unter dieser Aktion der **tatsächliche Dateiname**, beispielsweise `index.html`.

Das ZIP-Archiv dient auch als Datensicherung und zum Übertragen des Projekts auf einen anderen Browser bzw. ein anderes Gerät.

### 6.6 Dateien teilen

Der Button **Teilen** steht in der Sidebar unmittelbar vor **Patch-Tool**.

1. Klicke auf **Teilen**.
2. Wähle eine Versandart:
   - **Als ZIP:** Alle markierten Dateien kommen in ein ZIP, mitsamt der erforderlichen Verzeichnisstruktur und Import-Metadaten.
   - **Als Einzeldateien:** Die markierten Dateien werden als separate Dateien über die Systemfreigabe angeboten.
3. Wähle die gewünschten Dateien mit den Checkboxen aus.
4. Klicke auf **Teilen**.

Im Dialog gibt es folgende Auswahlhilfen:

- **Alle wählen** oberhalb der gesamten Liste: alle Projektdateien aktivieren oder abwählen.
- **Alle wählen** an jeder Verzeichnisüberschrift: alle Dateien dieses Verzeichnisses aktivieren oder abwählen.
- Eine **eigene Checkbox pro Datei**.
- Gruppenüberschriften mit den zugehörigen Pfaden, etwa `root (Wurzel)`, `src`, `assets/images`.
- Die **Dateigröße** neben jeder Datei.
- Unter der Liste: **X von Y gewählt** und **Gesamtgröße** der gewählten Dateien.

Bei teilweise ausgewählten Gruppen zeigen die Sammel-Checkboxen einen Zwischenzustand. Wenn keine Datei ausgewählt ist, ist die Teilen-Aktion deaktiviert.

**Hinweis zum Einzelversand:** Das System-Teilen von Einzeldateien erhält die Verzeichnisstruktur nicht automatisch. Deshalb erhalten gleichnamige Dateien aus verschiedenen Ordnern unterscheidbare Namen mit Pfadpräfix. Wenn die Web-Share-Funktion nicht verfügbar ist, startet mindfagg stattdessen Downloads; je nach Browser können mehrere Downloads genehmigt werden müssen.

Im Dialog befindet sich zusätzlich **Patch-Phrase kopieren**, links neben **Abbrechen**. Der Button kopiert dieselbe KI-Anweisung wie im Patch-Tool.

## 7. Markdown-Dateien und Syntax

### 7.1 Grundidee

Bei Markdown-Dateien ist der **Markdown-Text die Datenquelle**. Aus ihm erzeugt die App Mindmap, Kanban und Kalender. Änderungen in diesen Ansichten werden wieder auf Markdown übertragen.

Für eine gültige Mindmap-Struktur benötigt eine Markdown-Datei **genau eine H1-Überschrift** (eine Zeile beginnend mit `# `). Diese bildet den Root-Knoten. Weitere Überschriften und Listen bilden die Unterknoten.

### 7.2 Beispiel eines vollständigen Dokuments

```markdown
# Mein Projekt
Eine kurze Beschreibung des Projekts.

## [status:doing] Entwicklung
- [x] Repository vorbereiten
- [ ] [status:todo] HTML-Seite erstellen
- [ ] [status:review] Layout prüfen

## [status:done] Planung
- [x] Anforderungen erfassen

## Termine
- [ ] [date:2026-11-10] Projektstart
- [ ] [date:2026-11-15 +14d] Meilenstein

## Dokumentation
Siehe [[Technik]] oder [[Technik#Installation]].
```

**Hinweis:** Die App unterstützt `y` (Jahre), `m` (Monate) und `d` (Tage) als Dauer-Einheiten, **nicht** `w` für Wochen. Für zwei Wochen verwendest du deshalb `+14d`.

### 7.3 Überschriften und Listen

```markdown
# Root
## Themengebiet
### Unterthema
- Listenpunkt
  - Unterpunkt
1. Nummerierter Punkt
```

- `#` bis `######` stehen für Überschriftenebenen H1 bis H6.
- `-`, `+` oder `*` kennzeichnen ungeordnete Listen.
- `1.` oder `1)` kennzeichnen nummerierte Listen.
- Einrückungen definieren Unterlisten.

### 7.4 Aufgaben-Checkboxen

```markdown
- [ ] Noch offen
- [x] Erledigt
```

Erledigte Aufgaben beeinflussen die Fortschrittsanzeige der Knoten. Bei übergeordneten Knoten wird der Fortschritt aus ihren Unterknoten ermittelt.

### 7.5 Status

```markdown
## [status:story] Idee
- [ ] [status:todo] Neue Aufgabe
- [ ] [status:doing] In Arbeit
- [ ] [status:review] Wird geprüft
- [x] [status:done] Fertig
```

Die fünf technischen Kennungen sind:

| Kennung | Standardbezeichnung |
|---|---|
| `story` | Story |
| `todo` | To Do |
| `doing` | In Progress |
| `review` | Review |
| `done` | Done |

Die sichtbaren Namen und Farben kannst du in den **Projekteinstellungen** ändern.

### 7.6 Datum und Dauer

```markdown
- [date:2026-11-10] Ein einzelner Tag
- [date:2026-11-10 +3d] Zeitraum von drei Tagen
- [date:2026-11-10 +2m] Zeitraum von zwei Monaten
- [date:2026-11-10 +1y +2m +3d] Gemischte Dauer
```

Syntax: `[date:YYYY-MM-DD +<Anzahl>y +<Anzahl>m +<Anzahl>d]` mit optionalen positiven Dauerkomponenten. Jede Einheit darf höchstens einmal vorkommen. Ohne Dauer wird der Knoten an einem einzigen Datum angezeigt.

### 7.7 Wiki-Verknüpfungen

```markdown
[[Technik]]
[[Technik#Installation]]
[[Technik|Mehr erfahren]]
```

Links dieser Art können auf andere Markdown-Dokumente im aktuellen Projekt und optional auf Überschriften innerhalb dieser Dokumente verweisen. Die Namen müssen zum Zieldokument passen.

### 7.8 Ungültige Markdown-Strukturen

Wenn keine H1 oder mehrere H1-Überschriften vorhanden sind, markiert die App dies im Editor und kann den betroffenen Inhalt nicht als gültige Mindmap auswerten. Verwende die Validierungsanzeige, um zur problematischen Zeile zu springen. Der Markdown-Quelltext bleibt weiterhin editierbar und gespeichert.

## 8. Markdown-Editor

### 8.1 Bearbeitung

Öffne eine `.md`-Datei und wähle **Markdown**. Der Editor enthält:

- eine Quelltextfläche mit Syntaxhervorhebung;
- eine Zeilennummern-Spalte links;
- eine **Scroll-Minimap** rechts;
- direkt bedienbare Marker für Checkboxen, Status und Datumsangaben;
- eine Toolbar für häufige Markdown-Operationen;
- eine Anzeige zur H1-Validierung.

### 8.2 Toolbar

| Bedienelement | Zweck |
|---|---|
| `H ▾` | Überschriftenebene H2 bis H6 für markierte Zeilen einstellen |
| `⇤` | Listenpunkt/Teilbaum ausrücken |
| `⇥` | Listenpunkt/Teilbaum einrücken |
| `-` | Listenmarker ein-/ausschalten |
| `☐` | Checkbox ein-/ausschalten |
| **Status ▾** | Status für den gewählten Knoten setzen |
| **Link** | Wiki-Verknüpfung einfügen |

**Enter** setzt passende Listen fort. **Tab** und **Umschalt+Tab** steuern die Einrückung.

### 8.3 Autovervollständigung

Die Autovervollständigung unterstützt unter anderem:

- `/` für Schnelleingaben;
- `[[` für Dokumentverknüpfungen;
- `[status:` für Statusmarker.

In der Vorschlagsliste navigierst du mit den Pfeiltasten und übernimmst Vorschläge mit **Enter** oder **Tab**.

### 8.4 Direkte Knotenbearbeitung

Die App erlaubt die direkte Bedienung von Aufgabenmarkern im Quelltext. Ein Klick auf eine Checkbox schaltet ihren Wert um; Status- und Datumselemente können über ihre zugehörigen Bedienelemente geändert werden. Über markierte Knoten lässt sich zusätzlich der ausführliche Knotendialog öffnen.

### 8.5 Minimap und Syntaxfehler

Die Minimap gibt einen Überblick über die Datei und kann zur Navigation bzw. zum Scrollen verwendet werden. **Fehlerhafte Zeilen erscheinen sowohl im Editor als auch als rote Markierungen in der Minimap.** Die Anzeige kann in den App-Einstellungen ein- und ausgeschaltet werden.

### 8.6 Code Folding

Über **App-Einstellungen → Code Folding aktivieren** lassen sich beispielsweise Überschriftenbereiche, Listen und Codeblöcke einklappen. Das verbirgt nur die Darstellung: Der vollständige Dateiinhalt bleibt für Speichern, Export und Undo erhalten. Code Folding ist standardmäßig **deaktiviert**.

## 9. Mindmap

### 9.1 Mindmap öffnen

Öffne eine gültige Markdown-Datei und wechsle auf **Mindmap**. Die H1 bildet den Root; Überschriften und Listenpunkte erscheinen als verknüpfte Unterknoten. Knoten können Statusfarben, Checkbox-Fortschritt und einen Typmarker tragen.

### 9.2 Navigation

- **Knoten anklicken:** Knoten auswählen.
- **Doppelklick auf Knotentext:** Titel direkt bearbeiten.
- **Leeren Hintergrund ziehen:** Die Mindmap verschieben (*Pan*).
- **Mausrad bzw. Zwei-Finger-Geste:** Die Darstellung zoomen.
- **Alle Knoten einpassen:** Die Karte passend in den sichtbaren Bereich skalieren.

### 9.3 Knoten erstellen, bearbeiten und umordnen

Wähle einen Knoten aus. Die Aktionsleiste bietet **Unterknoten hinzufügen** und **Knoten auf gleicher Ebene hinzufügen**. Zusätzlich stehen je nach Kontext Bearbeitungs-, Kopier-, Einfüge- und Löschfunktionen zur Verfügung.

Knoten können per Drag-and-drop **umgeordnet** oder an einen anderen Elternknoten gehängt werden. Das verändert die zugrunde liegende Markdown-Struktur.

Der gemeinsame **Knoten bearbeiten**-Dialog unterstützt unter anderem:

- Titel und Typ (Überschrift oder Listenpunkt);
- Status und Aufgaben-Checkbox;
- Datumsangaben und Dauer;
- Beschreibung in Markdown;
- Dokumentverknüpfungen.

### 9.4 Unterknoten einklappen

Bei Knoten mit Kindern befindet sich ein Fold-Button. Er klappt den jeweiligen Teilbaum ein oder aus; im eingeklappten Zustand wird die Anzahl unmittelbarer Unterknoten angezeigt.

Über die beiden zentralen Bedienelemente `−` und `+` kannst du **alle Unterknoten einklappen oder ausklappen**. Diese Funktion ist von der Ordneransicht in der Sidebar unabhängig.

Der Mindmap-Fold-Zustand wird pro Dokument gespeichert. Ein Ansichtswechsel oder erneutes Laden setzt ihn nicht automatisch zurück.

## 10. Kanban und Tierlist

### 10.1 Kanban öffnen

Öffne eine gültige Markdown-Datei und wähle **Kanban**. Die Ansicht sortiert Knoten anhand ihrer Statusmarker in fünf Gruppen: Story, To Do, In Progress, Review und Done (bzw. die projektspezifischen Bezeichnungen).

### 10.2 Scope wählen

In der Kanban-Kopfleiste lässt sich auswählen, welche Knoten angezeigt werden:

- **Alle Knoten:** Überblick über den gesamten Markdown-Baum.
- **Ein bestimmter Elternknoten:** Seine unmittelbaren Unterknoten anzeigen.

Bei der eingeschränkten Scope-Ansicht werden in der Story-Gruppe nur als Aufgaben erkennbare Knoten angezeigt.

### 10.3 Tickets bearbeiten

- **Ticket anklicken:** Öffnet den Knotendialog.
- **Unterknoten:** Bei passenden Tickets führt ein entsprechender Button in die Unterstruktur.
- **Länger drücken und ziehen:** Ticket in eine andere Statusgruppe bewegen.

Eine Verschiebung in eine andere Statusgruppe ändert den Statusmarker im Markdown, nicht die generelle Reihenfolge des zugrunde liegenden Knotenbaums.

### 10.4 Tierlist

Über den Button **Tierlist** schaltest du zwischen klassischem Kanban-Spaltenlayout und einem zeilenbasierten Layout um. Die gewünschte Darstellung wird lokal gespeichert und beim nächsten Aufruf wiederhergestellt.

## 11. Kalender

### 11.1 Kalender öffnen

Wähle bei einer Markdown-Datei **Kalender**. Angezeigt werden Knoten mit gültigen `[date:...]`-Markern.

### 11.2 Monatsübersicht

- Pfeil links/rechts: Vorherigen bzw. nächsten Monat öffnen.
- **Heute:** Zum aktuellen Monat zurückkehren.
- Datum anklicken: Tagesagenda anzeigen.
- Eintrag anklicken: Zugehörigen Knoten bearbeiten.

Ein Knoten mit einer Dauer wird an allen betroffenen Kalendertagen berücksichtigt. Auf kleinen Bildschirmen kann die Tagesbelegung kompakter durch Markierungspunkte statt ausführlicher Titel erscheinen.

### 11.3 Tagesagenda

Unter dem Monatsraster listet die Agenda die Einträge für den ausgewählten Tag. Dort kannst du den Knotendialog öffnen und zum Beispiel Datum, Status oder Beschreibung ändern.

**Hinweis:** Der Kalender liest Datumsinformationen aus dem aktuellen Markdown-Dokument; er ist kein externer Kalenderdienst.

## 12. Script-Editor und Dateivorschauen

### 12.1 Script-Editor

Öffne eine Textdatei, die keine Markdown-Datei ist, z. B. `index.html`, `app.js`, `style.css` oder `config.json`. Sie erscheint in der Registerkarte **Script**.

Der Script-Editor stellt Syntaxhervorhebung, Zeilennummern, Scroll-Minimap und – für unterstützte Dateitypen – Fehlermarkierungen bereit. **Syntaxfehler werden auch in der Minimap rot markiert.** Über die App-Einstellungen sind Zeilennummern, Wordwrap, Minimap und Code Folding konfigurierbar.

### 12.2 Einfügen/Ersetzen aus der Zwischenablage

In der Script-Toolbar befindet sich **Einfügen ▾**:

- **Einfügen:** Fügt den Text aus der Zwischenablage an der aktuellen Cursorposition bzw. über die aktuelle Markierung ein.
- **Ersetzen:** Ersetzt den **gesamten Dateiinhalt** durch den Zwischenablage-Text.

Beide Aktionen verwenden die Editor-Historie und die automatische Speicherung. Für den direkten Zwischenablagezugriff sind je nach Browser HTTPS, localhost und eine entsprechende Berechtigung notwendig. Andernfalls ist normales Einfügen mit **Strg+V / ⌘V** möglich.

### 12.3 Suchen und Ersetzen

Über **Suchen & Ersetzen** öffnest du eine Suchleiste:

- Suchtext eingeben; Groß-/Kleinschreibung bei Bedarf mit `Aa` beachten.
- Mit den Pfeilen zum vorherigen oder nächsten Treffer springen.
- Den Ersetzen-Bereich über den Pfeil links ausklappen.
- **Ersetzen** für den aktuellen Treffer oder **Alle ersetzen** verwenden.

Die Suche akzeptiert mehrzeilige Texte; **Umschalt+Enter** fügt im Suchfeld einen Zeilenumbruch ein. **Escape** schließt die Suche. Reguläre Ausdrücke (Regex) werden nicht unterstützt.

### 12.4 Pretty Code

Die Schaltfläche **`{ } Pretty Code`** formatiert unterstützte Formate wie HTML, CSS, JavaScript, XML und SVG lokal und ohne externe Formatierungsdienste.

Bei JavaScript wird vor und nach der Formatierung eine Syntax-/Strukturprüfung verwendet, damit keine offensichtlich semantikverändernde Formatierung gespeichert wird. Dies ist ein integrierter, konservativer Formatter und **kein vollständiger Prettier-Ersatz**.

### 12.5 Functions-Ansicht

Bei JavaScript-Dateien erscheint zusätzlich die Registerkarte **Functions**. Sie bietet:

- eine Übersicht der erkannten **Funktionen**;
- eine Übersicht der erkannten **Event-Handler**;
- ein Suchfeld zum Filtern;
- anklickbare Einträge, um im Script zur Fundstelle zu springen.

### 12.6 HTML-Vorschau

Für HTML-Dateien gibt es eine Registerkarte **Vorschau**. Die Vorschau kann andere im aktuellen Projekt vorhandene Dateien wie CSS, JavaScript, Bilder und Medien über virtuelle Projektpfade einbinden. Sie enthält unter anderem:

- **Zurück** für die Navigation zwischen lokalen HTML-Seiten innerhalb der Vorschau;
- **Neu laden**;
- **Konsole** mit Fehler-/Logausgaben;
- **Vollbild**.

**Sicherheit:** HTML-Inhalte werden standardmäßig isoliert ausgeführt. Die Option **App-Einstellungen → HTML-Vorschau · Sicherheit → localStorage und IndexedDB erlauben** ist standardmäßig deaktiviert und sollte **nur bei vollständig vertrauenswürdigen HTML-Dateien** aktiviert werden: Mit der Freigabe können Skripte in der Vorschau auf Daten desselben App-Ursprungs zugreifen, einschließlich Projektdateien und gespeicherter GitHub-Zugangsdaten.

### 12.7 SVG, Bilder, Audio und Binärdateien

- **SVG:** Quelltext in **Script**, Bilddarstellung in **Vorschau**.
- **Bilder:** Bildansicht mit Dateiname und Größe.
- **Audio:** Wiedergabe über den nativen Browser-Audioplayer.
- **Sonstige Binärdateien:** Informationsansicht; keine freie Binärbearbeitung im integrierten Editor.

Über **Download → Aktuelle Datei herunterladen** lässt sich auch eine solche Datei einzeln exportieren.

## 13. Patch-Tool und KI-Prompt

### 13.1 Zweck

Das **Patch-Tool** führt genau beschriebene Änderungen auf Projektdateien aus. Das Patch-Format ist **JSON**, nicht das herkömmliche textuelle Unified-Diff-Format. Es eignet sich auch für Änderungen, die von einer KI nach einer festgelegten Anweisung erzeugt wurden.

Du öffnest es über den Button **Patch-Tool** in der Sidebar. Der Dialog ist in zwei Bereiche aufgeteilt:

- **Einspielen:** JSON eingeben/laden, prüfen, Vorschau ansehen und selektiv anwenden.
- **Erstellen:** Eine fertige **Patch-Phrase** für einen KI-Prompt kopieren.

### 13.2 Patch einlesen

Es gibt vier Wege:

1. JSON direkt in **JSON-Patch einfügen** schreiben oder einfügen.
2. **Aus Zwischenablage einfügen** anklicken.
3. Über **JSON-Datei auswählen** eine `.json`-Datei öffnen oder eine solche Datei in die Dropzone ziehen.
4. **Patch aus dem Projekt (.patch.json)** auswählen und **Laden** drücken.

Es werden nur Dateien akzeptiert, die das definierte JSON-Patch-Format erfüllen. Für das Patch-JSON gilt eine Größenbegrenzung von **4 MB** und für die auswählbaren Operationen/Hunks eine Grenze von **500**.

### 13.3 Patch prüfen und Vorschau aktualisieren

Nach Änderungen am JSON erscheint der **rote, anklickbare Text**:

> Patch prüfen, um die Vorschau zu aktualisieren.

Klicke darauf, um den Patch zu validieren und die Vorschau zu erzeugen. Ein separater „Patch prüfen“-Button existiert in v49 nicht mehr.

Wird das JSON abgelehnt, erscheint eine Meldung **`Patch abgelehnt: …`**. Diese Fehlermeldung ist anklickbar und kann dadurch **vollständig in die Zwischenablage kopiert** werden. Sie ist auch mit der Tastatur über Enter oder Leertaste bedienbar.

### 13.4 Vorschau und Auswahl

Jeder Datei-/Operationsblock der Vorschau ist standardmäßig **eingeklappt**. Klicke auf seine Kopfzeile, um die einzelnen Vorgänge und gegebenenfalls `search`/`replace`-Inhalte einzublenden.

Im Kopf stehen:

- der **Dateipfad** und gegebenenfalls der Zielpfad;
- die optionale Beschreibung;
- der **Operationstyp**;
- `patch / found / total`.

Die drei Zahlen bedeuten:

| Wert | Bedeutung |
|---|---|
| **patch** | Aktuell ausgewählte Vorgänge/Hunks |
| **found** | Im vollständig simulierten Patch anwendbare Treffer |
| **total** | Insgesamt erwartete Vorgänge/Hunks laut JSON |

Jede `update`-Operation kann mehrere Hunks enthalten. Jeder Hunk hat eine Checkbox; bei `create`, `replace`, `rename` und `delete` wird die jeweilige Operation insgesamt an- oder abgewählt. Standardmäßig ist alles ausgewählt.

**Vor dem Einspielen** wird geprüft, ob die ausgewählten Vorgänge gemeinsam ausführbar sind. Schlägt ein benötigter Suchtreffer fehl oder entsteht ein Pfadkonflikt, werden die Änderungen nicht teilweise gespeichert. Die Operationen werden in der **Reihenfolge des JSON** auf einem simulierten Dateistand verarbeitet und anschließend in einer gemeinsamen Speichertransaktion übernommen.

### 13.5 Patch anwenden und speichern

1. Prüfe die Vorschau und deaktiviere bei Bedarf einzelne Vorgänge.
2. Setze optional das Häkchen **Patch speichern**.
3. Klicke auf **Ausgewählte Vorgänge einspielen**.

Mit **Patch speichern** wird der tatsächlich ausgewählte Patch nach erfolgreicher Anwendung im Projekt-Root gespeichert, mit einem Namen im Format:

```text
YYYY-MM-DD-HHmmss.patch.json
```

Beispiel: `2026-11-07-H043015.patch.json`.

**Wichtig:** Die Datei enthält die **ausgewählten** Änderungen, nicht automatisch alle ursprünglich im JSON enthaltenen Hunks. Patch-Anwendung und optional gespeicherte Patch-Datei gehören zu **einem gemeinsamen Undo-/Redo-Schritt**.

### 13.6 Patch-Operationen

| `operation` | Zweck | Pflichtfelder neben `operation` |
|---|---|---|
| `create` | Neue Textdatei anlegen | `file`, `content` |
| `update` | Eine oder mehrere exakte Textstellen ändern | `file`, `hunks` |
| `replace` | Ganze bestehende Textdatei ersetzen | `file`, `content` |
| `rename` | Datei umbenennen oder verschieben | `file`, `to` |
| `delete` | Datei entfernen | `file` |

`description` ist eine optionale, nicht leere Beschreibung. Die Dateipfade sind **relativ zum Projekt-Root**, enthalten `/` als Trenner und dürfen keine ungültigen Pfade wie `../` verwenden.

Bei `update` besteht jeder Hunk aus **genau**:

- `search`: nicht leerer, exakt zu findender Text, einschließlich Einrückung;
- `replace`: Ersatztext; darf leer sein;
- `occurrence`: positive, **1-basierte** Nummer des gesuchten, nicht überlappenden Treffers.

Der Editor führt **wortwörtliche Suchen**, keine regulären Ausdrücke, aus. `create`, `update` und `replace` verarbeiten Textdateien; `rename` und `delete` können auch auf Binärdateien angewendet werden.

### 13.7 Vollständiges JSON-Beispiel

```json
{
  "patches": [
    {
      "operation": "create",
      "file": "src/hello.js",
      "description": "Neue Beispiel-Datei",
      "content": "const name = 'Welt';\nconsole.log(name);\n"
    },
    {
      "operation": "update",
      "file": "index.html",
      "description": "Überschrift ändern",
      "hunks": [
        {
          "search": "<h1>Alte Überschrift</h1>",
          "replace": "<h1>Neue Überschrift</h1>",
          "occurrence": 1
        }
      ]
    },
    {
      "operation": "replace",
      "file": "assets/notice.txt",
      "content": "Der vollständige neue Inhalt.\n"
    },
    {
      "operation": "rename",
      "file": "src/old-name.js",
      "to": "src/new-name.js",
      "description": "Datei umbenennen"
    },
    {
      "operation": "delete",
      "file": "src/unused.js",
      "description": "Nicht mehr benötigt"
    }
  ]
}
```

Dieses Beispiel ist nur vollständig anwendbar, wenn die referenzierten **bestehenden** Dateien vorhanden sind, die angegebenen Suchtexte stimmen und die Zielpfade frei sind.

### 13.8 Patch mit einer KI erzeugen

1. Öffne **Patch-Tool** → **Erstellen**.
2. Klicke auf **Phrase kopieren**. Alternativ im Teilen-Dialog auf **Patch-Phrase kopieren**.
3. Ergänze deinen Prompt um diese Anweisung.
4. Stelle der KI die **betroffenen Originaldateien** bereit, insbesondere für wortwörtliche `update`-Ersetzungen.
5. Kopiere das von der KI erzeugte JSON in das Patch-Tool und **prüfe die Vorschau sorgfältig**.

Die Phrase fordert ausschließlich gültiges JSON, das definierte Operationsformat, exakte Projektpfade und korrektes Escaping an, insbesondere `\"` für Anführungszeichen, `\\` für Backslashes und `\n` für Zeilenumbrüche **innerhalb von JSON-Strings**.

**Abwärtskompatibilität:** Ältere v44-Patches ohne Feld `operation` werden als `update` interpretiert, sofern sie die erwarteten Legacy-Felder erfüllen.

## 14. GitHub-Zugang und Repository-Synchronisation

### 14.1 Token anlegen

1. Öffne über das **mindfagg-Logo** die **App-Einstellungen**.
2. Scrolle zu **GitHub-Zugangsdaten**.
3. Erstelle bei GitHub einen **Fine-grained Personal Access Token** mit Zugriff auf die gewünschten Repositories.
4. Gib für **Contents** die Berechtigung **Read and write** frei.
5. Füge den Token in das Eingabefeld ein und wähle **Token prüfen und speichern**.

Der Token wird zunächst gegen die GitHub-API geprüft und anschließend **verschlüsselt im lokalen Browserspeicher** abgelegt. Er wird **nicht** in Projekt-ZIP-Dateien exportiert.

**Sicherheitsgrenze:** Die Verschlüsselung schützt vor Klartextablage. Skripte mit Zugriff auf den App-Ursprung können unter Umständen trotzdem auf die Daten zugreifen. Benutze einen vertrauenswürdigen HTTPS-/localhost-Ursprung und aktiviere Speicherzugriff für HTML-Vorschauen nur bewusst.

### 14.2 Repository zuordnen

Nach dem Speichern eines gültigen Tokens wird der **Repository-Button** in der Sidebar angezeigt.

1. Öffne das gewünschte Projekt.
2. Klicke auf **Repository zuordnen** oder öffne die Zuordnung in den Projekteinstellungen.
3. Trage ein Repository als `owner/repo` ein oder wähle es aus der nativen **Datalist**.
4. Wähle den gewünschten **Branch**; der Standard ist `main`.
5. Klicke auf **Repository verbinden** beziehungsweise **Zuordnung prüfen**.

Die Datalist wird über GitHub geladen und kann Repositories anzeigen, für die der Token Zugriff hat. Die Auswahl ist nicht auf diese Vorschläge beschränkt: `owner/repo` kann auch manuell eingegeben werden. Ein Link zum Erstellen eines neuen GitHub-Repositories ist im Dialog vorhanden.

Jedes mindfagg-Projekt kann eine eigene Repository-/Branch-Zuordnung besitzen, während derselbe gespeicherte Token projektübergreifend verwendet wird.

### 14.3 Dateien synchronisieren

Klicke auf den Repository-Button in der Sidebar oder im Zuordnungsdialog auf **Jetzt synchronisieren**. Die App vergleicht den lokalen Dateistand mit dem Repository und berücksichtigt die bekannte gemeinsame Basis des vorherigen Abgleichs.

Daraus ergeben sich unter anderem:

- nur **lokale Änderungen**, die nach GitHub übertragen werden können;
- nur **entfernte Änderungen**, die lokal übernommen werden können;
- **Dateikonflikte**, wenn beide Versionen geändert wurden.

Der Status des Repository-Buttons gibt an, ob zum Beispiel Änderungen, Konflikte oder Verbindungsfehler bestehen. Offline-/API-Fehler führen nicht dazu, dass lokale Änderungen automatisch verworfen werden. Es erfolgt kein Force-Push.

### 14.4 Dateikonflikte entscheiden

Bei Konflikten öffnet die App einen eigenen Dialog mit einem Eintrag je Datei. Er zeigt unter anderem Dateipfad, Grund des Konflikts, Dateigrößen und Änderungszeitangaben.

Für jeden Konflikt kannst du wählen:

- **Noch nicht entscheiden:** Diese Konfliktdatei vorerst unverändert lassen.
- **Lokale Version behalten:** Den lokalen Stand bevorzugen.
- **GitHub-Version behalten:** Den GitHub-Stand bevorzugen.

Mit **Alle lokal** oder **Alle GitHub** kannst du alle Konfliktentscheidungen gleichzeitig vorbelegen. Bei einem Upload lässt sich auch die **Commit-Nachricht** eingeben. Mit **Auswahl übernehmen und synchronisieren** wird die Entscheidung angewendet.

Eine offene GitHub-Synchronisationsoperation kann den Dialog vorübergehend gegen versehentliches Schließen sperren.

### 14.5 Zuordnung oder Zugang entfernen

- **Zuordnung entfernen** im Repository-Dialog entfernt die Verknüpfung **für das aktuelle Projekt**. Lokale Dateien bleiben erhalten.
- **Zugang entfernen** in den App-Einstellungen entfernt die gespeicherten **GitHub-Zugangsdaten**. Danach wird der Repository-Button ausgeblendet, bis wieder ein gültiger Token hinterlegt wird.

## 15. App-Einstellungen

Öffne die Einstellungen durch Klicken auf das **mindfagg-Logo** oben links.

| Einstellung | Wirkung |
|---|---|
| **Schriftgröße** | Editor-Schrift zwischen 8 und 16 px; Standard Desktop 13 px, Mobil 16 px |
| **Wordwrap** | Lange Zeilen umbrechen statt horizontal scrollen |
| **Zeilennummern anzeigen** | Linke Zeilennummernspalte ein-/ausblenden |
| **Code Folding aktivieren** | Einklappbare Abschnitte im Markdown- und Script-Editor anzeigen; Standard aus |
| **Scroll Minimap anzeigen** | Navigierbare Minimap rechts neben dem Editor ein-/ausblenden |
| **HTML-Vorschau: localStorage und IndexedDB erlauben** | Speicherzugriff für HTML-Vorschauen erlauben; standardmäßig aus, sicherheitskritisch |
| **GitHub-Zugangsdaten** | Token prüfen, speichern oder entfernen |
| **Editor-Standardwerte wiederherstellen** | Editor-Einstellungen auf die Standardwerte zurücksetzen |

Die Editor-Einstellungen gelten **projektübergreifend** und werden lokal gespeichert. Verwende **← Workspace**, um zur vorherigen Arbeitsansicht zurückzukehren.

## 16. Navigation, Tastatur und Rückgängig

### 16.1 Rückgängig und Wiederherstellen

Oben in der Anwendung befinden sich zwei Historienbuttons. Sie machen unterstützte Datei-, Ordner-, Markdown- und Patch-Aktionen rückgängig oder stellen sie erneut her.

Beispiele:

- letzte Textänderung rückgängig machen;
- eine gelöschte Datei oder einen gelöschten Ordner wiederherstellen;
- eine mehrteilige Patch-Anwendung in **einem Schritt** zurücknehmen;
- bei aktiviertem „Patch speichern“ auch die erzeugte `.patch.json`-Datei im selben Schritt entfernen.

Die Undo-/Redo-Historie ist **keine dauerhafte Versionsverwaltung**. Nach dem Neustart sollte man sich nicht auf die Wiederherstellung gelöschter Inhalte verlassen.

### 16.2 Browser-Zurück-Taste

Ab v47 hat die Browser-/System-**Zurück**-Taste eine app-interne Bedeutung:

1. **Ist ein Dialog geöffnet:** Der Dialog wird geschlossen, soweit er nicht durch eine laufende Operation gesperrt ist.
2. **Ist kein Dialog geöffnet:** Die Sidebar wird umgeschaltet – auf Mobilgeräten geöffnet/geschlossen und auf Desktop ein-/ausgeblendet.

Die App richtet hierfür einen zusätzlichen Eintrag in der Browser-History ein. Das ist nicht dasselbe wie **Rückgängig**; Browser-Zurück verändert nicht den Dateiinhalt.

### 16.3 Verhalten von Dialogen

Ein normaler Klick auf den Hintergrund außerhalb eines Dialogs kann diesen schließen. Wenn die Textmarkierung **innerhalb** eines Eingabefelds beginnt und du die Maustaste **außerhalb** loslässt, soll sich der Dialog dagegen nicht versehentlich schließen. **Escape** schließt in den meisten Situationen ebenfalls den Dialog; laufende gesperrte Operationen können eine Ausnahme bilden.

### 16.4 Tastaturkurzbefehle

| Kürzel | Bereich | Funktion |
|---|---|---|
| **Strg+Z** | Global, außerhalb aktiver Eingabefelder | Rückgängig |
| **Strg+Umschalt+Z** oder **Strg+Y** | Global, außerhalb aktiver Eingabefelder | Wiederherstellen |
| **Strg/⌘+F** | Script-Editor | Suchen öffnen |
| **Strg/⌘+H** | Script-Editor | Suchen mit Ersetzen öffnen, soweit der Browser die Kombination verfügbar macht |
| **Enter** | Markdown-Editor | Listenpunkt fortsetzen |
| **Tab / Umschalt+Tab** | Markdown-Editor | Einrücken / Ausrücken |
| **Umschalt+Enter** | Script-Suchfeld | Zeilenumbruch in Suche/Ersatztext |
| **Escape** | Viele Dialoge und Suchleisten | Schließen |
| **+ / −** | Mindmap ohne aktive Texteingabe | Alle Unterknoten auf- bzw. einklappen |

Die Verfügbarkeit einzelner Kombinationen hängt vom aktiven Eingabefeld, Betriebssystem und Browser ab.

## 17. Datensicherung, Sicherheit und Fehlerbehebung

### 17.1 Empfohlene Sicherungsroutine

1. Öffne das gewünschte Projekt.
2. Wähle `⋯` → **ZIP herunterladen**.
3. Bewahre das ZIP an einem Ort außerhalb des Browsers auf.
4. Wiederhole den Export vor größeren Änderungen, nach wichtigen Arbeitsschritten und **vor jedem App-Update**.
5. Teste gelegentlich, ob sich das ZIP über **ZIP importieren** wieder einlesen lässt.

Ein GitHub-Abgleich kann zusätzlich helfen, ersetzt aber keine geprüfte Datensicherung.

### 17.2 Sicherheitsregeln

- Speichere GitHub-Tokens nur in einer vertrauenswürdigen Umgebung.
- Teile Projekt-ZIPs nur mit Personen, die die enthaltenen Dateien erhalten sollen.
- Prüfe KI-generierte JSON-Patches **vor** dem Einspielen; insbesondere `delete`, `replace` und mehrere aufeinanderfolgende Operationen.
- Aktiviere **Speicherzugriff in der HTML-Vorschau** nur für vollständig vertrauenswürdigen Quelltext.
- Installiere Updates über die bestehende App-Ordnerstruktur und halte Sicherungen bereit.

### 17.3 Häufige Probleme

| Problem | Prüfung / Lösung |
|---|---|
| **Meine Projekte sind weg** | Browserprofil, Speicher-Ursprung und private Sitzung prüfen; gegebenenfalls letztes ZIP importieren. |
| **Änderungen werden nicht gespeichert** | Speicherstatus oben beachten, freien Browserspeicher und Konsolenfehler prüfen. |
| **GitHub-Button fehlt** | Unter App-Einstellungen prüfen, ob ein gültiger Access Token gespeichert ist. |
| **Repository wird nicht vorgeschlagen** | Netzwerk, Token-Zugriff und GitHub-API prüfen. Das Feld unterstützt freie Eingabe als `owner/repo`. |
| **GitHub-Sync schlägt fehl** | Repository, Branch, Token-Berechtigung und Konfliktmeldungen kontrollieren. |
| **Mindmap nicht verfügbar** | Prüfen, ob die Markdown-Datei genau eine gültige H1 besitzt. |
| **Ein Kalenderknoten fehlt** | Das `[date:...]`-Format einschließlich gültiger Dauer-Einheiten kontrollieren. |
| **Patch abgelehnt** | Die rote Fehlermeldung anklicken, kopieren und JSON, Pfade, Felder sowie Trefferangaben korrigieren. |
| **Patch lässt sich nicht einspielen** | Vorschau und `patch / found / total` ansehen; fehlende Suchstellen, Zielpfadkollisionen oder abgewählte Vorgänge prüfen. |
| **Zwischenablage nicht verfügbar** | HTTPS/localhost verwenden, Berechtigungen prüfen oder manuell mit Strg/⌘+V einfügen. |
| **System-Teilen fehlt** | Die App bietet einen Download-Fallback an. |
| **HTML-Vorschau funktioniert anders als erwartet** | Projektpfade, Browserbeschränkungen, die Vorschau-Konsole und die Sicherheitseinstellungen prüfen. |
| **Alte App nach Update** | Seite neu laden; sicherstellen, dass alle Delta-Dateien ersetzt wurden und der Service Worker die neue Version aktiviert hat. |

### 17.4 Grenzen der Anwendung

- Die integrierte Datenhaltung liegt im Browser, nicht automatisch auf einem regulären Dateisystempfad.
- Die dauerhaft gespeicherten Projektdaten und die sitzungsgebundene Undo-Historie sind unterschiedliche Dinge.
- Die HTML-Vorschau ist eine Test-/Darstellungsumgebung, kein vollständiger Webserver.
- GitHub-Integration, Web Share, Zwischenablage und PWA-Funktionen benötigen passende Browserfähigkeiten und teilweise Netzwerk- bzw. Zugriffsrechte.
- Pretty Code ist ein interner Formatter und ersetzt keinen vollständigen professionellen Code-Formatter.
- Das Patch-Tool verarbeitet sein eigenes **streng definiertes JSON-Format**; ein beliebiges `.diff` oder Unified-Diff wird nicht automatisch als gültiger Patch erkannt.

## 18. Kurzübersicht häufiger Aufgaben

| Aufgabe | Kürzester Weg |
|---|---|
| Neues Projekt | **PROJEKTE → +** |
| Projekt wechseln | **PROJEKTE → Auswahlliste** |
| Projektfarben/-status ändern | **PROJEKTE → Zahnrad** |
| Neue Datei | **DATEIEN → + → Neue Datei** |
| Neuer Ordner | **DATEIEN → + → Neuer Ordner** |
| Datei umbenennen/verschieben | Datei öffnen → **Umbenennen** |
| Ordner verwalten | `⋯` am Ordner |
| Alle Ordner einklappen | Gestrichelt umrahmtes Minus neben **DATEIEN** |
| Datei aus Zwischenablage | **DATEIEN → + → Aus Zwischenablage** |
| ZIP importieren | **DATEIEN → + → ZIP importieren** |
| Workspace sichern | **DATEIEN → ⋯ → ZIP herunterladen** |
| Aktuelle Datei sichern | **DATEIEN → ⋯ → Aktuelle Datei herunterladen** |
| Ausgewählte Dateien teilen | **Teilen** unter dem Repository-Bereich |
| Patch anwenden | **Patch-Tool → Einspielen** |
| Patch-Phrase kopieren | **Patch-Tool → Erstellen → Phrase kopieren** oder **Teilen → Patch-Phrase kopieren** |
| Markdown als Mindmap ansehen | `.md` öffnen → **Mindmap** |
| Aufgaben als Board verwalten | `.md` öffnen → **Kanban** |
| Datierte Knoten ansehen | `.md` öffnen → **Kalender** |
| Quelltext formatieren | Script-Datei öffnen → **Pretty Code** |
| HTML testen | HTML-Datei öffnen → **Vorschau** |
| GitHub-Token hinterlegen | **mindfagg-Logo → GitHub-Zugangsdaten** |
| Repository verbinden | Token speichern → **Repository zuordnen** |
| Letzte Aktion zurücknehmen | Oberer **Rückgängig**-Button |
| App-Einstellungen | Auf das **mindfagg-Logo** klicken |

---

*Ende der Bedienungsanleitung für mindfagg v49.*
