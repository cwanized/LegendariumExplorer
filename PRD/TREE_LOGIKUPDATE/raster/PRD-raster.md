
# PRD — Umbau Tree-Rendering auf virtuelle Raster-Layout-Engine

## 1. Zweck

Dieses Dokument beschreibt **ausschließlich den Umbau der bestehenden Tree-Rendering-/Layout-Logik**.

Die bestehende Anwendung bleibt erhalten.

Es werden **keine neuen Seiten, keine neue Datenarchitektur und keine neuen allgemeinen UI-Funktionen** gefordert.

Der bestehende Datenlade-/Normalisierungs-/Validierungspfad soll soweit möglich weiterverwendet werden.

Der zentrale Umbau ist:

```text
Bisher:

Daten
  ↓
Tree-Logik
  ↓
ELK / generisches Graph-Layout
  ↓
Rendering


Neu:

Daten
  ↓
bestehende Tree-/Validierungslogik
  ↓
virtuelles Tree-Modell
  ↓
virtuelles Raster
  ↓
eigene Layout-Logik
  ↓
Connector-Geometrie
  ↓
bestehendes Rendering / bestehende UI
```

Ziel ist eine **deterministische, genealogisch kontrollierte Positionierung**, die die spezifischen Regeln des Projekts besser erfüllt als ein generischer Graph-Layout-Algorithmus.

---

# 2. Harte Vorgabe

Die bestehende App bleibt funktional und optisch grundsätzlich bestehen.

Der Umbau betrifft primär:

- Tree-Aufbau
- Node-Positionierung
- Family-/Couple-Layout
- House-Positionierung
- Connector-Layout
- Collision Handling
- Übergabe der berechneten Positionen an den bestehenden Renderer

Nicht Bestandteil dieses Umbaus:

- neue Navigation
- neue Seiten
- neues Datenmodell
- neue Zoom-/Pan-Implementierung
- neue Selection-Logik
- neue Timeline
- neue allgemeine UI
- Datenbank
- Backend

Bestehende Funktionen sollen nach dem Umbau weiterhin funktionieren.

---

# 3. Architekturentscheidung

Für den primären genealogischen Tree wird **kein generischer Graph-Layout-Algorithmus mehr verwendet**.

Insbesondere:

- ELK.js nicht mehr als primäre Layout-Engine
- Dagre nicht als primäre Layout-Engine
- keine heuristische Graph-Positionierung als Ersatz

Stattdessen wird eine eigene Layout-Engine auf Basis eines **virtuellen Rasters** implementiert.

Das Raster ist logisch, nicht pixelbasiert.

---

# 4. Grundidee des virtuellen Rasters

Jeder Layout-Knoten erhält zunächst logische Koordinaten:

```text
row
column
```

Dabei gilt:

```text
row = vertikale Generationsebene
column = horizontale Position
```

Erst anschließend werden daraus die tatsächlichen Bildschirmkoordinaten berechnet.

Beispiel:

```text
              column
        0   1   2   3   4   5   6

row 0       [A]     [B]

row 1   [C]     [D]     [E]

row 2       [F] [G] [H]
```

Die konkrete Pixelposition darf niemals die fachliche Bedeutung einer Generation bestimmen.

---

# 5. Render-Regeln

Dieses Kapitel enthält die **fachlichen und geometrischen Regeln**, die die neue Raster-Engine verbindlich einhalten muss.

## 5.1 Generationen

Personen derselben biologischen Generation werden auf derselben logischen Rasterzeile positioniert.

```text
Generation N
────────────────────────

Generation N+1
────────────────────────

Generation N+2
────────────────────────
```

```text
row = vertikale Generationsebene
column = horizontale Position
```

Eine biologische Elternschaft führt grundsätzlich eine Generation nach unten.

---

## 5.2 Ehepartner / Couple Block

Ehepartner befinden sich auf derselben Generationsebene.

Sie bilden für die Darstellung ihrer gemeinsamen Kinder einen gemeinsamen **Couple Block**.

```text
┌──────────┐     ┌──────────┐
│   Tata   │─────│  Tatië   │
└──────────┘     └──────────┘
        \          /
         \        /
          \      /
           ──────
              │
```

