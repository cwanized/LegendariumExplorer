# FRS – Tree-Render-Logik R3

## 1. Zweck und Geltungsbereich

Dieses Dokument definiert die fachlichen und technischen Anforderungen an die neue Tree-Render-Logik **R3**.

R3 ersetzt das bisherige heuristische Layout durch eine eigene, deterministische Render-Engine auf Basis eines **virtuellen Rasters**.

Die bestehende Anwendung, Datenhaltung und UI bleiben grundsätzlich bestehen. R3 übernimmt ausschließlich die Erzeugung einer stabilen Tree-Geometrie aus den bereits geladenen und validierten Daten.

Ziele:

- biologische Abstammung korrekt und deterministisch darstellen
- Generationen auf definierten Ebenen halten
- Familien als zusammenhängende Layout-Einheiten behandeln
- Ehepartner und Mehrfachheiraten fachlich korrekt abbilden
- Kinder symmetrisch zur gemeinsamen Elternachse platzieren
- House-Kontexte und House-Anker kontrolliert integrieren
- kuratierte vertikale Offsets ermöglichen
- Kollisionen durch diskrete Platzreservierung statt nachträgliches Verschieben vermeiden
- Tree-Logik vollständig von der UI entkoppeln

R3 ist **kein allgemeiner Graph-Layout-Algorithmus**. Es handelt sich um eine domänenspezifische Layout-Engine für genealogische bzw. biologische Stammbäume mit ergänzenden Beziehungs-Overlays.

---

# 2. Grundprinzip der R3-Engine

Die Engine arbeitet in mehreren logisch getrennten Schritten:

```text
geladene Daten
     │
     ▼
biologische Tree-Struktur
     │
     ▼
House-Kontext / House-Cluster
     │
     ▼
Familienblöcke
     │
     ▼
virtuelles Raster
     │
     ▼
Slot-/Zellplatzierung
     │
     ▼
Verbindungen
     │
     ▼
Renderdaten
```

Die Engine soll **nicht** zuerst fertige Pixel-/Canvas-Koordinaten erzeugen und diese anschließend korrigieren.

Stattdessen wird zuerst eine fachliche, diskrete Layoutstruktur aufgebaut. Erst daraus werden die finalen Renderkoordinaten berechnet.

---

# 3. Virtuelles Raster

## 3.1 Grundidee

Das Layout basiert auf einem virtuellen, diskreten Raster.

Das Raster ist keine sichtbare UI-Komponente. Es ist ein internes Modell der Tree-Engine.

Es definiert:

- Generationsebenen
- horizontale Slots
- vertikale Positionen
- reservierte Bereiche
- Familienachsen
- House-Cluster
- Abstände

Die sichtbare Größe einer Personendarstellung darf die fachliche Rasterbelegung nicht verändern.

## 3.2 Personenraster

Jede sichtbare Person besitzt genau einen eindeutigen Personenslot.

```text
Generation N
────────────────────────────────
        [P1]      [P2]      [P3]

Generation N+1
────────────────────────────────
   [P4]      [P5]      [P6]      [P7]
```

Regeln:

- Eine Person darf nicht mehrere unabhängige Personenzellen belegen.
- Zwei Personen dürfen niemals dieselbe Personenzelle beanspruchen.
- Die Zellzuweisung ist deterministisch.
- Die sichtbare Node-Größe ist von der logischen Zellbelegung getrennt.

## 3.3 Familienraster

Zwischen den Personenebenen existiert ein separates logisches Familien-/Junction-Raster.

Es dient für:

- Familienmittelpunkte
- Eltern-Kind-Verbindungen
- Partnerachsen
- Familienblock-Mittelpunkte
- reservierte Verbindungsbereiche

Personenraster und Familienraster sind gekoppelt, aber nicht identisch.

---

# 4. Render-Regeln

## 4.1 Biologische Struktur

Nur `biological_parent` bildet die primäre Tree-Struktur.

Andere Beziehungen dürfen die biologische Platzierung nicht verändern.

