
Ja. Ich würde es bewusst als **technische Spezifikation für Copilot** formulieren: klare Muss-Regeln, Trennung von Domain/Projection/Layout/Rendering und keine Interpretationsspielräume dort, wo wir sie bereits festgelegt haben.

# Tree Logic Mode D

## 1. Zweck

Dieses Dokument definiert die verbindliche Tree-Logik und Renderarchitektur für den Legendarium Explorer.

Es dient als **Implementierungsgrundlage für GitHub Copilot**.

Die Implementierung muss die hier beschriebenen Regeln direkt umsetzen. Wo dieses Dokument eine Regel explizit festlegt, darf die Implementierung keine alternative Interpretation einführen.

Die Tree-Logik besteht aus vier konzeptionellen Schichten:

1. Domain Data
2. Biological Tree / Validation
3. Layout Projection
4. ELK / Rendering

Die Domain-Daten dürfen durch die Renderlogik nicht verändert werden.

---

# 2. Grundprinzip

Das Domain-Modell ist ein Graph.

Personen sind Nodes.

Beziehungen sind Relations/Edges.

Beispiel:

```text
Person A
  ├── biological_parent → Person B
  ├── marriage → Person C
  └── adoption → Person D
```

Für das eigentliche genealogische Tree-Layout wird jedoch nur die biologische Abstammung als Tree-Struktur verwendet.

```text
biological_parent
        ↓
Biological Tree
```

Andere Beziehungen werden separat behandelt.

---

# 3. Relationstypen

## 3.1 Biological Parent

`biological_parent` bestimmt:

* genealogische Abstammung
* Generation
* Parent/Child-Struktur
* biologische Tree-Position

Eine biologische Parent-Relation ist die einzige Relation, die die Generation einer Person verändert.

```text
Parent
  │
  └── Child
        │
        └── Grandchild
```

Generation:

```text
Parent       G0
Child        G1
Grandchild   G2
```

---

## 3.2 Marriage

`marriage` ist primär eine soziale/familiäre Relation.

Sie verändert nicht die Generation.

Sie beeinflusst jedoch das Layout:

* Ehepartner werden nebeneinander dargestellt.
* Ehepartner liegen auf derselben Y-Ebene.
* Gemeinsame Kinder werden symmetrisch zur gemeinsamen Elternachse angeordnet.

Beispiel:

```text
┌─────────┐     ┌─────────┐
│  Vater  │─────│  Mutter │
└─────────┘     └─────────┘
       \           /
        \         /
         \       /
          ───┬───
             │
       ┌─────┴─────┐
       │           │
     Kind A      Kind B
```

Die Marriage-Relation darf somit für die **Layout-Projektion** verwendet werden.

Sie erzeugt aber keine zusätzliche genealogische Generation.

---

## 3.3 Unverheiratete biologische Eltern

Ein biologisches Elternpaar ohne Marriage-Relation wird layouttechnisch wie ein Ehepaar behandelt.

Der einzige Unterschied ist:

**Es wird keine Marriage-Linie gezeichnet.**

```text
┌─────────┐       ┌─────────┐
│  Vater  │       │  Mutter │
└─────────┘       └─────────┘
       \             /
        \           /
         ─────┬─────
              │
           Kinder
```

---

## 3.4 Adoption

Adoptiveltern beeinflussen das biologische Tree-Layout nicht.

Sie werden ausschließlich als Overlay dargestellt.

```text
biological_parent
    ↓
Tree layout

adoption
    ↓
Overlay
```

Adoption darf:

* keine Generation verändern
* keine X-Position bestimmen
* keine Y-Position bestimmen
* keine Parent-Child-Layoutgruppe erzeugen

---

## 3.5 Weitere soziale Relationen

Weitere soziale Relationen wie z. B.:

* mentor
* step_parent
* sonstige soziale Beziehungen

werden analog als Overlay behandelt.

Sie beeinflussen das biologische Tree-Layout nicht.

---

# 4. Biological Tree

Vor dem Layout wird aus den Domain-Daten ein bereinigter biologischer Graph erzeugt.

Nur dieser Graph wird an den Tree-Layout-Prozess übergeben.

## 4.1 Self Parent

Eine Relation:

```text
A → A
```

ist ungültig.

Aktion:

* Relation ignorieren
* Warning erzeugen

Der Renderprozess darf dadurch nicht abbrechen.