Der Couple Block ist ein virtuelles Layout-Objekt und kein Datenobjekt.

---

## 5.3 Kinder gehören zum Couple

Kinder werden nicht ausschließlich am Vater positioniert.

Der Eltern-Connector geht vom Zentrum des Couple Blocks zur Kindergruppe.

```text
Tata ─── Tatië
    \     /
     \   /
      ─┬─
       │
   ┌───┴───┐
   │       │
 Kind A  Kind B
```

---

## 5.4 Symmetrische Kinderpositionierung

Die Kindergruppe wird möglichst symmetrisch um das Zentrum des Couple Blocks angeordnet.

Zwei Kinder:

```text
        Couple
          │
      ────┴────
      │       │
     A         B
```

Drei Kinder:

```text
        Couple
          │
     ─────┼─────
     │    │    │
     A    B    C
```

Vier Kinder:

```text
        Couple
          │
   ───────┼───────
   │      │      │
   A      B      C      D
```

Die horizontale Mitte der Kindergruppe soll möglichst der horizontalen Mitte des Couple Blocks entsprechen.

---

## 5.5 Family Block

Für das Layout wird aus einem Couple und seinen gemeinsamen Kindern ein virtueller `FamilyBlock`.

```text
FamilyBlock
├── CoupleBlock
│   ├── Person A
│   └── Person B
└── Children
    ├── Person C
    ├── Person D
    └── Person E
```

`FamilyBlock`, `CoupleBlock` und ähnliche Objekte existieren ausschließlich während des Layouts.

---

## 5.6 House Anchor

Ein House mit `tier: "start"` besitzt einen Anchor.

Der Anchor ist der **virtuelle Root-Knoten des House-Trees**.

Er ist von Anfang an Teil des virtuellen Tree-Modells und wird nicht nachträglich an einen bereits berechneten Tree angehängt.

```text
House
  │
  ●  ← Anchor / Person 0
  │
  ├── Person 1
  │
  └── Person 1
```

Der Anchor kann fachlich als „Person 0“ des House-Trees betrachtet werden, ist technisch aber **keine echte Person**.

Er besitzt:

- keine Person-ID
- keine Personendaten
- keine echten biologischen Beziehungen

Er ist ein virtueller Layout-Root.

---

## 5.7 Start-Houses

Ein `start`-House erhält einen eigenen Anchor.

Der Anchor wird auf der Base Line positioniert.

```text
──────────────────────────────────
             BASE LINE
──────────────────────────────────

       ●                    ●
       │                    │
 House A                 House B
```

Alle Start-Houses werden anhand ihrer `anchor.order` horizontal sortiert.

---

## 5.8 House Anchor Order

Beispiel:

```json
"anchor": {
  "enabled": true,
  "order": 40
}
```

Die Reihenfolge der Start-Houses wird ausschließlich über `anchor.order` bestimmt.

Bei gleichem `order` wird die House-ID lexikographisch als deterministischer Tie-Breaker verwendet.

Nicht verwenden:

- Dateireihenfolge
- JSON-Reihenfolge
- Lade-Reihenfolge
- zufällige Sortierung

---


## 5.9 person yOffset

Eine peson kann einen `yOffset` besitzen.

Dies greift auch für deren ehepartnr



fachliches beispiel: thingol ist sehr weit oben, aber thematisch würde ich ihn

## 5.9 House yOffset

Ein House kann einen `yOffset` besitzen:

```json
"layout": {
  "yOffset": 10
}
```

Der `yOffset` wird **direkt auf den House-Anchor angewendet**.

```text
House Anchor
↓
Anchor erhält yOffset
↓
gesamter House-Tree wird relativ dazu aufgebaut
```

Der Anchor wird also nicht nachträglich an den Tree angehängt und der fertige Tree wird nicht separat verschoben.

---

## 5.10 Bedeutung von yOffset

Ein Offset entspricht einer Generationseinheit.

```text
1 yOffset = 1 Generation
```

Formal:

```text
anchor.row = baseRow + yOffset
```

Beispiel:

```text
Anchor row = 5

Child       row = 6

Grandchild  row = 7
```

Der Offset wird nicht separat auf jede Person angewendet.

---

## 5.11 Later-Houses

Ein `tier: "later"` House erhält keinen eigenen grafischen Root/Startpunkt.

Beispiel:

```text
Edain
  │
  └── Dúnedain
```

Das spätere House wird in den bereits bestehenden genealogischen Tree integriert.

Dadurch entsteht nicht der Eindruck, dass jeder House-Begriff einen unabhängigen genealogischen Ursprung besitzt.

---

## 5.12 Männliche House-Linie

Die männliche Linie führt die House-Linie fort.

Dies ist eine **House-/Visualisierungsregel**, keine Änderung der biologischen Daten.

Beispiel:

```text
Father ─── Mother
     \     /
      \   /
       ─┬─
        │
       Son
        │
       Son
```

Töchter bleiben vollständig im biologischen Tree enthalten.

---

## 5.13 Männliche Linie und Couple Block

Die House-Fortführung darf niemals dazu führen, dass Kinder grafisch nur am Mann hängen.

```text
Father ─── Mother
      \    /
       \  /
        ─┬─
         │
        Son
```

Der biologische Connector kommt aus dem Couple Block.

---

## 5.14 Mehrere Generationen innerhalb eines House-Trees

Das Layout berücksichtigt den vollständigen House-Teilbaum.

```text
Anchor
  │
  └── P1
       │
       └── P2 ─── Spouse
                  │
                  ├── P3
                  └── P4
```

Die horizontale Positionierung darf nicht ausschließlich aus den unmittelbaren Eltern-/Kind-Beziehungen berechnet werden. Der benötigte Platz des gesamten Unterbaums muss berücksichtigt werden.

---

## 5.15 Bottom-Up-Berechnung

Die Breite von Teilbäumen wird grundsätzlich **bottom-up** bestimmt.

Beispiel:

```text
          Couple
             │
      ┌──────┼──────┐
      A      B      C
```

Zuerst wird die benötigte Breite für `A`, `B` und `C` berechnet.

Danach wird der Couple Block über der Mitte dieser Gesamtbreite positioniert.

---

## 5.16 Horizontale Kollisionen

Wenn unabhängige Layout-Blöcke kollidieren:

1. Generationsebene erhalten
2. Couple-Integrität erhalten
3. House-Reihenfolge erhalten
4. betroffenen Block horizontal verschieben
5. abhängige Kinderpositionen entsprechend neu berechnen
6. erneut prüfen

Keine zufälligen Verschiebungen.

Die Auflösung muss deterministisch sein.

---

## 5.17 House-Reihenfolge hat Priorität

Die explizite House-Reihenfolge darf nicht durch geometrisches Packing verändert werden.

```text
House A   House B   House C
```

muss diese Reihenfolge behalten.

Auch wenn eine andere Reihenfolge geometrisch kompakter wäre.

---

## 5.18 House-Abstände

Zwischen unabhängigen House-Teilbäumen soll ein definierter Mindestabstand existieren.

Der Abstand ist eine Layout-Konfiguration und keine fachliche Generationseinheit.

---

## 5.19 Connectoren

Connectoren werden **nach der Node-/Blockpositionierung** berechnet.

```text
Virtual Grid
   ↓
Node Geometry
   ↓
Connector Geometry
```

Die Tree-Logik darf nicht auf bereits gerenderte DOM-Positionen angewiesen sein.

---

## 5.20 Biologischer Connector

Für einen Couple Block:

```text
┌──────┐ ┌──────┐
│  A   │─│  B   │
└──────┘ └──────┘
     \     /
      \   /
       ─┬─
        │
       Child
```

Der Connector muss:

- beide Eltern logisch berücksichtigen
- aus dem Couple-Zentrum kommen
- die Kindergruppe korrekt erreichen
- nicht durch Person-Nodes verlaufen

---

## 5.21 Marriage-Connector

Die bestehende Darstellung von Marriage bleibt erhalten.

Die neue Engine liefert die korrekten geometrischen Endpunkte.