Insbesondere:

- `marriage`
- Adoption
- Stiefelternschaft
- Mentorship
- sonstige soziale Beziehungen

sind keine primären Layout-Kanten.

Sie werden, soweit erforderlich, als Overlay dargestellt.

## 4.2 Generationen

Biologische Generationen werden auf vertikalen Ebenen dargestellt.

Personen derselben biologischen Generation sollen grundsätzlich auf derselben logischen Ebene liegen.

Kuratierte `yOffset`-Werte dürfen die sichtbare Position verändern, dürfen aber die biologische Generationenzugehörigkeit nicht verändern.

## 4.3 Familienblock

Eine Ehe zwischen zwei Personen bildet zusammen mit ihren gemeinsamen biologischen Kindern einen **Familienblock**.

Ein Familienblock enthält mindestens:

- Elternpersonen
- Partnerbeziehung
- gemeinsame Familienachse / Junction
- Kindergruppe

Beispiel:

```text
        Frau ─── Mann
             │
       ┌─────┼─────┐
      K1    K2    K3
```

Der Familienblock ist eine primäre Layout-Einheit.

Nicht einzelne Personen werden unabhängig voneinander platziert und anschließend verbunden.

## 4.4 Elternachse

Jeder Familienblock besitzt eine explizite horizontale Achse.

Diese Achse wird aus der gemeinsamen Position der Eltern bestimmt.

Die Kindergruppe wird symmetrisch um diese Achse angeordnet.

```text
          Frau ─── Mann
                │
        ┌───────┼───────┐
       K1      K2      K3
```

Bei gerader Kinderzahl liegt die Achse zwischen den mittleren Kindern.

Die Engine darf nicht einfach alle Kinder an den Vater hängen. Die biologische Verbindung der Kinder erfolgt fachlich über den **gemeinsamen Elternblock**.

---

# 5. Primäre Blutlinienlogik

Die Tree-Engine benötigt eine deterministische primäre Traversierungs-/Linienlogik.

Die fachliche Regel lautet:

> Die männliche Linie führt die primäre Linie fort.

Das bedeutet **nicht**, dass männliche Kinder geometrisch bevorzugt werden.

```text
             Großvater
                 │
               Vater
                 │
          ┌──────┴──────┐
        Sohn A         Sohn B
```

Sohn A und Sohn B werden als Geschwister symmetrisch platziert.

Die männliche Linie wird lediglich für die fachliche Weiterführung des primären Tree-Kontexts verwendet.

Die Geometrie der Geschwistergruppe bleibt unabhängig vom Geschlecht symmetrisch.

---

# 6. Mehrfachheirat

Mehrfachheirat ist ein zentraler Bestandteil von R3.

## 6.1 Grundregel

Ein Mann wird in der primären männlichen Linie **nur einmal dargestellt**.

Seine Ehepartner werden auf derselben Personen-/Generationsachse als aufeinanderfolgende Partnerblöcke angeordnet.

```text
Frau 1 ── Mann ── Frau 2 ── Frau 3
   │        │        │          │
 K1 K2    K3 K4      K5       K6 K7
```

Regeln:

- Mann nur einmal
- erste Ehe links
- zweite Ehe rechts
- weitere Ehepartner anschließend rechts
- jede Ehe bildet einen eigenen Familienblock
- jede Ehe besitzt ihre eigene Kindergruppe

## 6.2 Eheblöcke

Jeder Eheblock ist unabhängig platzierbar.

Der gemeinsame Mann darf dabei nicht als doppelte Person gerendert werden.

Die Personenzelle des Mannes ist eindeutig; mehrere Familienblöcke können auf diese Person referenzieren.

## 6.3 Kinder verschiedener Ehen

Kinder verschiedener Ehen dürfen nicht zu einer gemeinsamen Kindergruppe zusammengeführt werden.

```text
Frau 1 ── Mann ── Frau 2
   │                  │
 K1 K2               K3 K4
```

K1/K2 gehören ausschließlich zum ersten Eheblock.

