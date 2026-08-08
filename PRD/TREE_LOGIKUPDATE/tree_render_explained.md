
Grundsätzlich läuft der Baum in Preview3 in vier Schichten:

1. Daten laden und Zustand aufbauen
2. Layout-Pipeline rechnen
3. Renderdaten aus dem Layout ableiten
4. SVG zeichnen

Der Einstieg dafür liegt in [Preview3App.tsx**:537**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>). Dort passiert zuerst das Laden des Datensatzes, danach wird bei Datensatz- oder Mode-Wechsel die Tree-Pipeline neu gebaut. Der eigentliche Rebuild läuft über [Preview3App.tsx**:649**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) und ruft [treePipeline.ts**:52**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) auf.

**Wie der Baum gebaut wird**
Die eigentliche Baumkonstruktion in Preview3 ist im Kern deterministisch und läuft so:

1. Datensatz validieren
   In [treePipeline.ts**:53**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) wird zuerst [validateDataset](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) aufgerufen. Dabei werden Personen, biologische Relationen, Overlay-Relationen, Warnings, Parent/Child-Maps und Hilfsindizes erzeugt.
2. Basislayout rechnen
   Danach kommt [treePipeline.ts**:54**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>): [layoutGraph(validation.persons, validation.validBiologicalRelations, ...)](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>).
   Wichtig: Für das Basislayout zählen nur biologische Eltern-Kind-Kanten. Heirat ist hier noch keine primäre Strukturkante.