```text
Person A ─── Person B
```

Die konkrete visuelle Gestaltung bleibt Aufgabe des bestehenden Renderers.

---

## 5.22 Social Relations

Social Relations bleiben vom biologischen Layout getrennt.

Beispiele:

- mentor
- step_parent
- adoption
- weitere soziale Beziehungen

Sie dürfen die biologische Generationseinteilung nicht verändern.

Die bestehende Darstellung dieser Relationen bleibt möglichst unverändert.

---

## 5.23 Datenmodell und virtuelle Layout-Objekte

Das kanonische Datenmodell bleibt unverändert.

Virtuelle Objekte wie:

- `HouseAnchor`
- `CoupleBlock`
- `FamilyBlock`

sind ausschließlich Runtime-/Derived-Modelle.

Sie dürfen nicht als Personen oder Beziehungen in die kanonischen JSON-Daten zurückgeschrieben werden.

---

## 5.24 Validation vor Layout

Die bestehende Validierung bleibt fachlich vorgeschaltet.

```text
JSON
 ↓
Parsing
 ↓
Validation / Normalisierung
 ↓
biologischer Graph
 ↓
Virtual Tree
 ↓
Raster Layout
```

Der Renderer bekommt keinen ungeprüften biologischen Graphen als Grundlage.

Der Renderer darf keine Beziehungen erfinden oder stillschweigend korrigieren.

---

## 5.25 Ungültige biologische Strukturen

Die bestehenden Validierungsregeln bleiben bestehen:

- fehlende Referenzen → Warnung / ignorieren
- Selbst-Elternschaft → Warnung / ignorieren
- mehr als zwei biologische Eltern → alle entsprechenden biologischen Kanten für den Tree ignorieren / Warnung
- Zyklen → deterministisch auflösen

Der Raster-Renderer selbst soll diese Regeln nicht duplizieren, sofern sie bereits im Validation Layer implementiert sind.

---

## 5.26 Determinismus

Identische Eingangsdaten müssen identische Layout-Ergebnisse erzeugen.

Das betrifft insbesondere:

- House-Reihenfolge
- Generation
- Anchor-Position
- Child-Reihenfolge
- Couple-Position
- FamilyBlock-Breite
- Collision Resolution
- Connector-Geometrie

Keine Zufallswerte.

Keine Abhängigkeit von:

- Objekt-Iteration
- Dateireihenfolge
- Browser-Verhalten
- DOM-Reihenfolge

---

# 6. Layout-Engine

Die neue Engine arbeitet in logisch getrennten Phasen:

```text
1. Daten übernehmen
2. validierten biologischen Graphen übernehmen
3. House-Roots / Anchors erzeugen
4. biologische Tree-Strukturen aufbauen
5. Marriage-/Couple-Strukturen erzeugen
6. Generationen bestimmen
7. Teilbaumgrößen berechnen
8. horizontale Positionen berechnen
9. Kollisionen auflösen
10. finale Node-Geometrie erzeugen
11. Connector-Geometrie erzeugen
12. bestehendem Renderer übergeben
```

Jede Phase soll möglichst unabhängig testbar sein.

---

# 7. Virtuelles Raster

Das Raster ist die fachliche Layout-Ebene.

Beispiel:

```text
row    = 7
column = 14
```

Erst daraus entstehen Bildschirmkoordinaten:

```text
x = column * gridColumnSize
y = row * generationHeight
```

Die konkreten Werte für:

- Node-Abstände
- Generation Height
- Couple Gap
- House Gap
- Sibling Gap

sollen konfigurierbar sein.

Es darf keine pixelbasierte Fachlogik geben.

Nicht:

```ts
person.y += 480;
```

wenn damit fachlich „eine Generation“ gemeint ist.

Stattdessen:

```ts
person.row += 1;
```

und erst anschließend:

```ts
y = row * generationHeight;
```

---

# 8. Integration in den bestehenden Renderer

Die neue Engine liefert ein neutrales Layout-Ergebnis.

Beispiel:

```ts
interface LayoutNode {
  id: string;
  row: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutResult {
  nodes: LayoutNode[];
  connectors: LayoutConnector[];
}
```