K3/K4 gehören ausschließlich zum zweiten Eheblock.

---

# 7. Geschwisterplatzierung

Geschwister werden innerhalb einer Kindergruppe symmetrisch um die Elternachse verteilt.

```text
             Eltern
               │
       ┌───────┼───────┐
      K1      K2      K3
```

Die Reihenfolge wird deterministisch bestimmt:

1. `metadata.order`
2. Geburtsdatum, soweit vorhanden
3. Name
4. UUID

Keine zufällige oder von Lade-/Objektreihenfolge abhängige Sortierung.

---

# 8. Familienbreite und Reservierung

Familienblöcke müssen vor der finalen Platzierung eine logische Breite erhalten.

Die Breite berücksichtigt mindestens:

- Eltern
- Partner
- Kindergruppe
- Partnerabstände
- Geschwisterabstände
- reservierte Leerslots
- abhängige Unterfamilien, soweit für die Clusterplatzierung erforderlich

Ziel:

> Ein bereits platzierter Familienblock soll nicht nachträglich durch einen benachbarten Block verdrängt werden müssen.

Die Engine soll Platz **reservieren**, bevor die endgültige Slotbelegung erfolgt.

---

# 9. Reservierte Leerslots

Leere Raster-Slots sind erlaubt und ausdrücklich vorgesehen.

Sie dürfen verwendet werden für:

- Symmetrie
- Partnerkontinuität
- Mehrfachheirat
- breite Kindergruppen
- Abstände zwischen Familienblöcken
- Vermeidung von Kantenkreuzungen
- visuelle Lesbarkeit

Ein Leerslot ist kein Personenobjekt und besitzt keine Entity-ID.

---

# 10. Typisierte Abstände

R3 verwendet unterschiedliche Abstandsklassen.

Mindestens:

- Geschwisterabstand
- Partnerabstand
- Abstand zwischen Familienblöcken
- Abstand zwischen House-Clustern
- vertikaler Generationsabstand

Diese Werte müssen zentral konfigurierbar sein.

Die Engine darf nicht sämtliche Abstände auf eine einzige globale X-/Y-Lücke reduzieren.

---

# 11. House-Logik

## 11.1 House-Tier

Häuser unterscheiden zwischen:

```text
tier = start
tier = later
```

### `start`

Ein Start-Haus kann einen grafischen Startpunkt besitzen.

Alle Start-Häuser werden auf der definierten Base Line bzw. ihrem konfigurierten Offset gestartet.

### `later`

Ein späteres Haus erzeugt keinen eigenen grafischen Root-Startpunkt.

Beispiel: Dúnedain kann sich fachlich aus früheren Gruppen entwickeln. Daraus soll nicht automatisch ein neuer Tree-Root entstehen.

---

# 12. House Anchor

Der Anchor ist kein nachträglich hinzugefügtes Label.

Der Anchor ist **Person 0 des House-Trees**.

```text
House
  │
  ▼
Person 0 / Anchor
  │
  ├── Person 1
  ├── Person 2
  └── ...
```

Wenn `anchor.enabled = true`:

- fungiert der Anchor als Startpunkt des House-Trees
- wird die Tree-Struktur von diesem Punkt aus aufgebaut
- ist der Anchor Bestandteil des normalen Personenrasters
- wird der Anchor nicht nachträglich an einen bereits berechneten Baum angehängt

Die House-Logik muss den Anchor bereits während der Tree-Konstruktion berücksichtigen.

---

# 13. House-Reihenfolge

Die Reihenfolge der House-Cluster wird über die House-Definition bestimmt.

Beispiel:

```json
{
  "id": "house-of-beor",
  "displayName": "House of Beor",
  "tier": "start",
  "anchor": {
    "enabled": true,
    "order": 40
  }
}
```

`anchor.order` bestimmt die Reihenfolge der House-Cluster.

Es darf keine zweite parallele House-Sortierregel eingeführt werden.

---

# 14. House yOffset

Häuser dürfen einen vertikalen Offset besitzen.