---

## 4.2 Fehlende Person-Referenz

Wenn eine Relation auf eine nicht existierende Person verweist:

```text
A → UNKNOWN
```

Aktion:

* Relation ignorieren
* Warning erzeugen

Der Renderprozess darf dadurch nicht abbrechen.

---

## 4.3 Mehr als zwei biologische Eltern

Normalfall:

```text
maximal 2 biological parents
```

Mehr als zwei biologische Eltern sind ein Datenfehler.

Aktion:

* Warning erzeugen
* trotzdem versuchen zu rendern

Fallback:

```text
Parent A       Parent B       Parent C
   \             /               /
    \           /               /
     ──────────                 /
             │                 /
             └────────────────
```

Konkrete Layoutregel:

* Zwei Eltern werden normal als gemeinsames Elternpaar behandelt.
* Weitere Eltern werden seitlich angebunden.
* Der Renderer darf wegen >2 Eltern nicht abbrechen.

---

## 4.4 Zyklen

Der biologische Graph muss azyklisch sein.

Bei einem Zyklus:

1. betroffene Cycle-Edges identifizieren
2. die Edge mit der lexikographisch höchsten UUID entfernen
3. Graph erneut prüfen
4. wiederholen, bis kein Zyklus mehr vorhanden ist

Die Entscheidung muss deterministisch sein.

Beispiel:

```text
A → B
B → C
C → A
```

Wenn die drei Edge-UUIDs bekannt sind, wird immer die lexikographisch höchste entfernt.

Nicht verwenden:

* zufällige Auswahl
* Lade-Reihenfolge
* Iterations-Reihenfolge
* heuristische Auswahl

---

# 5. Determinismus

Identische Eingabedaten müssen immer zum identischen Ergebnis führen.

```text
same input
    ↓
same validation
    ↓
same ignored relations
    ↓
same biological graph
    ↓
same ordering
    ↓
same layout input
    ↓
same layout
```

Die Implementierung darf nicht von zufälligen oder instabilen Sortierreihenfolgen abhängen.

---

# 6. Generation

Generation ist ausschließlich biologisch definiert.

## 6.1 Generation 0

Die erste Person eines unabhängigen biologischen Strangs ist Generation 0.

Bei mehreren unabhängigen Startpersonen:

```text
Person A    G0

Person B    G0

Person C    G0
```

Alle unabhängigen Startpersonen liegen somit auf Generation 0.

---

## 6.2 Generation-Inkrement

Jedes biologische Eltern-Kind-Level erhöht die Generation um exakt 1.

```text
Parent       G0
  │
  ▼
Child        G1
  │
  ▼
Grandchild   G2
```

Marriage verändert die Generation nicht.

House-Wechsel verändert die Generation nicht.

Adoption verändert die Generation nicht.

---

## 6.3 Gleiche Generation

Alle Personen derselben Generation werden exakt auf derselben Y-Position gerendert.

```text
G2 ───── A ───── B ───── C ───── D
```

Keine individuellen Y-Abweichungen aufgrund von:

* Name
* House
* Marriage
* Geschlecht
* Reihenfolge

außer einem explizit definierten House-`yOffset` beim House-Start.

---

# 7. Eltern-/Kindergruppen

Für das Layout wird eine temporäre grafische Parent-Child-Gruppe erzeugt.

Dies ist **keine Domain-Entity** und darf nicht in die JSON-Daten geschrieben werden.

Sie dient ausschließlich dem Renderer.

## 7.1 Zwei biologische Eltern

Eltern liegen nebeneinander auf gleicher Ebene.

```text
Parent A ─── Parent B
```

Die Kinder werden nicht nur an Parent A bzw. den Vater gehängt.

Die Kinder hängen grafisch an der **gemeinsamen Achse des Elternpaares**.

```text
Parent A ─── Parent B
       \     /
        \   /
         ─┬─
          │
       Children
```

---

## 7.2 Ein biologischer Elternteil

Ein alleinstehender biologischer Elternteil wird als normaler einzelner Block gerendert.

Die Kinder werden mittig darunter angeordnet.

```text
       Parent
         │
    ┌────┴────┐
    │         │
  Child A   Child B
```

---

# 8. Geschwister

Geschwister werden nur **innerhalb ihrer jeweiligen Geschwistergruppe** sortiert.

