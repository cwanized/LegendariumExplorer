# R3B FRS V1

## 1. Zweck

Dieses Dokument definiert die verbindliche fachliche und technische Sollbeschreibung fuer den neuen Render-Mode R3B.

R3B ist der naechste kanonische Tree-Core fuer Preview3.
Er wird als separater Mode neben R3 eingefuehrt, damit die bestehende Implementierung als Vergleichs- und Rueckfallpfad erhalten bleibt.

R3B verfolgt folgende Ziele:

- deterministische Family-Tree-Geometrie
- klar getrennte Verantwortungen zwischen Tree-Core, Render-Modell und UI
- fachlich definierte Familienbloecke statt impliziter Nachkorrektur-Logik
- kontrollierte Projektionen fuer Partnerkontexte ohne unklare Mischlogik
- stabile House-Cluster und House-Anker
- minimale, explizit begrenzte Nachkorrekturen

## 2. Prioritaet der Quellen

Die Prioritaet fuer Entscheidungen ist wie folgt:

1. Dieses Dokument und spaetere R3B-FRS-Versionen sind die verbindliche Sollbeschreibung.
2. Die bestehenden PRD-Dokumente liefern den produktfachlichen und architektonischen Rahmen.
3. genealogytree.pdf dient als technische Referenz dafuer, wie Family Trees strukturell sauber dargestellt werden koennen.

Wichtig:

- genealogytree.pdf ist eine technische Leitplanke, keine direkte Implementationsvorgabe.
- Wenn genealogytree.pdf allgemeine Darstellungsprinzipien beschreibt und dieses Dokument diese fuer Legendarium Explorer praezisiert, gilt dieses Dokument.
- genealogytree.pdf soll insbesondere fuer Ebenenlogik, Familienpositionierung, Partnerachsen, Abstandssemantik und strukturelle Reservierungen beruecksichtigt werden.

## 3. Abgrenzung

R3B ist kein allgemeiner Graph-Layout-Algorithmus.
R3B ist eine domaenenspezifische Tree-Engine fuer genealogische Stammbaueme mit biologischer Primaerstruktur und ergaenzenden Partner-/Haus-Kontexten.

R3B ist nicht zustaendig fuer:

- Panel-Layout
- Routing
- Menues, Popover, Dialoge
- generische UI-Orchestrierung
- freie visuelle Nachoptimierung ohne fachliche Regelbasis

## 4. Architekturentscheidung

R3B wird als separater Mode neben R3 eingefuehrt.

Begruendung:

- Die aktuelle R3-Implementierung ist ein wertvoller Referenzstand, aber kein sauberer Zielkern.
- R3B soll den Tree-Core neu und kontrolliert aufbauen, ohne die bestehende Preview3-UI mitzubrechen.
- UI-Schale, State-Orchestrierung und Canvas-Einbindung bleiben moeglichst stabil.

Konsequenz:

- R3 bleibt vorerst Vergleichsmodus.
- R3B wird der neue Kern fuer fachlich saubere Layout- und Renderlogik.

## 5. Begriffe

### 5.1 Kanonische Person

Die kanonische Person ist das fachliche Personenobjekt im Datensatz.

### 5.2 Projektion

Eine Projektion ist eine zusaetzliche, kontrolliert erzeugte sichtbare Darstellung einer kanonischen Person in einem zweiten Kontext.

Regeln:

- Projektionen sind in R3B erlaubt.
- Projektionen sind in Ehekontexten grundsaetzlich der Standardfall.
- Projektionen sind offizieller Bestandteil des R3B-Render-Modells.
- Projektionen sind keine neuen Personenobjekte.
- Projektionen aendern nicht die fachliche Identitaet einer Person.

### 5.3 Familienblock

Ein Familienblock besteht mindestens aus:

- den dargestellten Elternankern
- einer expliziten Familienachse
- der Kindergruppe
- den daraus abgeleiteten biologischen Verbindungen

### 5.4 House-Cluster

Ein House-Cluster ist die Layout-Einheit eines Start-Hauses.
Er umfasst den House-Anker, die zugehoerigen Root-Kontexte und den dafuer reservierten Platzbedarf.

## 6. Kernprinzipien

### 6.1 Primaerstruktur

Die biologische Eltern-Kind-Relation ist die primaere Struktur des Baums.

Partnerbeziehungen und House-Kontexte sind ergaenzende Struktur- und Renderinformationen, duerfen aber nicht unkontrolliert zu einer freien Umdefinition des gesamten Baums fuehren.

### 6.2 Determinismus

R3B muss deterministisch sein.

Das bedeutet mindestens:

