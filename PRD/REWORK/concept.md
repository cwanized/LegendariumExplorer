# Preview3 Architekturkonzept

## 1. Zielbild

Preview3 wird die neue Zieloberflaeche fuer den Family-Tree-Workspace.

Leitprinzipien:
- Tree-Renderlogik ist strikt gekapselt und fachlich kanonisch.
- GUI-Schicht (Panels, Menues, Overlays, Controls) wird weitgehend auf Standard-Libraries aufgebaut.
- Preview2 bleibt waehrend der Migration fuer Tree-Features eingefroren (nur Bugfixes).
- Preview bleibt die Referenz fuer Tree-Funktionalitaet und Verhaltens-Paritaet.

## 2. Architektur top-down

### 2.1 Ebene A: Application Shell

Verantwortung:
- Routing und Start der jeweiligen Preview-Seite.
- Globale App-Rahmenbedingungen.

Regel:
- Keine Tree-Geometrie oder Tree-Interaktionsdetails in dieser Ebene.

### 2.2 Ebene B: Preview3 Page Composition

Verantwortung:
- Seite Preview3 als Komposition aus:
	- Toolbar
	- Panel-Layer
	- Tree-Canvas-Host
	- Overlays

Regel:
- Diese Ebene orchestriert State und Callbacks, rendert aber keine fachliche Tree-Geometrie.

### 2.3 Ebene C: Feature Layer

Verantwortung:
- Selection/LCA-Workflow
- Filter/Search-Workflow
- Export-Workflow
- Theme-Workflow

Regel:
- Feature-Logik ist in klaren Modulen organisiert und konsumiert den Tree-Kern nur ueber definierte Schnittstellen.

### 2.4 Ebene D: Tree Canvas Boundary

Verantwortung:
- Einheitliche API zwischen GUI und Tree-Kern.
- Render-Aufruf, Event-Mapping, Output-Events.

Regel:
- FamilyTreeCanvas kennt keine Panel-Implementierung und keine UI-Library-Details.

### 2.5 Ebene E: Tree Core (kanonisch)

Verantwortung:
- Tree-Geometrie
- Connector-Logik
- Spouse-Projection
- House-Anchors
- Camera-Mathematik
- Selection/LCA-Renderregeln (hide/dim/highlight)

Regel:
- Tree Core ist moeglichst framework-arm und testbar mit reinen Input/Output-Tests.

### 2.6 Ebene F: Domain Core

Verantwortung:
- Laden/Validieren/Layout/LCA-Basis in graph.ts.

Regel:
- Domain-Invarianten sind stabil und werden nicht an UI-Beduerfnisse angepasst.

## 3. Verantwortungsabgrenzung

### 3.1 Was custom bleibt

- Family-Tree-Renderpfad (SVG-Geometrie, Fachregeln)
- Genealogische Speziallogik
- Kamera- und Highlight-Semantik fuer den Stammbaum

### 3.2 Was library-first wird

- Menues, Popovers, Dialoge, Selects
- Panel-Container (docked/resizable)
- Floating/Undocked Drag-Resize Verhalten
- Fokusmanagement, Keyboard-Navigation, Outside-Click-Verhalten

## 4. Zielstruktur Dateien und Ordner

Geplante Struktur im app/src Bereich:

```text
app/src/
	pages/
		preview3/
			Preview3App.tsx
			Preview3App.css
			preview3.types.ts

	features/
		preview3/
			toolbar/
				Preview3Toolbar.tsx
			panels/
				Preview3PanelLayer.tsx
				filter/
				selection/
				inspector/
				lca/
			overlays/
				ThemeEditorOverlay.tsx
				ExportMenu.tsx

	tree/
		core/
			geometry/
				biologicalGroups.ts
				spouseProjection.ts
				houseAnchors.ts
			camera/
				cameraMath.ts
			selection/
				selectionViewModel.ts
			render/
				svgPrimitives.ts
				treeRenderModel.ts

		canvas/
			FamilyTreeCanvas.tsx
			familyTreeCanvas.types.ts
			useTreeInputRouting.ts

	domain/
		graph.ts
		(bestehende Domain-Helfer)

	shared/
		ui/
			(library wrappers, z. B. Menu, Dialog, Select)
		utils/
			clamp.ts
			guards.ts
```

Hinweis:
- Die finalen Dateinamen koennen im Umsetzungsdetail leicht variieren, die Schichten und Grenzen sind jedoch verbindlich.

## 5. Routing- und Koexistenzstrategie