Sortierpriorität:

1. `order`
2. `birthDate`
3. alphabetisch

`order` ist somit eine fachliche/kurationelle Möglichkeit, die Reihenfolge einer konkreten Geschwistergruppe festzulegen.

Ohne `order` wird nach Geburtsdatum sortiert.

Ohne Geburtsdatum wird alphabetisch sortiert.

---

## 8.1 Symmetrische Anordnung

Geschwister werden symmetrisch um die Elternachse angeordnet.

### Ungerade Anzahl

Bei 3 Kindern:

```text
             Parent Group
                  │
          ┌───────┼───────┐
          │       │       │
          A       B       C
                  ↑
              Elternachse
```

Ein Kind liegt exakt auf der Elternachse.

---

### Gerade Anzahl

Bei 4 Kindern liegt die Achse zwischen den beiden mittleren Kindern:

```text
             Parent Group
                  │
          ┌───────┼───────┐
          │       │       │
          A       B   C   D
                  ↑
             Achse zwischen
                B und C
```

Allgemein:

```text
odd children:
    ein mittleres Kind auf der Achse

even children:
    Achse zwischen den beiden mittleren Kindern
```

---

# 9. Mehrere Ehepartner

Eine Person kann mehrere Ehepartner haben.

Im aktuellen Datensatz sind maximal zwei Ehen/Partner vorgesehen, die Renderlogik darf jedoch nicht unnötig auf exakt zwei Partner fest verdrahtet werden.

Wichtig:

**Die Person der Hauptlinie wird nur einmal gerendert.**

Beispiel:

```text
             Vater
            /     \
       Frau 1     Frau 2
```

Nicht:

```text
Vater ─ Frau 1

Vater ─ Frau 2
```

mit zweimal gerendertem Vater.

---

## 9.1 Partner-Reihenfolge

Weitere Partner werden direkt nebeneinander angeordnet.

Beispiel:

```text
Frau 1 | Frau 2 | Frau 3
```

in der definierten Reihenfolge.

---

## 9.2 Kinder verschiedener Ehen

Kinder werden unter ihrer jeweiligen Eltern-/Ehegruppe angeordnet.

```text
              Vater
             /     \
          Frau 1   Frau 2
            │         │
        ┌───┴───┐   ┌─┴─┐
       Kind A  Kind B  C
```

Die Geschwistergruppen der unterschiedlichen Ehen werden nicht zu einer gemeinsamen Geschwistergruppe vermischt.

---

# 10. House-System

Das House einer Person ist ein unveränderlicher Wert im Datensatz.

Die Renderlogik darf nicht versuchen, das House fachlich herzuleiten oder zu korrigieren.

```text
person.house
```

ist die autoritative Quelle.

House-Wechsel innerhalb einer biologischen Linie verändern die biologische Generation nicht.

---

# 11. House-Tier

House-Definitionen unterscheiden:

```text
tier: start
tier: later
```

## 11.1 Start-House

Ein `start`-House besitzt einen grafischen Startpunkt.

Grundsätzlich startet dieser an der Baseline.

```text
BASELINE
────────────────────────

     ● House
```

Mehrere Start-Houses werden anhand von:

```text
anchor.order
```

geordnet.

`anchor.enabled` ist für Start-Houses relevant.

---

## 11.2 Later-House

Ein `later`-House besitzt keinen grafischen Startpunkt.

Es wird nicht an der Baseline gespawnt.

Das House beginnt grafisch bei der ersten Person dieses Houses.

```text
bestehende biologische Linie
          │
          ●
       first person
       of later House
```

`anchor.enabled` ist bei `tier: later` irrelevant.

Es darf keinen sichtbaren Start-Anchor erzeugen.

---

# 12. House yOffset

`yOffset` ist eine **manuelle Layout-Steuerung**.

Es wird in Generationseinheiten angegeben.

Beispiel:

```json
{
  "id": "house-of-beor",
  "displayName": "House of Beor",
  "tier": "start",
  "layout": {
    "yOffset": 20
  },
  "anchor": {
    "enabled": true,
    "order": 40
  }
}
```

Bedeutung:

Das House ist weiterhin ein `start`-House.

Es bekommt weiterhin einen grafischen Startpunkt.

Dieser Startpunkt liegt aber nicht auf der Baseline, sondern um 20 Generationseinheiten darunter.

