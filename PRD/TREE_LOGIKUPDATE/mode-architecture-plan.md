# Preview3 Mode Architecture Plan

## 1. Zweck

Dieses Dokument beschreibt das technische Vorgehen fuer die Entkopplung der Tree-Logik in Preview3, damit die Render-Modes kuenftig unabhaengig voneinander weiterentwickelt werden koennen.

Fokus dieser Ausbaustufe:

- saubere Architektur-Basis fuer getrennte Modes
- Mode 1 als eigener Entwicklungsstrang auf Basis von Mode 0
- Debug-Faehigkeit fuer House-Anchor-Analyse verbessern
- PNG-Debug-Export optional zuschaltbar machen
- Global Statistics um einen dedizierten Debug-Block ergaenzen

Nicht Teil dieser Ausbaustufe:

- fachliche Vollumsetzung von Mode 2
- fachliche Vollumsetzung von Mode 3
- komplette UI-Neugestaltung des Preview3-Arbeitsbereichs

## 2. Festgezogene Entscheidungen

Aus dem Wizard und der aktuellen Bestandsaufnahme gelten fuer die naechste Umsetzungsphase folgende Entscheidungen:

- Mode 1 startet bewusst von Mode 0 und nicht vom heutigen Enhanced-Pfad.
- Die Modes werden strikt entkapselt.
- Shared Logic bleibt auf kleine, klar benannte Hilfsfunktionen begrenzt.
- Global Statistics erhaelt einen separaten Debug-Block statt die bestehenden Kerndaten zu ueberladen.
- PNG-Debug-Informationen sollen optional per Checkbox aktiviert werden.
- Mode 2 und Mode 3 werden in dieser Phase architektonisch vorbereitet, aber nicht fachlich voll ausgebaut.
- Die Planung wird als separates Dokument gefuehrt; das bestehende FRS bleibt fachliche Referenz.

## 3. Problemdefinition des Ist-Zustands

Die aktuellen Preview3-Modes sind nur oberflaechlich getrennt.

Heute existiert im Wesentlichen eine gemeinsame Pipeline mit einzelnen Mode-Abzweigungen fuer:

- legacy vs enhanced layout
- spouse projection an oder aus
- house anchor strategy legacy vs enhanced
- subtree offsets an oder aus

Folgen des aktuellen Zuschnitts:

- Mode 1 ist kein eigener technischer Strang, sondern eine implizite Variante der shared pipeline.
- Aenderungen fuer einen Mode bergen Seiteneffekte fuer andere Modes.
- Debugging wird erschwert, weil Entscheidungen nicht an einer Mode-Strategie gebuendelt sind.
- House-Anchor-Probleme lassen sich schwer einem konkreten Regelblock zuordnen.

## 4. Zielbild Architektur

### 4.1 Leitidee

Jeder Mode besitzt kuenftig eine eigene explizite Strategie.

Die Tree-Engine soll nicht mehr fragen:

- bin ich mode0?
- bin ich mode1?
- bin ich legacy?

Stattdessen soll die Engine eine Mode-Definition erhalten, die alle fachlich relevanten Entscheidungen kapselt.

### 4.2 Zielstruktur

Vorgesehene Rollen:

- mode registry
- mode definition pro mode
- pipeline runner
- shared geometry helpers
- shared analysis helpers
- UI adapter fuer Preview3

Technische Absicht:

- Die UI waehlt nur den Mode-Key.
- Die Registry liefert die passende Mode-Definition.
- Der Pipeline Runner fuehrt nur die Stages aus, die der jeweilige Mode explizit konfiguriert.
- Shared Logic bleibt rein funktional und mode-neutral.

## 5. Vorgeschlagenes Schichtenmodell

### 5.1 Tree Engine Input

Die Engine soll einen klaren Input erhalten:

- dataset
- selected mode key
- optionale debug flags
- spaeter optional weitere mode-spezifische settings

### 5.2 Mode Definition

Jeder Mode definiert mindestens:

- basis layout strategy
- person ordering rule
- person offset rule
- house cluster rule
- house anchor rule
- spouse rendering rule
- overlay rendering rule
- debug metadata provider

Beispielhaft als fachliche Struktur:

```text
ModeDefinition
- id
- label
- pipeline stages[]
- render policies
- debug policies
```

### 5.3 Pipeline Stages

Statt boolescher Mode-Abfragen werden klar benannte Stages ausgefuehrt.

Moegliche Stages:

- validate dataset
- base layout
- single-child centering
- marriage pair alignment
- curated person order
- curated person offsets
- house cluster offsets
- house anchor placement
- rendered tree preparation

Wichtig:

- Nicht jede Stage muss in jedem Mode aktiv sein.
- Die Reihenfolge wird pro Mode explizit konfiguriert.
- Der Runner kennt keine Fachbedeutung einzelner Modes.