- preview bleibt als fachliche Referenz bestehen.
- preview2 bleibt erreichbar, aber Tree-Feature-Freeze.
- preview3 wird parallel eingefuehrt und iterativ zur Zieloberflaeche ausgebaut.

Akzeptanzkriterium:
- Alle drei Routen funktionieren parallel ohne Seiteneffekte.

## 6. State-Architektur

### 6.1 UI State (Page Layer)

Beispiele:
- Panel-Open/Collapse/Dock
- Overlay-Open/Close
- Toolbar-Modi
- Theme-Editor Sichtbarkeit

### 6.2 Feature State (Feature Layer)

Beispiele:
- Filter/Search Query
- Selection A/B
- LCA-Sichtzustand
- Export-Status

### 6.3 Tree View State (Canvas Boundary)

Beispiele:
- Camera ViewBox
- Pointer/Touch/Wheel Inputzustand

### 6.4 Domain State (Domain Core)

Beispiele:
- Validierte Personen und Relationen
- Layout-Output
- Warnungen und Diagnostik

Regel:
- Keine impliziten Rueckkopplungen zwischen UI State und Tree Core.

## 7. Datenfluss

1. Domain laedt und validiert Datensatz.
2. Tree Core erzeugt Render-Modelle und Geometrie.
3. FamilyTreeCanvas rendert ausschliesslich auf Basis definierter Inputs.
4. User-Events erzeugen klar typisierte Output-Events.
5. Page/Feature Layer aktualisiert State und reicht neue Inputs an Canvas.

## 8. Library-Strategie

Die konkrete Library-Wahl wird in der Umsetzung finalisiert, das Muster ist jedoch fix:
- UI Primitives: menu/popover/dialog/select via Standard-Library
- Panel-System: docked/resizable via spezialisierter Library
- Floating Panels: drag/resize via spezialisierter Library

Wichtig:
- Libraries duerfen die Tree-Core-Schnittstellen nicht aufbrechen.

## 9. Migrationsphasen

### Phase 0: Freeze und Referenz
- Preview als kanonische Tree-Referenz fixieren.
- Preview2 Tree-Freeze festlegen.

### Phase 1: Preview3 Route + leere Shell
- Neue Preview3 Seite und Routing.

### Phase 2: Tree Core Extraktion
- Geometrie, Camera, Selection-Regeln entkoppeln.

### Phase 3: FamilyTreeCanvas Boundary
- Klare API etablieren und in Preview3 nutzen.

### Phase 4: GUI Library Integration
- Panels, Menues, Overlays standardisieren.

### Phase 5: Paritaet und Rollout
- Preview vs Preview3 Verhaltens-Paritaet absichern.

## 10. Test- und Qualitaetskonzept

### 10.1 Unit Tests
- Tree Core Pure Functions (Geometrie, Camera, Selection-Regeln)

### 10.2 Integration Tests
- FamilyTreeCanvas Input/Output-Vertrag
- Feature-Flows (Selection/LCA/Search)

### 10.3 Paritaetstests
- Preview vs Preview3 fuer definierte Referenzszenarien
- Knotenpositionen, Connector-Muster, Highlight-/Fade-Logik

### 10.4 Build-Gates
- Typecheck + Build gruen pro Phase
- Keine neuen Tree-Feature-Aenderungen in Preview2

## 11. Nicht-Ziele

- Vollstaendiger sofortiger Ersatz von preview und preview2 in einem Schritt
- Umstellung der Domain-Invarianten fuer UI-Bequemlichkeit
- Unkontrollierte UI-Library-Mischung ohne klare Wrapperschicht

## 12. Risiken und Gegenmassnahmen

- Risiko: Verhaltensdrift zwischen Preview und Preview3
	- Gegenmassnahme: fruehe Paritaetstests und Referenzszenarien

- Risiko: Erneute Verkopplung durch Shortcut-Implementierungen
	- Gegenmassnahme: FamilyTreeCanvas API als verbindliche Grenze

- Risiko: UI-Library-Lock-in
	- Gegenmassnahme: shared ui wrappers statt direkter Streu-Nutzung

## 13. Definition of Done fuer Preview3 Grundarchitektur

- Preview3 Route aktiv und stabil.
- Tree Core aus UI entkoppelt und testbar.
- FamilyTreeCanvas als klare Boundary im Einsatz.
- GUI-Grundelemente auf Standard-Libraries migriert.
- Paritaet zu Preview fuer definierte Kernfaelle nachgewiesen.
- Preview2 Tree-Freeze waehrend Migration eingehalten.