3. Lokale Nachkorrekturen auf das Layout
   Danach laufen mehrere Post-Processing-Schritte:
   * Single-child centering über [treePipeline.ts**:55**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
   * Marriage pair alignment über [treePipeline.ts**:56**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
   * Je nach Mode kuratierte Personenreihenfolge über [treePipeline.ts**:61**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
   * Je nach Mode kuratierte Personen-yOffsets über [treePipeline.ts**:64**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
   * Je nach Mode House-Subtree-Offsets über [treePipeline.ts**:67**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
4. House Anchors berechnen
   Erst danach werden die House Anchors berechnet, in [treePipeline.ts**:72**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>).
5. Initiale Kamera berechnen
   Zum Schluss wird aus den finalen Node-Bounds plus Anchors die Startkamera berechnet in [treePipeline.ts**:76**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>).

Das heißt fachlich: Der Anchor ist nicht die Ursache des Grundlayouts. Der Anchor kommt auf ein bereits gerechnetes Layout drauf.

**Wie das Rendering danach arbeitet**
Das reine Zeichnen passiert nicht direkt aus der Pipeline, sondern aus einer zweiten Ableitung: [treePipeline.ts**:97**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>).

Dort wird aus dem finalen Layout noch einmal entschieden:

* ob Spouse Projection aktiv ist
* welche biologischen Kanten sichtbar bleiben
* welche Overlay-Kanten sichtbar bleiben
* wie biologische Child-Groups für die gemeinsamen Parent-Connectoren gruppiert werden

Die SVG selbst wird dann in [Preview3TreeCanvas.tsx**:66**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) gezeichnet:

* zuerst Grid und Canvas
* dann House Anchors
* dann Overlay-Relationen
* dann biologische Parent/Child-Gruppen
* dann Spouse Projection Cards
* dann die Person-Nodes

**Wie die Anchor-Positionen aktuell ermittelt werden**
Der Kern dafür liegt in [treeCore.ts**:90**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>), [treeCore.ts**:123**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) und [treeCore.ts**:280**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>).

Der Ablauf ist aktuell so:

1. House Definitions als Regelbasis
   Die House-Definitionen kommen aus den Dataset-Dateien wie [house-definitions.json](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>).
   Relevant sind dort:

   * [tier](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
   * [anchor.enabled](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
   * [anchor.order](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
   * optional [layout.yOffset](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
2. Pro Person das fachlich führende Haus bestimmen
   In [treeCore.ts**:245**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) wird das Primärhaus einer Person ermittelt.
   Regel aktuell: Das erste passende Haus in [person.houses](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) gewinnt.
3. Nur root-anchor-fähige Häuser sammeln
   In [treeCore.ts**:280**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) werden nur Häuser berücksichtigt, die:

   * [tier === &#39;start&#39;](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
   * [anchor.enabled === true](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
     haben.
4. Mitglieder pro Haus sammeln
   Danach werden alle Personen, deren Primärhaus dieses Start-Haus ist, diesem Haus zugeordnet.
5. Top-Nodes je Haus bestimmen
   Für jedes Haus werden die zugehörigen Layout-Nodes gelesen. Dann wird die kleinste Y-Position gesucht. Alle Nodes dieses Hauses auf dieser minimalen Y-Ebene werden zu [topNodes](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>).
   Das ist wichtig: Ein Haus hat aktuell nicht zwingend genau einen Root-Startknoten. Es kann mehrere [topNodes](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) geben, wenn mehrere Mitglieder auf derselben obersten Ebene liegen.
6. Context Nodes bestimmen
   Hier trennt sich aktuell die Strategie:

   * Legacy: [contextNodes = topNodes](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
   * Enhanced: [contextNodes = alle sichtbaren Nachfahren ab topNodes](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)

   Das steckt in [treeCore.ts**:321**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) und [treeCore.ts**:257**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>).

**Was der Legacy-Anchor heute macht**
Der Legacy-Pfad ist in [treeCore.ts**:123**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>).

Er macht im Prinzip Folgendes:

* Für jedes Haus wird aus den [contextNodes](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) ein [minX](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>), [maxX](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) und ein idealer Mittelpunkt [centerX](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) berechnet.
* Die Labelbreite wird grob aus dem Hausnamen geschätzt.
* Danach werden alle Häuser links-nach-rechts sortiert.
* Dann kommt eine einfache Kollisionsvermeidung:
  Jeder nächste Anchor darf nicht zu nah am vorherigen liegen.
* Wenn er zu nah wäre, wird er nur nach rechts geschoben.
* Alle Legacy-Anker landen auf einer gemeinsamen Top-Row-Y.

Der entscheidende Punkt dabei:
Die Legacy-Kollisionslogik ist rein sequentiell. Sie rebalance’t nicht global, sondern schiebt nur nach rechts. Genau dadurch entsteht Drift.

**Was der Enhanced-Anchor heute macht**
Der generische Anchor-Bau für Enhanced läuft in [treeCore.ts**:90**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>).

Hier wird pro Haus:

* [minX/maxX](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) aus den [contextNodes](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) genommen
* daraus der Mittelpunkt berechnet
* das Label direkt darüber gesetzt

Anders gesagt:
Enhanced positioniert den Anchor grundsätzlich über dem horizontalen Span des zugehörigen Haus-Kontexts.

**Was die House-Subtree-Offsets vorher schon verändern**
Bevor die Anchors gebaut werden, kann das Layout selbst je Haus verschoben werden. Das passiert in [treeCore.ts**:186**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>).

Dafür wird in [treeCore.ts**:332**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) ein House-Cluster gebaut:

* [topNodes](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) definieren den Einstieg
* [contextNodes](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) definieren den Cluster-Inhalt
* [shiftY](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) kommt aus [house.layout.yOffset](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
* [shiftX](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) wird sequentiell vergeben, damit House-Cluster nicht zu nah beieinander starten

Wichtig dabei:
Die horizontale Platzierung des Clusters nutzt aktuell wegen [HOUSE_CLUSTER_PLACEMENT_SCOPE = &#39;exclusive-root-corridor&#39;](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) in [treeCore.ts**:40**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) nur den Root-Korridor, nicht die volle spätere Descendant-Breite.
Das ist ein Kernpunkt deines Problems.

**Warum sich die Anchor-Platzierung heute noch falsch anfühlt**
Das Problem ist nicht nur “Label sitzt falsch”, sondern die ganze Definition des Einstiegs ist noch zu rootnah.

Aktuell passieren drei Dinge gleichzeitig:

* Der Einstieg eines Hauses wird stark über [topNodes](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>) gedacht.
* Die Kollisionen werden sequentiell statt global aufgelöst.
* Die spätere reale Baum-Breite wird nicht stark genug als Platzreservierung benutzt.

Dadurch kann Folgendes passieren:

* Zwei Häuser starten oben relativ nah.
* Ihre tatsächlichen Subtrees weiten sich aber später stark aus.
* Die oberen Einstiegslinien wirken dann zu dicht, obwohl unten viel Breite gebraucht wird.

**Wie du das mental modellieren solltest**
Am besten so:

* Das Basislayout beantwortet:
  Wo liegen die Personen biologisch?
* Die House-Cluster-Logik beantwortet:
  Welche Bereiche des Layouts gehören fachlich zu welchem Root-Haus?
* Die Anchor-Logik beantwortet:
  Wo oben soll der sichtbare Einstieg für diesen House-Cluster sitzen?

Aktuell ist genau die dritte Frage noch nicht gut genug beantwortet, weil sie zu stark von der lokalen Root-Situation und zu wenig vom gesamten Cluster-Footprint abhängt.

**Die zwei wichtigsten Stellen dafür**
Wenn du nur zwei Orte im Kopf behalten willst, dann diese:

* [treeCore.ts**:280**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
  Hier wird entschieden, welche Nodes überhaupt den Haus-Kontext bilden.
* [treeCore.ts**:123**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
  Hier wird im Legacy-Fall entschieden, wie die Anchor-X-Positionen kollisionsbereinigt gesetzt werden.

Und ergänzend für den Enhanced-/Cluster-Pfad:

* [treeCore.ts**:332**](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)

**Kurzfassung**
Ja, du siehst richtig:
Der Baum wird erst biologisch gelayoutet und danach mit House-spezifischen Offsets und Anchors ergänzt. Die Anchor-Positionen werden aktuell aus Root-/Context-Spans abgeleitet, aber noch nicht stark genug aus dem tatsächlichen späteren House-Footprint. Deshalb wirken die House-Starts oben noch zu dicht oder fachlich nicht sauber genug gesetzt.

Wenn du willst, gehe ich als Nächstes einen Schritt tiefer und erkläre dir genau den Unterschied zwischen:

1. [topNodes](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
2. [contextNodes](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
3. [clusterNodeIds](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)
4. [connectorNodeIds](<vscode-file://vscode-app/c:/Users/chris/AppData/Local/Programs/Microsoft%20VS%20Code/1b6a188127/resources/app/out/vs/code/electron-browser/workbench/workbench.html>)

Das ist genau die Ebene, auf der der Root-Anchor-Fix später sauber entschieden wird.