```json
{
  "layout": {
    "yOffset": 10
  }
}
```

Regel:

> 1 `yOffset` entspricht 1 Generationseinheit.

Der Offset wird auf den House-Startpunkt / House-Cluster angewendet.

Damit kann beispielsweise ein House bewusst unterhalb der allgemeinen Base Line beginnen.

Wichtig:

- Der Offset verändert nicht die biologische Topologie.
- Der Offset verschiebt nicht nur das sichtbare Label.
- Der gesamte fachliche House-Kontext wird entsprechend verschoben.
- Der Offset wird bereits bei der Rasterplatzierung berücksichtigt.
- Nachträgliches Verschieben des fertig berechneten House-Baums ist nicht zulässig.

---

# 15. House-Cluster

Ein House-Cluster ist die Layout-Einheit eines Start-Houses.

Er umfasst:

- House-Anchor / Person 0
- sichtbaren Folgebaum
- benötigten horizontalen Platz
- benötigten vertikalen Platz
- abhängige Familienblöcke

House-Cluster dürfen sich nicht überlappen.

Die Breite eines House-Clusters wird vor der finalen Positionierung abgeschätzt.

Die Position des Anchors wird aus der finalen Cluster-Geometrie bestimmt, nicht umgekehrt.

---

# 16. Mehrere Häuser an einer Person

Eine Person kann mehreren Häusern zugeordnet sein.

```json
"houses": [
  "noldor",
  "teleri"
]
```

Der erste Eintrag ist das **führende Haus**.

Regeln:

- erstes Haus = primärer House-Kontext
- weitere Häuser = zusätzliche Metadaten/Kontexte
- weitere Häuser erzeugen nicht automatisch zusätzliche Root-Anker
- eine Person wird dadurch nicht mehrfach gerendert

---

# 17. Soziale Beziehungen

Soziale Beziehungen sind nicht Teil der primären biologischen Layoutstruktur.

Beispiele:

- `marriage`
- Adoption
- Stiefelternschaft
- Mentorship
- sonstige soziale Beziehungen

Sie dürfen als Overlay gerendert werden.

Grundregel:

> Ein soziales Overlay darf die biologische Rasterplatzierung nicht verändern.

Insbesondere darf eine Heiratslinie nicht dazu führen, dass bereits platzierte biologische Familienblöcke nachträglich umsortiert werden.

---

# 18. Determinismus

R3 muss bei identischen Eingabedaten immer dasselbe Layout erzeugen.

Identisch müssen insbesondere sein:

- Personenslots
- Familienblöcke
- House-Cluster
- Reihenfolgen
- yOffset-Anwendung
- reservierte Slots
- Kanten
- finale Renderkoordinaten

Die Engine darf keine von Laufzeit-/Objektreihenfolge abhängigen Entscheidungen treffen.

---

# 19. Render-Pipeline

Die Implementierung soll logisch mindestens diese Schritte besitzen:

### Phase 1 – Tree-Aufbau

Biologische Beziehungen in eine interne Tree-/Familienstruktur überführen.

### Phase 2 – House-Kontext

Start-Häuser und deren Anchor/Person-0 bestimmen.

### Phase 3 – Familienblöcke

Ehen und gemeinsame Kinder zu Familienblöcken zusammenfassen.

### Phase 4 – Breitenberechnung

Benötigte Breiten und reservierte Bereiche bestimmen.

### Phase 5 – Rasterplatzierung

Personen, Familienachsen, House-Cluster und Leerslots auf das virtuelle Raster verteilen.

### Phase 6 – yOffset

Kuratierte House-/Personen-Offsets innerhalb der Rasterlogik anwenden.

### Phase 7 – Verbindungen

Biologische und soziale Verbindungen aus der fertigen Rastergeometrie ableiten.

### Phase 8 – Renderdaten

Eine UI-unabhängige Renderstruktur zurückgeben.

Die UI soll ausschließlich diese Renderdaten darstellen.

---

# 20. Output der Tree-Engine

