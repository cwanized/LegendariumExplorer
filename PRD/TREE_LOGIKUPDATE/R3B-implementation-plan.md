# R3B Implementation Plan

## 1. Ziel

Dieses Dokument uebersetzt die fachlichen Entscheidungen aus R3B-FRS-V1 in eine technische Umsetzungsreihenfolge.

Ziel ist kein Big-Bang-Rewrite.
Ziel ist ein kontrollierter neuer Tree-Core fuer einen separaten Mode R3B bei stabiler Preview3-UI.

## 2. Leitlinie

R3B wird in kleinen, pruefbaren Slices aufgebaut.

Jeder Slice muss:

- einen klaren Verantwortungsblock liefern
- eine kleine Zahl harter Invarianten pruefbar machen
- die bestehende Preview3-Integration nicht unnoetig aufbrechen
- R3 als Vergleichspfad unberuehrt lassen

## 3. Warum nicht direkt R3 refactoren

Die aktuelle R3-Implementierung mischt in einem Pfad:

- Platzierung
- Projektionen
- Elternanker-Auswahl
- Connector-Geometrie
- House-Anker-Ableitung
- spaetere Nachkorrekturen

Ein direktes Weiterrefactoren im bestehenden Modus waere riskant, weil fachliche Aenderungen und technische Entkopplung gleichzeitig stattfinden wuerden.

## 4. Zielbild fuer R3B

R3B soll in der Codebasis mindestens diese Schichten erhalten:

- ordering
- family normalization
- house clusters
- placement plan
- projections
- connector model
- render model adapter

Wichtig:

- Canvas und Page-Schicht konsumieren nur fertige Renderdaten.
- Fachliche Entscheidungen ueber sichtbare Elternpaare, Projektionswahl und Familienachsen entstehen im R3B-Core.

## 5. Vorgeschlagene Dateistruktur

Empfohlener neuer Bereich:

```text
app/src/preview3/r3b/
  ordering.ts
  families.ts
  houseClusters.ts
  placement.ts
  projections.ts
  connectors.ts
  renderModel.ts
  types.ts
```

Ergaenzungen an bestehender Struktur:

- app/src/preview3/modeR3B.ts
- app/src/preview3/modes.ts
- app/src/preview3/treePipeline.ts

Optional spaeter:

- app/tests/r3b-smoke.spec.ts
- app/tests/r3b-contract.spec.ts

## 6. Technische Kernentscheidungen

### 6.1 Mode-Einfuehrung

R3B wird als neuer Mode-Key eingefuehrt.

Beabsichtigte Wirkung:

- keine stillen Seiteneffekte fuer R3
- einfacher visueller Vergleich R3 versus R3B
- separates Debugging und separates Testen

### 6.2 Eigenes Core-Modell

R3B soll nicht lediglich bestehende R3-Funktionen anders konfigurieren.

R3B bekommt einen eigenen Berechnungspfad fuer:

- Familiennormalisierung
- Platzierungsplanung
- Projektionswahl
- Connector-Modell
- House-Cluster und House-Anker

Leitentscheidung:

- In Ehekontexten ist die Partner-Projektion der Default.
- Projektions-Suppression ist nur fuer klar definierte Sonderfaelle zulaessig.

### 6.3 Minimale UI-Aenderung

Die Preview3-UI soll zunaechst nur um den neuen Mode erweitert werden.

Keine zusaetzlichen UI-Konzepte in v1.

## 7. Slice-Plan

### 7.1 Slice 1: Mode-Skelett und eigener R3B-Pipeline-Pfad

Ziel:

- Mode R3B im UI auswaehlbar machen
- separaten Pipeline-Pfad verdrahten
- leeres, aber strukturell eigenstaendiges R3B-Core-Modell etablieren

Minimaler Umfang:

- neuer Mode in mode registry
- neue mode definition
- neuer Einstieg in treePipeline
- vorerst enger Funktionsumfang nahe an R3, aber ueber neue R3B-Dateien geroutet

Abnahme:

- App baut
- Mode R3B ist waehlbar
- R3B rendert ohne Crash
- bestehende Modi verhalten sich unveraendert

### 7.2 Slice 2: Familiennormalisierung und Elternpaar-Regeln

Ziel:

- Familienblock-Bildung aus dem Kern von R3B ableiten
- Elternpaar-Kandidaten explizit modellieren
- Prioritaetsmatrix fuer sichtbare Elternanker festschreiben
- Default-Projektionsregel fuer Ehepaare plus definierte Suppression-Regeln umsetzen

Minimaler Umfang:

- neue Family-Typen in r3b/types.ts
- explizite Candidate-Selection in r3b/families.ts oder r3b/projections.ts
- keine freie Geometrie-Heuristik, nur lokaler Tiebreaker
- Owner-Realnode plus Partner-Projektion als Default-Pfad
- parentless bzw. lokal sauberer Realnode-Sonderfall als explizite Suppression-Regel

Abnahme:

- deterministische Elternpaar-Wahl
- parentless Sonderfall sauber abbildbar
- Kinderachse basiert auf sichtbaren Elternankern
- Projektion ist bei normalen Ehekontexten der reproduzierbare Standardfall

### 7.3 Slice 3: Platzierungsplanung ohne globale Rebalance

Ziel:

- reservierungsbasierte Platzierung der Familienbloecke
- Mehrfachheirat explizit asymmetrisch behandeln

Minimaler Umfang:

- erste Ehe links, zweite rechts, weitere rechts
- keine symmetrische Verteilung mehr als Default
- genau ein lokaler Reparaturpass pro Familie oder Cluster

Abnahme:

- keine offenen globalen Deoverlap-Schleifen im R3B-Pfad
- keine verdeckte Rueckkehr zu symmetrischen Multi-Marriage-Offsets

### 7.4 Slice 4: House-Cluster und House-Anker als Core-Artefakt

Ziel:

- House-Anker frueh im Core-Modell berechnen
- House-Cluster samt Slot-Reservierung stabilisieren

Minimaler Umfang:

- separates House-Cluster-Modell
- Anchor-Slot beeinflusst Platzierung und Bounds
- spaete Render-Ableitung ohne inhaltliche Neuinterpretation

Abnahme:

- Start-Haeuser stabil
- Later-Haeuser erzeugen keine Root-Anker
- Anchor-Drift wird lokal validierbar

### 7.5 Slice 5: Eigenes Connector- und Render-Modell

Ziel:

- biologische Connectoren rein aus R3B-Kerndaten ableiten
- Canvas bekommt ein fertiges R3B-Render-Modell

Minimaler Umfang:

- orthogonale Connector-Segmente
- Eltern- und Kinderachsen aus sichtbaren Elternankern
- Projektionen sauber im Connector-Modell beruecksichtigt

Abnahme:

- keine impliziten Connector-Heuristiken mehr im UI fuer R3B
- gleiche Kernentscheidung erzeugt gleiche Segmentgeometrie

### 7.6 Spaeterer Qualitaets-Slice: Selektive Stabilisierung als Kernregel

Ziel:

- nur die wirklich noetigen frueheren R3-Stabilisierungen gezielt und kontrolliert in R3B zurueckholen
- keine blinde Rueckkehr zu globalen Nachfilter-Paessen

Minimaler Umfang:

- gezielte Bewertung einzelner Kandidaten wie child-band recenter oder sibling rebalance
- Uebernahme nur dann, wenn die Regel als explizite Kernlogik formulierbar ist
- keine offenen globalen Rebalance-Schleifen

Prioritaet:

- dieser Slice ist bewusst nach House-Cluster-Stabilisierung und nach der Verfeinerung der Elternpaar-/Projektionsmatrix eingeordnet

Abnahme:

- verbesserte Lesbarkeit in konkret benannten Problemfaellen
- keine verdeckte Rueckkehr zu breit streuender Post-Processing-Logik

## 8. Erster empfohlener Arbeitsumfang

Der erste sinnvolle Implementationsstart ist Slice 1 plus ein schmaler Teil von Slice 2.

Konkret:

1. Mode R3B einfuehren.
2. Eigenes r3b/types.ts anlegen.
3. Eigenes r3b/renderModel.ts oder r3b/placement.ts als ersten Einstieg bauen.
4. Bestehende R3-Helfer nur uebergangsweise konsumieren, aber ueber einen klaren R3B-Namespace.

Hinweis:

- Bereits frueh vermeiden, dass R3B versehentlich wieder Realnode-plus-Realnode als impliziten Default erbt.

Warum so klein:

- schnell sichtbarer Arbeitsmodus
- klare technische Trennlinie
- kein frueher Grossumbau

## 9. Konkrete Datei-Aenderungen fuer Slice 1

Voraussichtlich anzupassen:

- app/src/preview3/state.ts
- app/src/preview3/modes.ts
- app/src/Preview3App.tsx oder bestehende Mode-Validierung im App-State-Pfad
- app/src/preview3/treePipeline.ts

Voraussichtlich neu anzulegen:

- app/src/preview3/modeR3B.ts
- app/src/preview3/r3b/types.ts
- app/src/preview3/r3b/placement.ts
- app/src/preview3/r3b/renderModel.ts

## 10. Teststrategie

### 10.1 V1 Minimal

Am Anfang reichen wenige gezielte Checks:

- R3B rendert
- Mode umschaltbar
- kein Laufzeitfehler
- ein bis zwei Szenen fuer sichtbare Elternpaar-Regeln

### 10.2 Danach

Danach getrennte Testarten:

- Contract-Tests fuer Kernentscheidungen
- Smoke-Tests fuer visuelle Referenzszenen

### 10.3 Nicht empfohlen

Nicht empfohlen ist, R3B zuerst ueber viele Demo-Only Screenshot-Erwartungen zu stabilisieren.

Das wuerde das neue Modell zu frueh an momentane Pixelbilder ketten.

## 11. Risiken

### 11.1 Risiko: R3B wird nur ein umbenannter R3-Fork

Gegenmassnahme:

- eigener Namespace unter r3b
- neue Typen
- neue Pipeline-Verzweigung

### 11.2 Risiko: Zu fruehe Perfektion

Gegenmassnahme:

- Slice-basiertes Vorgehen
- kleine Abnahmen
- Randfaelle erst nach Kernmodell

### 11.3 Risiko: UI mischt wieder Fachlogik hinein

Gegenmassnahme:

- Connector- und Render-Modell vollstaendig im Core erzeugen
- Canvas nur als Konsument

## 12. Empfehlung

Die beste Startreihenfolge ist:

1. R3B als neuen Mode technisch einhaengen.
2. Einen minimalen eigenen R3B-Core-Namespace anlegen.
3. Danach Elternpaar-/Projektionswahl explizit modellieren.
4. Danach House-Cluster und House-Anker als echte Kernartefakte stabilisieren.
5. Danach Connectoren und Render-Modell weiter vom UI entkoppeln.
6. Selektive fruehere R3-Stabilisierungen erst spaeter und nur regelbasiert pruefen.

Diese Reihenfolge ist konservativ genug, um das Projekt nicht zu destabilisieren, und klar genug, um nicht weiter in der jetzigen R3-Mischlogik zu investieren.