- gleiche Eingabedaten erzeugen gleiche Familienbloecke
- gleiche Eingabedaten erzeugen gleiche Slot-/Achsenentscheidungen
- gleiche Eingabedaten erzeugen gleiche Projektionen
- gleiche Eingabedaten erzeugen gleiche Connector-Geometrie

### 6.3 Reservierungsbasierte Platzierung

R3B platziert primaer durch Reservierung und fachliche Vorabwaertsplanung, nicht durch spaete globale Verschiebeschleifen.

### 6.4 Modulare Schichten

R3B trennt mindestens:

- Dateninterpretation
- Familienblock-Bildung
- House-Cluster-Bildung
- Platzierungsplanung
- Render-Modell-Erzeugung
- SVG-/Canvas-Ausgabe

## 7. Personen- und Projektionsmodell

### 7.1 Sichtbarkeitsmodell

Eine kanonische Person darf in R3B mehrfach sichtbar sein, wenn dies ueber kontrollierte Projektionen erfolgt.

Das ist eine bewusste Abweichung von einem streng singulaeren Sichtbarkeitsmodell.

### 7.2 Fachliche Grenzen von Projektionen

Projektionen muessen folgende Bedingungen erfuellen:

- sie sind explizit aus dem Tree-Core ableitbar
- sie sind deterministisch
- sie folgen klaren fachlichen Regeln
- sie duerfen nicht als freie Render-Notloesung entstehen
- sie muessen fuer Connector- und Achsenlogik als sichtbare Elternanker beruecksichtigbar sein

### 7.3 Default-Regel fuer Ehepaare

Bei Ehepaaren ist die Partner-Projektion in R3B grundsaetzlich der Standard.

Ziel:

- getrennte Stammlinien nicht unkontrolliert ineinander druecken
- lokale Familienbloecke klar lesbar halten
- Kinderanbindung an das tatsaechlich sichtbare Elternpaar koppeln

Das bedeutet:

- ein Ehekontext wird primaer als lokaler Familienblock mit einem kanonischen Hauptkontext und einer dazu passenden Partner-Projektion betrachtet
- die sichtbare Familiengeometrie darf bewusst auf Realnode plus Projektion beruhen

### 7.4 Zulaessige Suppression von Projektionen

Von der Default-Projektionsregel darf nur in klar definierten Sonderfaellen abgewichen werden.

Typische Sonderfaelle sind:

- ein Partner kann lokal fachlich sauber direkt als Realnode gezeigt werden, ohne dass Stammlinien kollidieren oder verschmelzen
- ein Partner ist parentless und kann deshalb im lokalen Ehekontext direkt beim anderen Elternteil stehen
- eine Projektion wuerde die Szene fachlich eher verschleiern als klaeren

Beispiel:

- Silmarien / Elatan kann ein Fall fuer bewusste Projektions-Suppression sein, wenn Elatan lokal direkt und stabil dargestellt werden kann

### 7.5 Ziel von Projektionen

Projektionen dienen dazu, Partnerkontexte lesbar abzubilden, ohne dass getrennte Stammlinien unkontrolliert ineinander gedrueckt werden.

## 8. Elternpaar und Kinderachse

### 8.1 Grundregel fuer zwei Eltern

Bei einem Familienblock mit zwei Eltern wird die Kinderachse an der geometrischen Mitte der tatsaechlich gerenderten Elternanker ausgerichtet.

Das kann sein:

- Owner-Realnode plus Partner-Projektion
- in Sonderfaellen Realnode plus Realnode trotz Default-Projektionslogik

### 8.2 Kein abstraktes Scheinzentrum

Die Achse wird nicht aus unsichtbaren oder fachlich inaktiven Elternkandidaten abgeleitet.

Wenn ein sichtbares Elternpaar aus Realnode und Projektion besteht, ist genau dieses sichtbare Paar die Basis fuer Achse und biologische Kinderdarstellung.

### 8.3 Symmetrie

Kinder werden symmetrisch um die definierte Familienachse angeordnet.

Bei gerader Kinderzahl liegt die Achse zwischen den mittleren Kindern.
Bei ungerader Kinderzahl liegt die Achse auf dem mittleren Kind.

## 9. Auswahl des sichtbaren Elternpaares

### 9.1 Keine freie Heuristik

R3B darf die Wahl des sichtbaren Elternpaares nicht ueber freie visuelle Heuristik treffen.

### 9.2 Default-Prioritaet

Fuer Ehekontexte gilt als Default-Prioritaet:

1. Owner-Realnode plus Partner-Projektion
2. Realnode plus Realnode nur als explizit begruendeter Sonderfall

### 9.3 Verbindliche Regel