```text
Baseline
────────────────────────────

Start House A
●


          20 Generationen
          tiefer

Start House B
●
```

### Wichtig

`yOffset` bedeutet NICHT:

```text
Person.generation += yOffset
```

Die biologische Generation bleibt unverändert.

`yOffset` verschiebt ausschließlich den **grafischen House-Startpunkt**.

---

## 12.1 Fachlicher Zweck

Das System muss damit fachliche Fälle wie die Edain darstellen können.

Mehrere Edain-Houses sind `tier: start`, obwohl ihre historische Entstehung wesentlich später als die allgemeine Baseline liegt.

Beispiel:

```text
Baseline
────────────────────────────

frühe Start-Houses
●
●
●


        großer vertikaler Abstand


Edain Start-Houses
●
●
●
```

`yOffset` erlaubt diese fachlich kuratierte Positionierung.

---

## 12.2 Einschränkung

Bei Start-Houses ist `yOffset` grundsätzlich erlaubt, soll aber nur als **manuelle Layout-Steuerung bzw. Ausnahmefall** verwendet werden.

---

# 13. House-Reihenfolge

Bei Start-Houses:

```text
anchor.order
```

bestimmt die fachlich kuratierte Reihenfolge der Start-Houses.

Bei later Houses:

```text
order
```

dient der Kuratierung innerhalb derselben House-Ebene bzw. des entsprechenden House-Abschnitts.

`anchor.enabled` ist bei later Houses irrelevant.

---

# 14. House-Wechsel

Ein House-Wechsel verändert die biologische Linie nicht.

Beispiel:

```text
Person A
House A
  │
  ▼
Person B
House A
  │
  ▼
Person C
House B
  │
  ▼
Person D
House B
```

Die biologische Generation ist weiterhin:

```text
A = G0
B = G1
C = G2
D = G3
```

Der House-Wechsel erzeugt keine neue biologische Generation.

Ein House kann beliebig viele Generationen überspannen.

---

# 15. House-Vererbung

Das House einer Person wird nicht durch die Renderlogik berechnet.

Der Wert ist im Datensatz bereits definiert und unveränderlich.

Daher gilt für den Renderer:

```text
person.house
```

verwenden.

Nicht:

```text
deriveHouse(person)
```

Nicht:

```text
inferHouseFromParents(person)
```

Nicht:

```text
changeHouseBecauseOfLineage(person)
```

House-Logik und Tree-Layout müssen diese fachliche Information nicht rekonstruieren.

---

# 16. House-Nachfolge

Für die fachliche House-Vererbung gilt:

* normalerweise wird das House des Vaters weitergeführt
* bei einer Tochter als House-Nachfolgerin geht das House auf ihre Kinder über
* bei mehreren Kindern erhalten alle Kinder das House
* die tatsächliche House-Zugehörigkeit der Person steht anschließend im Datensatz

Wichtig für den Renderer:

**Diese fachliche Vererbungslogik wird nicht vom Renderer berechnet.**

Der Renderer verwendet ausschließlich den bereits gespeicherten House-Wert.

---

# 17. X-Position

Die X-Position wird aus den biologischen Eltern-Kind-Beziehungen und den daraus entstehenden Parent-/Child-Gruppen abgeleitet.

Grundprinzip:

```text
Parent Group
      │
      │
common parent axis
      │
      ├── Child
      ├── Child
      └── Child
```

Kinder werden symmetrisch um die Elternachse positioniert.

Die konkrete globale Optimierung der X-Position darf der Layout-Engine überlassen werden.

Es soll kein eigener komplexer X-Layout-Algorithmus implementiert werden, wenn ELK die Aufgabe übernehmen kann.

---

# 18. Y-Position

Die Y-Position besteht konzeptionell aus zwei Komponenten:

```text
House-Startposition
+
biologische Generation
```

Für Start-Houses:

```text
House Start-Y
=
Baseline-Y
+
yOffset × GenerationHeight
```

Danach folgt die biologische Linie relativ zu diesem Startpunkt.

Generation wird durch biologische Eltern-Kind-Beziehungen bestimmt.

`yOffset` ist bereits in Generationseinheiten definiert.

Es darf deshalb nicht nochmals als zusätzlicher Pixel-/Generationsterm interpretiert werden.

---

# 19. Layout Engine

ELK.js ist die bevorzugte Layout-Engine.