Die tatsächliche bestehende Typstruktur muss vor Implementierung geprüft werden.

Keine parallelen konkurrierenden Node-Modelle erzeugen, wenn bereits geeignete Modelle existieren.

---

# 9. Renderer-Integration

Die neue Layout-Engine darf nicht von React-Komponenten oder dem DOM abhängig sein.

Nicht zulässig:

- DOM messen
- React-Komponenten abfragen
- gerenderte Elemente suchen
- CSS-Positionen auslesen

Die Layoutentscheidung muss aus dem virtuellen Modell entstehen.

Node-Größen dürfen als Layoutparameter berücksichtigt werden.

Falls die bestehende Anwendung konstante Node-Größen verwendet, soll zunächst mit einer konfigurierbaren Standardgröße gearbeitet werden.

---

# 10. Bestehende UI-Funktionen

Folgende bestehende Funktionen bleiben unverändert:

- Zoom
- Pan
- Click Selection
- Shift-Selection
- Highlighting
- Ausgrauen nicht relevanter Nodes
- bestehende Node-Darstellung
- bestehende Social-Relation-Darstellung

Sie sind **nicht Teil des Layout-Umbaus**.

Der neue Layout-Layer muss lediglich weiterhin die erforderlichen stabilen IDs und Positionen liefern.

---

# 11. Performance

Der Umbau soll keine unnötige Neuberechnung verursachen.

Insbesondere:

- kein komplettes Layout bei Selection
- kein komplettes Layout bei Zoom/Pan
- Layout nur bei relevanten Daten-/Layoutänderungen
- keine DOM-basierte iterative Positionierung

Die Performance soll anhand des bestehenden Demo-Datensatzes geprüft werden.

---

# 12. Tests

Die neue Tree-Engine muss ohne UI testbar sein.

Minimaler Testpfad:

```text
Input JSON
    ↓
Virtual Tree
    ↓
Virtual Grid
    ↓
LayoutResult
```

Das Ergebnis muss serialisierbar sein.

Beispiel:

```json
{
  "id": "person-uuid",
  "row": 5,
  "column": 12
}
```

## Pflichtfälle

### 12.1 Einfacher House-Tree

```text
Anchor
  ↓
Person
  ↓
Person
```

### 12.2 Couple

```text
Person ─ Person
```

### 12.3 Couple mit zwei Kindern

Kinder müssen symmetrisch unter dem Couple liegen.

### 12.4 Couple mit drei Kindern

Mitte des Child-Blocks muss mit Couple-Mitte übereinstimmen.

### 12.5 House yOffset

`yOffset = N` muss den Anchor um exakt N Generationseinheiten verschieben.

### 12.6 House order

Houses müssen in `anchor.order` erscheinen.

### 12.7 Later House

Kein künstlicher Root/Anchor.

### 12.8 Mehrere Houses

Unabhängige House-Teilbäume dürfen nicht kollidieren.

### 12.9 Mehrere Generationen

Alle Personen einer Generation müssen dieselbe `row` erhalten.

### 12.10 House-Männerlinie

House-Fortführung darf die biologische Couple-Darstellung nicht beschädigen.

### 12.11 Social Overlay

Social Relations dürfen keine Generation verändern.

### 12.12 Determinismus

Mehrfaches Layout desselben Inputs erzeugt identische Ergebnisse.

---

# 13. Debugging

Optional soll die Engine eine Debug-Repräsentation erzeugen können:

```text
House: House of Beor
Anchor: row=10 column=20

Generation 10:
  Anchor

Generation 11:
  Person A

Generation 12:
  Person B ─ Person C

Generation 13:
  Person D  Person E
```

Optional können Rasterlinien und Blockgrenzen im bestehenden UI visualisiert werden.

Dies ist ein Entwicklungswerkzeug und keine neue MVP-Funktion.

---

# 14. Implementierungsvorgehen

Vor Änderungen am bestehenden Code:

1. bestehende Tree-/Render-Architektur analysieren
2. vorhandene Datenmodelle und Interfaces identifizieren
3. aktuelle ELK-/Dagre-Nutzung vollständig lokalisieren
4. bestehende Selection-/Overlay-Schnittstellen identifizieren
5. vorhandene House-Logik prüfen
6. vorhandene Demo-Daten prüfen

Danach die neue Engine möglichst isoliert neben der bestehenden Layout-Logik implementieren.

Erst wenn die virtuelle Tree-/Raster-Engine durch Tests bestätigt ist, soll die bestehende Tree-Positionierung auf die neue Engine umgestellt werden.

Keine Big-Bang-Änderung des gesamten Frontends.

---

# 15. Keine eigenmächtigen Architekturentscheidungen

Wenn während der Implementierung eine fachliche oder architektonische Entscheidung notwendig wird, die durch dieses Dokument oder den vorhandenen Code nicht eindeutig beantwortet werden kann:

**Nicht raten. Nicht stillschweigend entscheiden.**

Stattdessen muss eine Wizard-Frage an den Auftraggeber gestellt werden.

Die Frage muss:

- die konkrete Unsicherheit benennen
- die relevanten Optionen erklären
- die Auswirkungen kurz nennen
- eine Empfehlung aussprechen, falls sinnvoll
- anschließend auf die Entscheidung warten

Beispiel:

> **Frage:** Zwei unabhängige FamilyBlocks benötigen mehr Platz als zwischen zwei House-Bereichen vorhanden ist. Soll der House-Abstand vergrößert oder der gesamte House-Bereich verschoben werden?
>
> **Empfehlung:** House-Reihenfolge und interne FamilyBlock-Geometrie erhalten und zuerst den verfügbaren Bereich erweitern.

---

# 16. Akzeptanzkriterien

Der Umbau ist erfolgreich, wenn:

1. ELK/Dagre nicht mehr für den primären Tree verwendet wird.
2. Der Tree über ein virtuelles Raster positioniert wird.
3. Generationen auf gemeinsamen Rasterzeilen liegen.
4. Ehepartner als Couple Block behandelt werden.
5. Kinder symmetrisch unter dem Couple positioniert werden.
6. Kinder nicht ausschließlich am Vater hängen.
7. `start`-Houses einen virtuellen Anchor/Root erhalten.
8. der Anchor logisch „Person 0“ des House-Trees entspricht.
9. `yOffset` direkt den Anchor verschiebt.
10. alle Nachkommen relativ zum Anchor positioniert werden.
11. `later`-Houses keinen künstlichen Startpunkt erzeugen.
12. `anchor.order` die horizontale House-Reihenfolge bestimmt.
13. die männliche House-Linie berücksichtigt wird, ohne die biologische Couple-Struktur zu beschädigen.
14. bestehende Social Relations weiterhin als Overlays funktionieren.
15. bestehende Zoom-/Pan-/Selection-Funktionen weiter funktionieren.
16. gleiche Eingangsdaten immer dasselbe Layout erzeugen.
17. das Layout ohne UI testbar ist.
18. das kanonische Datenmodell unverändert bleibt.

---

# 17. Zielbild

Die Engine soll konzeptionell folgende Struktur erzeugen:

```text
                         BASE LINE
──────────────────────────────────────────────────────

          ●                         ●
       House A                   House B
          │                         │
          │                         │
      ┌───┴───┐                 ┌───┴───┐
      │       │                 │       │
     A ───── B                  C ───── D
       \     /                    \     /
        \   /                      \   /
         ─┬─                        ─┬─
          │                          │
       ┌──┴──┐                    ┌──┴──┐
       │     │                    │     │
       E     F                    G     H
```

Die Positionen werden nicht durch einen generischen Graph-Layout-Algorithmus bestimmt.

Stattdessen:

```text
Daten
 ↓
validierter biologischer Graph
 ↓
virtuelles Tree-Modell
 ↓
virtuelle Rasterpositionen
 ↓
Node Geometry
 ↓
Connector Geometry
 ↓
bestehender Renderer
```

**Kernprinzip:**

> Der Tree wird zuerst als fachliche Struktur aufgebaut und anschließend als Raster positioniert. Nicht der gerenderte Graph bestimmt die Tree-Struktur.