Die Auswahl erfolgt in zwei Schritten:

1. Es wird eine fachliche Prioritaetsmatrix fuer zulaessige Kandidaten angewendet.
2. Nur wenn mehrere Kandidaten fachlich gleichwertig sind, darf eine lokale Geometrie-Heuristik als Tiebreaker entscheiden.

### 9.4 Anforderungen an den Tiebreaker

Der geometrische Tiebreaker muss:

- lokal sein
- deterministisch sein
- hart begrenzt sein
- nur zwischen bereits zulaessigen Kandidaten waehlen

Er darf nicht:

- neue Kandidaten erfinden
- globale Baumstruktur umdeuten
- offene Nachoptimierungsschleifen ausloesen

### 9.5 Typische Kandidaten

Die Prioritaetsmatrix soll mindestens diese Kandidaten kennen:

- Owner-Realnode plus Partner-Projektion
- parentless Ausnahme mit Realnode plus Realnode
- sonstige explizit erlaubte Realnode-plus-Realnode-Sonderfaelle

Die genaue Rangfolge ist im Implementationsvertrag explizit zu dokumentieren.

## 10. Mehrfachheirat

### 10.1 Verbindliche Regel

Mehrfachheirat wird in R3B explizit und asymmetrisch behandelt:

- erste Ehe links
- zweite Ehe rechts
- weitere Ehen anschliessend rechts

### 10.2 Konsequenzen

- Diese Regel darf nicht implizit aus symmetrischen Offsets entstehen.
- Ein Partner mit mehreren Ehen muss im Kernalgorithmus bewusst fortgefuehrt werden.
- Kinder verschiedener Ehen bleiben getrennte Kindergruppen in getrennten Familienbloecken.

## 11. House-Anker und House-Cluster

### 11.1 House-Anker-Semantik

Der House-Anker ist in R3B kein blosses nachtraegliches Render-Label.

Er wird als separates Core-Artefakt mit reserviertem Slot und Cluster-Vertrag behandelt.

### 11.2 Bewusste Abgrenzung zu Person 0

Der House-Anker muss nicht als echte Person 0 modelliert werden.

Die fruehere Person-0-Idee wird hier ersetzt durch die strengere technische Anforderung, dass der Anker bereits im Core-Modell mitgedacht wird und nicht erst nachtraeglich an einen fertigen Baum angehaengt wird.

### 11.3 Anforderungen an den House-Anker

Der House-Anker muss:

- vor der finalen Platzierung bekannt sein
- Slot- bzw. Platzreservierung beeinflussen
- zur Bounds-/Kamera-Berechnung beitragen
- deterministische Connector-Basis besitzen
- zusammen mit seinem House-Cluster stabil bleiben

### 11.4 Start- und Later-Haeuser

Es gelten weiterhin die bestehenden Hausregeln:

- tier: start kann einen sichtbaren House-Anker besitzen
- tier: later erzeugt keinen Root-Anker
- das fuehrende Haus einer Person bleibt der erste Hauseintrag

## 12. Kollisionen und Nachkorrekturen

### 12.1 Primat der Vorab-Reservierung

Kollisionen sollen primaer vor der finalen Platzierung verhindert werden.

### 12.2 Zulaessiges Korrekturbudget

Nach der Primaerplatzierung ist genau ein lokaler Validierungs- und Reparaturpass pro Familie oder Cluster erlaubt.

### 12.3 Nicht zulaessig

Nicht zulaessig sind:

- mehrfache globale Rebalance-Schleifen
- offene Nachoptimierungsprozesse
- freie globale Verschiebungen ohne klaren fachlichen Ausloeser

### 12.4 Zulaessige lokale Korrekturen

Zulaessig sind lokal begrenzte Reparaturen fuer klar definierte Konflikte, zum Beispiel:

- minimale Node-Ueberlappungen
- verletzte Familienachse
- Anchor-Drift innerhalb eines Clusters
- Verletzung eines definierten Mindestabstands

## 13. Connector-Modell

R3B erzeugt biologische Verbindungen als explizites Render-Modell aus dem Tree-Core.

Regeln:

- Connector-Geometrie wird nicht implizit ad hoc im UI-Render zusammengesucht.
- Connector-Modelle basieren auf den tatsaechlich gerenderten Elternankern.
- Die biologische Kinderanbindung muss orthogonal und deterministisch sein.

## 14. Modulschnitt

R3B soll mindestens in folgende Verantwortungsbloecke getrennt werden:

- generation / ordering
- families
- house clusters
- placement
- projections
- connectors
- render model

Die UI konsumiert nur das Ergebnis dieser Schichten.
Die UI trifft keine fachlichen Layoutentscheidungen.