Mögliche Alternativen wie:

* d3-hierarchy
* dagre

wurden betrachtet.

ELK wird bevorzugt, weil das zugrunde liegende Datenmodell kein reiner klassischer Tree ist und komplexe Parent-/Partner-/Overlay-Situationen unterstützt werden müssen.

Die Domain-Daten werden nicht direkt ungefiltert an ELK übergeben.

Stattdessen:

```text
Domain Graph
    ↓
Validation
    ↓
Biological Tree
    ↓
Layout Projection
    ↓
ELK Graph
    ↓
Rendered Tree
```

---

# 20. Layout Projection

Die Layout Projection erzeugt aus dem biologischen Graphen eine für ELK geeignete Struktur.

Sie darf temporäre Layoutobjekte erzeugen.

Beispielsweise:

```text
Person Node
Parent Group
Child Group
Marriage connector
House Anchor
```

Diese Objekte sind keine Domain-Entities.

Sie existieren nur während des Render-/Layoutprozesses.

---

# 21. Social Overlay

Nach dem biologischen Layout werden soziale Beziehungen als Overlay dargestellt.

Beispiel:

```text
Biological Tree:

A ─── B
     │
     C


Overlay:

A ───────── adoption ─────── D
```

Overlay-Relationen dürfen die bereits berechneten biologischen Positionen nicht verändern.

---

# 22. Render-Pipeline

Die empfohlene Pipeline:

```text
1. Load domain JSON
        ↓
2. Validate references
        ↓
3. Validate biological parent count
        ↓
4. Detect and resolve cycles
        ↓
5. Build biological graph
        ↓
6. Determine deterministic ordering
        ↓
7. Determine generations
        ↓
8. Resolve House information
        ↓
9. Resolve House start positions / yOffset
        ↓
10. Build Parent-/Child layout groups
        ↓
11. Build ELK graph
        ↓
12. Run ELK layout
        ↓
13. Apply / enforce generation Y-levels
        ↓
14. Render person nodes
        ↓
15. Render biological edges
        ↓
16. Render marriage / social overlays
        ↓
17. Apply selection/highlighting
```

---

# 23. Fehlerbehandlung

Fehlerhafte Daten dürfen den gesamten Tree nicht zum Absturz bringen.

Grundprinzip:

```text
invalid relation
      ↓
warning
      ↓
best-effort normalization
      ↓
continue rendering
```

Warnings sollen nach Möglichkeit die betroffene Relation/Person eindeutig referenzieren.

Beispiele:

```text
WARNING:
Self-parent relation ignored:
person = xyz

WARNING:
Missing parent reference ignored:
child = xyz
parent = abc

WARNING:
Person has >2 biological parents:
person = xyz

WARNING:
Cycle detected and edge removed:
edge = xyz
```

---

# 24. Auswahl / Highlighting

Die Tree-Ansicht soll zwei Personen per Shift-Auswahl markieren können.

Beispiel:

```text
Shift + Click A
Shift + Click B
```

Danach soll der relevante biologische Zusammenhang hervorgehoben werden.

Nicht relevante Bereiche werden visuell abgeschwächt.

Für den MVP kann der relevante Zusammenhang über den Lowest Common Ancestor des biologischen Graphen bestimmt werden.

Das Highlighting verändert das Layout nicht.

Es ist eine reine Darstellungs-/UI-Funktion.

---

# 25. Initial View

Beim Öffnen der Tree-Ansicht:

* gesamter relevanter Tree soll sichtbar sein
* Zoom-to-fit
* Pan
* Zoom
* bei großen Trees muss hineingezoomt werden können

Das Layout soll nicht bereits für den initialen Zoom künstlich vereinfacht werden.

---

# 26. Wichtige Architekturgrenzen

Die Implementierung darf folgende Verantwortlichkeiten nicht vermischen.

## Domain

```text
Was ist fachlich wahr?
```

Beispiel:

```text
person.house
biological_parent
marriage
birthDate
```

---

## Validation

```text
Sind die Daten für den Tree verwendbar?
```

Beispiel:

```text
self-parent
missing reference
>2 biological parents
cycles
```

---

## Layout Projection

```text
Wie wird das fachliche Modell in eine grafische Struktur übersetzt?
```

Beispiel:

```text
Parent Group
Marriage grouping
Sibling ordering
House anchors
House yOffset
```