Die Engine erzeugt keine React-Komponenten und keine Canvas-/SVG-Elemente.

Sie liefert eine UI-unabhängige Renderstruktur, konzeptionell z. B.:

```text
TreeRenderResult
 ├── persons
 │    ├── id
 │    ├── gridPosition
 │    └── renderPosition
 │
 ├── families
 │    ├── id
 │    ├── parentIds
 │    ├── childIds
 │    └── junction
 │
 ├── houses
 │    ├── id
 │    ├── anchorPersonId
 │    └── bounds
 │
 ├── edges
 │    ├── biological
 │    └── overlay
 │
 └── bounds
```

Die konkrete TypeScript-Struktur darf davon abweichen, solange die fachliche Trennung erhalten bleibt.

---

# 21. Nicht Bestandteil von R3

R3 behandelt ausschließlich Tree-Logik und Render-Geometrie.

Nicht Bestandteil dieses Dokuments:

- Zoom
- Pan
- Navigation
- UI-Selection
- Shift-Selection
- Timeline
- Events
- GEDCOM
- JSON-Parsing
- Datenvalidierung
- UUID-Erzeugung
- React-Komponenten
- GitHub Pages
- PSModule
- Performance-/Deployment-Infrastruktur
- allgemeine Produktlogik

Diese Funktionen bleiben in ihren bestehenden Architektur-/PRD-Dokumenten.

---

# 22. Implementierungsleitlinien

Zu vermeiden:

- nachträgliches manuelles Verschieben einzelner Nodes
- zufällige Positionierung
- Abhängigkeit von DOM-Größen für die Tree-Logik
- versteckte UI-Zustände innerhalb des Layout-Algorithmus
- mehrere konkurrierende Sortierregeln
- Duplizieren einer Person wegen Mehrfachheirat
- Erzeugen zusätzlicher Root-Anker für `tier=later`
- Behandlung des House-Anchors als nachträgliches Label

Bevorzugt:

- diskrete Slots
- explizite Familienblöcke
- explizite Familienachsen
- Vorab-Reservierung
- deterministische Sortierung
- klar getrennte House-, Familien- und Personenlogik
- reproduzierbare Renderdaten
- kleine, testbare Layoutphasen

---

# 23. Akzeptanzkriterien

R3 gilt fachlich als korrekt, wenn mindestens folgende Fälle deterministisch dargestellt werden können:

1. Einfaches Ehepaar mit mehreren Kindern.
2. Gerade und ungerade Anzahl von Kindern mit symmetrischer Platzierung.
3. Geschwister ohne geschlechtsabhängige Geometrie.
4. Ein Mann mit zwei Ehefrauen und getrennten Kindergruppen.
5. Ein Mann mit drei Ehefrauen und getrennten Kindergruppen.
6. Kinder aus verschiedenen Ehen werden getrennt gehalten.
7. Mehrere Houses nebeneinander mit definierter `anchor.order`.
8. Start-House mit Anchor als Person 0.
9. `tier=later` House ohne eigenen Root-Anchor.
10. House-`yOffset` mit korrekter Generationseinheit.
11. Eine Person mit mehreren Houses ohne doppelte Personendarstellung.
12. Breite Geschwistergruppen ohne Zellkollision.
13. Breite House-Cluster ohne Überlappung.
14. Soziale Overlays ohne Veränderung des biologischen Layouts.
15. Identische Eingabedaten erzeugen identische Renderdaten.

---

# 24. Leitentscheidung

R3 ist bewusst **kein weiterer Optimierungsschritt eines generischen Graph-Layouts**.

Die Tree-Engine soll die genealogischen Regeln selbst verstehen:

```text
Person
  ↓
Familie
  ↓
Familienblock
  ↓
House-Kontext
  ↓
Raster
  ↓
Rendergeometrie
```

Die zentrale Designentscheidung lautet:

> **Erst fachlich korrekt auf einem virtuellen Raster platzieren, danach rendern. Nicht zuerst frei layouten und anschließend versuchen, die genealogischen Regeln zu reparieren.**