## 15. Nicht-Ziele fuer R3B V1

Folgendes ist nicht Ziel von R3B V1:

- vollstaendige Perfektion aller Randfaelle im ersten Schritt
- generischer Layout-Solver fuer beliebige Graphen
- UI-Redesign
- Migration aller historischen Modi in denselben Kern

## 16. Abnahme fuer R3B V1

R3B V1 wird mit einem kleinen, harten Abnahmepaket bewertet:

- 5 bis 8 harte Invarianten
- 5 bis 10 visuelle Referenzszenen

### 16.1 Harte Invarianten

Die harten Invarianten sollen mindestens pruefen:

- Determinismus
- korrekte Familienachse bei zwei Eltern
- korrekte Trennung mehrerer Ehen
- stabile House-Anker-Regeln
- keine unzulaessigen globalen Nachkorrekturschleifen
- reproduzierbare Projektionswahl

### 16.2 Visuelle Referenzszenen

Die visuellen Szenen sollen gezielt bekannte Problemklassen abdecken, etwa:

- Partnerprojektionen zwischen Linien
- parentless Partner
- Mehrfachheirat
- schwere und leichte Geschwisterzweige
- House-Cluster mit yOffset

## 17. Abgeleitete Regeln aus dem aktuellen R3-Code

Die aktuelle R3-Implementierung enthaelt bereits fachlich relevante Regeln.
Diese Regeln werden fuer R3B nicht ungeprueft uebernommen, sondern explizit bewertet.

### 17.1 Uebernehmen

Folgende R3-Regeln gelten als fachlich brauchbar und sollen in R3B gezielt uebernommen werden:

- Owner-Normalisierung fuer Zwei-Eltern-Familien: Wenn nur ein Elternteil selbst biologisch verankert ist, soll dieser verankerte Elternteil der Owner des Familienkontexts sein.
- Parentless-Suppression als explizite Sonderfallregel: Wenn ein Partner lokal direkt und sauber darstellbar ist, darf die Default-Projektion bewusst unterdrueckt werden.
- Kinderachse aus sichtbarer Elterngeometrie: Die Familienachse soll aus den tatsaechlich dargestellten Elternankern abgeleitet werden.

### 17.2 Anpassen

Folgende R3-Regeln werden in R3B inhaltlich weiterentwickelt und nicht 1:1 uebernommen:

- Projektion bleibt erhalten, wird aber klarer als Standardfall fuer Ehekontexte formuliert, mit definierter Suppression-Matrix fuer Sonderfaelle.
- Die Auswahl des sichtbaren Elternpaares bleibt owner-getrieben, wird aber nicht mehr implizit ueber verstreute Fallunterscheidungen und lose Distanzwahl geregelt.
- Der lokale geometrische Vergleich zwischen moeglichen Elternankern bleibt zulaessig, aber nur als Tiebreaker innerhalb einer fachlich zulaessigen Kandidatenmenge.
- House-Anker bleiben eigenstaendige Artefakte, muessen in R3B aber frueh im Core-Modell und in der Platzreservierung verankert sein.

### 17.3 Verwerfen

Folgende Muster aus dem aktuellen R3-Code sollen in R3B nicht als Zielarchitektur fortgefuehrt werden:

- freie oder zu dominante Distanz-Heuristik fuer die primaere Wahl des sichtbaren Elternpaares
- mehrere globale oder halbglobale Nachkorrektur- und Rebalance-Paesse
- symmetrische Mehrfachheirats-Offsets als Default
- spaete semantische Rekonstruktion von House-Ankern ausserhalb eines stabilen Core-Modells

### 17.4 Uebersetzung in R3B-Regeln

Aus der Bewertung ergeben sich fuer R3B diese verbindlichen Folgeentscheidungen:

- Projektion ist bei Ehepaaren der Default.
- Projektions-Suppression ist eine ausdrueckliche Ausnahme mit klaren Regeln.
- Owner-Regeln und sichtbare Familienachsen bleiben zentrale fachliche Steuerungspunkte.
- Geometrie darf Entscheidungen unterstuetzen, aber nicht unkontrolliert treiben.
- Nachkorrekturen bleiben lokal, begrenzt und explizit.

## 18. Offene Folgeentscheidung fuer V2

Fuer eine spaetere Version ist offen, ob House-Anker langfristig doch als formaler Person-0-aehnlicher Rasterknoten modelliert werden sollen.

Diese Frage wird erst neu bewertet, wenn sich zeigt, dass ein separates Core-Artefakt mit reserviertem Slot die Stabilitaetsprobleme nicht sauber loest.