### 5.4 Shared Helpers

Shared Helper bleiben erlaubt, wenn sie keine Mode-Entscheidungen enthalten.

Zulaessige Shared Helper:

- Geometrie
- Bounds-Berechnung
- Midpoint- und Junction-Berechnung
- generische Gruppierung biologischer Kanten
- Export-Helfer
- Debug-Formatierung

Nicht zulaessig in Shared Helpern:

- if mode equals ...
- implizite Default-Politik fuer bestimmte Modes
- UI-spezifische Seiteneffekte

## 6. Mode-Zuschnitt fuer die neue Basis

### 6.1 Mode 0

Mode 0 bleibt eingefrorene Referenz.

Zweck:

- Vergleichsbasis
- Regression-Referenz
- visuelle und fachliche Ausgangslage fuer Mode 1

Wichtig:

- Keine stillen Verhaltensaenderungen in Mode 0, ausser wenn explizit als Bugfix fuer die Referenz akzeptiert.

### 6.2 Mode 1

Mode 1 wird als eigener Strang auf Basis von Mode 0 entwickelt.

Bedeutung fuer die Architektur:

- Mode 1 kopiert nicht blind den heutigen Enhanced-Pfad.
- Stattdessen erhaelt Mode 1 eine eigene Strategie, die zunaechst nahe an Mode 0 liegt.
- Erweiterungen werden dann explizit nur in der Mode-1-Definition vorgenommen.

Erste fachliche Entwicklungsziele fuer Mode 1:

- biologische Hauptlinie bleibt primaer
- Partnerprojektion bleibt moeglich
- House-Anchor-Verhalten wird systematischer und besser debugbar
- spaetere Verbesserungen koennen Mode-1-spezifisch erfolgen, ohne Mode 0 umzubauen

### 6.3 Mode 2 und Mode 3

In dieser Phase nur Vorbereitung:

- definierte leere oder reduzierte Mode-Definitionen
- klare Anschlussstellen fuer eigene Stages und Render-Policies
- keine tiefe Fachlogik ausser was fuer die Architektur-Grundlage noetig ist

## 7. House-Anchor-Analyse und systematische Verbesserung

### 7.1 Vermutete Hauptursachen im Ist-Zustand

Die aktuelle Fehlpositionierung der Haus-Startpunkte sollte als eigenstaendiges Analyseproblem behandelt werden.

Wahrscheinliche Ursachenklassen:

- Root-Kandidatenset pro Haus ist fachlich zu breit oder zu schmal
- idealer Anchor-Mittelpunkt wird aus dem falschen Korridor abgeleitet
- Kollisionsaufloesung verschiebt Anker nur einseitig und erzeugt Drift
- Clusterbreite beruecksichtigt die spaetere Baum-Ausdehnung nicht systematisch genug

### 7.2 Analyseziel

Vor jeder fachlichen Aenderung an der Platzierungsregel muss sichtbar werden:

- welches Haus welchen Root-Korridor verwendet
- wo der ideale Mittelpunkt liegt
- wo der platzierte Mittelpunkt landet
- wie gross die Drift ist
- welche reservierte Breite oder Cluster-Spanne der Platzierung zugrunde liegt

### 7.3 Ziel fuer die spaetere Regelverbesserung

Die Haus-Startpunkte sollen nicht nur nach den ersten Root-Nodes, sondern nach dem erwarteten Flaechenbedarf des Haus-Kontexts sinnvoll entzerrt werden.

Das bedeutet:

- Root-Haeuser brauchen einen reservierten Einstiegskorridor
- dieser Korridor muss mit der spaeteren Breite des Kontexts kompatibel sein
- die Platzierung darf nicht nur lokal zwei benachbarte Anchors entkoppeln
- die Platzierung soll moeglichst wenig Drift gegenueber dem fachlichen Idealzentrum erzeugen

## 8. Debug-Block in Global Statistics

Es soll ein eigener Debug-Block ergaenzt werden, statt bestehende Statistik-Felder aufzublasen.

Empfohlene Inhalte der ersten Ausbaustufe:

- aktiver mode key
- aktive mode strategy summary
- active pipeline stages
- house anchor count
- pro Haus: ideal center x
- pro Haus: placed center x
- pro Haus: drift x
- pro Haus: root node ids oder root node names
- pro Haus: reserved span oder cluster width
- angewandte house yOffsets
- angewandte person yOffsets, sofern im sichtbaren Kontext relevant

Darstellungsziel:

- eigener aufklappbarer Debug-Block
- kompakt scanbar
- keine Vermischung mit nutzerrelevanten Basis-Statistiken

## 9. PNG-Debug-Export

### 9.1 UX-Ziel

Debug-Informationen im PNG-Export sollen optional zuschaltbar sein und nicht immer aktiv sein.

Entscheidung fuer diese Phase:

- Checkbox-basierter Debug-Schalter
- normaler Export ueber vorhandene Export-Aktionen
- Export uebernimmt den aktuellen Debug-Zustand

### 9.2 Empfohlene Debug-Layer

Erste sinnvolle Debug-Layer:

- house anchor bounding boxes
- ideal anchor center marker
- placed anchor center marker
- root corridor lines
- cluster span visualization
- house label metadata mit idealX, placedX, driftX

### 9.3 High-Resolution-Unterstuetzung

Da der PNG-Export fuer Analysezwecke lesbar bleiben soll, ist eine konfigurierbare hoehere Export-Aufloesung vorzusehen.

Empfohlene Richtung:

- normal export
- optional high-res export multiplier
- debug overlay muss in normal und high-res sauber skalieren

High-Res ist hier kein eigener Mode, sondern eine Export-Option.

## 10. Vorschlag fuer Umsetzungsphasen

### Phase A: Architektur-Basis

Ziel:

- Mode Registry einfuehren
- Mode Definitions anlegen
- shared pipeline in stage-basierte Engine ueberfuehren
- Preview3 UI an den Registry-Einstieg koppeln

Ergebnis:

- Modes sind technisch getrennt
- bestehendes Verhalten bleibt zunaechst so weit wie moeglich erhalten

### Phase B: Mode-0-Konservierung

Ziel:

- Mode 0 als explizite Frozen-Definition abbilden
- Regression-Vergleich gegen heutiges Referenzverhalten sicherstellen

Ergebnis:

- verifizierbare Referenz fuer alle Folgearbeiten

### Phase C: Mode-1-Abzweig

Ziel:

- Mode 1 als eigener Strategie-Strang aufbauen
- initial nahe an Mode 0 halten
- erste gezielte Abweichungen nur in Mode 1 einbauen

Ergebnis:

- unabhaengiger Weiterentwicklungspfad fuer den Hauptmodus

### Phase D: Debug-Fundament

Ziel:

- Debug-Block in Global Statistics
- Debug-Datenmodell fuer House-Anchor-Analyse
- optionaler PNG-Debug-Schalter
- High-Res-Export-Option vorbereiten oder einbauen

Ergebnis:

- systematische Analyse der House-Anchor-Probleme moeglich

### Phase E: House-Anchor-Verbesserung

Ziel:

- Haus-Startpunkte mit belastbaren Debug-Daten verbessern
- Regel fuer reservierten Einstiegskorridor und Drift-Minimierung ueberarbeiten

Ergebnis:

- besser lesbarer Einstieg der Haeuser
- weniger ueberlappende oder irritierende Leitlinien

## 11. Akzeptanzkriterien fuer die Basisphase

Die Basisphase ist dann erfolgreich, wenn folgende Punkte erfuellt sind:

- Preview3 verwendet keine verstreuten mode-spezifischen Bool-Abzweigungen mehr als primaere Steuerung.
- Jeder sichtbare Mode ist ueber eine explizite Mode-Definition beschrieben.
- Mode 0 und Mode 1 koennen isoliert veraendert werden, ohne dieselbe Fachentscheidung in shared code umzuschreiben.
- Der Pipeline Runner kennt nur Stages und Definitionen, nicht die Fachsemantik einzelner Modes.
- Global Statistics kann einen dedizierten Debug-Block einblenden.
- PNG-Export kann optional Debug-Overlays einschliessen.
- Die House-Anchor-Diagnose ist datenbasiert moeglich, nicht nur visuell per Screenshot.

## 12. Risiken und Leitplanken

Wichtige Risiken:

- Zu fruehes fachliches Umbauen von Mode 1 vor der Architekturtrennung
- versehentliche Verhaltensaenderung in Mode 0
- neue shared helper, die wieder versteckte Mode-Entscheidungen enthalten
- Debug-Oberflaechen, die den normalen Statistikbereich unlesbar machen

Leitplanken:

- zuerst Architektur, dann Fachverhalten
- Mode 0 nur bewusst aendern
- Debug sichtbar trennen von Normalbetrieb
- House-Anchor-Regeln erst aendern, wenn die Drift- und Span-Daten sichtbar sind

## 13. Naechste konkrete Implementationsschritte

Die naechsten technischen Arbeitsschritte sollten in dieser Reihenfolge erfolgen:

1. Mode-Definitionen und Registry einfuehren.
2. Pipeline in explizite Stages aufteilen.
3. Mode 0 als Frozen-Definition nachziehen.
4. Mode 1 als separaten Strang auf Basis von Mode 0 anlegen.
5. Debug-Datenmodell fuer House-Anker definieren.
6. Global Statistics um separaten Debug-Block erweitern.
7. Optionalen Debug-Schalter fuer PNG-Export ergaenzen.
8. Erst danach House-Anchor-Regeln fachlich verbessern.