---

## ELK

```text
Wo liegen die grafischen Elemente?
```

ELK soll die eigentliche Layoutoptimierung übernehmen.

---

## Renderer

```text
Wie wird das Ergebnis dargestellt?
```

Beispiel:

```text
SVG / React nodes
SVG / React edges
labels
house anchors
overlays
highlighting
```

---

# 27. Nicht erlaubte Vereinfachungen

Die Implementierung darf insbesondere nicht auf folgende vereinfachte Tree-Logik zurückfallen:

```text
Father
 ├── Child
 └── Child
```

wenn eine Mutter vorhanden ist.

Stattdessen:

```text
Father ─── Mother
      \     /
       \   /
        ─┬─
         │
      Children
```

Ebenso darf ein mehrfach verheirateter Vater nicht mehrfach als Person-Node erzeugt werden.

Nicht:

```text
Father ─ Wife 1

Father ─ Wife 2
```

mit zwei Vater-Nodes.

Sondern:

```text
             Father
            /      \
         Wife 1   Wife 2
           │         │
        Children   Children
```

mit **einem** Vater-Node.

---

# 28. Kernprinzipien für Copilot

Bei Implementierungsentscheidungen gelten folgende Prioritäten:

1. **Domain-Daten sind autoritativ.**
2. **Biologische Eltern-Kind-Beziehungen definieren den genealogischen Tree.**
3. **Generation ist rein biologisch.**
4. **Marriage beeinflusst die grafische Eltern-Gruppierung, nicht die Generation.**
5. **Adoption und andere soziale Beziehungen sind Overlays.**
6. **Kinder werden symmetrisch zur gemeinsamen Elternachse angeordnet.**
7. **Geschwistersortierung ist `order → birthDate → alphabetisch`.**
8. **House ist im Person-Datensatz bereits definiert und wird nicht vom Renderer hergeleitet.**
9. **`tier: start` erzeugt einen sichtbaren House-Startpunkt.**
10. **`tier: later` erzeugt keinen sichtbaren Startpunkt.**
11. **`yOffset` verschiebt einen House-Startpunkt um Generationseinheiten.**
12. **`yOffset` verändert niemals die biologische Generation.**
13. **Ungültige Daten erzeugen Warnings und sollen den Render möglichst nicht verhindern.**
14. **Alle Layoutentscheidungen müssen deterministisch sein.**
15. **ELK ist für die globale Layoutberechnung zuständig.**
16. **Temporäre Layout-Gruppen sind erlaubt, dürfen aber nicht in das Domain-Modell zurückgeschrieben werden.**

---

# 29. Aktueller Status

### Festgelegt

* biologische Tree-Basis
* Generationen
* unabhängige Startlinien
* Parent-/Child-Gruppierung
* symmetrische Kinder
* gerade/ungerade Geschwistergruppen
* Geschwistersortierung
* Ehepartnerdarstellung
* mehrere Ehepartner
* Kinder verschiedener Ehen
* unverheiratete Eltern
* > 2 biologische Eltern Fallback
  >
* Adoption als Overlay
* House-Werte als autoritativ
* `tier: start`
* `tier: later`
* House-Startpunkte
* House `yOffset`
* Generation/Y-Logik
* deterministische Verarbeitung
* biologische Validierung
* Cycle Resolution
* ELK als Layout Engine
* Overlay-Konzept
* Highlighting-Konzept

### Bewusst nicht als eigene Domain-Struktur einführen

Insbesondere:

```text
FamilyBlock
HouseLayer
HouseEntity generated by renderer
```

Solche Strukturen dürfen intern als temporäre Layout-/Projection-Objekte existieren, sind aber **keine zusätzlichen fachlichen Entities**.

---

# 30. Leitprinzip

Der Renderer soll nicht versuchen, Tolkien-Fachwissen zu rekonstruieren.

Er bekommt fachlich definierte Daten und übersetzt diese deterministisch in eine grafische Darstellung.

```text
DATA
 ↓
VALIDATE
 ↓
BIOLOGICAL TREE
 ↓
LAYOUT PROJECTION
 ↓
ELK
 ↓
RENDER
 ↓
OVERLAYS
```

Die Tree-Renderlogik soll damit **fachlich deterministisch, visuell symmetrisch, erweiterbar und unabhängig vom konkreten Dataset** sein.
