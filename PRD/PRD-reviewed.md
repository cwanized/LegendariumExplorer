````md
# PRD-REVIEWED.md

# Graph-based Family & Social History Explorer

Version: 1.0 (Architecture Locked)

---

# 1. Vision

Build a Git-native, client-side graph explorer for genealogical and social relationships.

The application is not intended to be a traditional family tree application.

Instead, it should function as:

> An interactive knowledge graph explorer with genealogical visualization capabilities.

Primary goals:

- visualize biological lineage
- visualize social relationships
- provide large-scale graph exploration
- support community-maintained datasets via GitHub
- remain fully static-hostable (GitHub Pages)

---

# 2. Architectural Principles

## 2.1 Git as Source of Truth

All data is stored as JSON files in Git.

There is:

- no database
- no backend
- no server-side persistence

Git history serves as the historical record.

---

## 2.2 State-Based Model

The repository always contains the current state.

The system does NOT implement:

- event sourcing
- historical snapshots
- temporal graph reconstruction

Historical changes are available through Git history only.

---

## 2.3 Graph First

Internally all data forms a graph.

The application does NOT store trees.

Instead:

```text
Data Model      = Graph
Layout Model    = Biological Tree Projection
```

---

## 2.4 Readability First

The primary UX goal is:

> Readability over information density.

Tradeoffs should favor:

- less edge crossings
- larger spacing
- easier navigation

even if more scrolling or zooming is required.

---

# 3. Scope

## MVP Scope

Supported:

- Persons
- Relations
- Graph visualization
- Search
- Multi-selection
- Relationship highlighting
- Biological lineage visualization
- Social overlays

Not supported:

- Editing in browser
- Multi-user collaboration
- Historical state reconstruction
- Source citation management
- Automatic deduplication
- Database storage

---

# 4. Data Storage

## Repository Structure

```text
data/
├── persons/
├── relations/
└── events/
```

Events may remain empty in MVP.

The folder exists for future compatibility.

---

# 5. Entity Model

---

# 5.1 Person

Location:

```text
data/persons/{id}.json
```

Schema:

```json
{
  "id": "uuid",
  "name": "Aragorn",
  "birthYear": 2931,
  "deathYear": 120,

  "houses": [
    "Dunedain"
  ],

  "metadata": {
    "description": "optional"
  }
}
```

Rules:

- id is immutable
- UUID required
- name not required to be unique
- birthYear optional
- deathYear optional

No parent references stored here.

All relationships are externalized.

---

# 5.2 Relation

Location:

```text
data/relations/{id}.json
```

Schema:

```json
{
  "id": "uuid",

  "type": "biological_parent",

  "from": "uuid",
  "to": "uuid",

  "attributes": {
    "year": 3019
  }
}
```

---

## Supported Relation Types (MVP)

Layout-Critical:

```text
biological_parent
```

Visual Overlay:

```text
marriage
mentor
step_parent
adoption
member_of
```

Custom types are allowed.

The UI may not provide specialized rendering for unknown types.

---

## Relation Rules

Relations are directed.

Example:

```text
Arathorn -> Aragorn
type = biological_parent
```

Example:

```text
Aragorn -> Arwen
type = marriage
```

Direction of non-biological relations is mostly semantic.

---

# 5.3 Event

Location:

```text
data/events/{id}.json
```

Schema:

```json
{
  "id": "uuid",

  "type": "marriage",

  "year": 3019,

  "participants": [
    "uuid"
  ],

  "metadata": {}
}
```

---

## Event Usage

Events are NOT used for graph layout.

Events exist for future:

- timeline views
- historical visualizations
- analytical projections

---

# 6. Biological Lineage Rules

This is the most important constraint in the system.

---

## Biological Parent Constraint

A person may have:

```text
0..2 biological parents
```

Examples:

```text
0 = unknown
1 = partially known
2 = known parents
```

More than two biological parents are not supported in MVP.

---

## Why

This guarantees:

- stable tree projection
- deterministic layout
- compatibility with ELK.js

---

## Non-Biological Parent Roles

Represented using overlay relations:

```text
step_parent
mentor
adoption
```

These relations never affect generation calculation.

---

# 7. Graph Semantics

## Core Graph

Used for layout:

```text
biological_parent
```

Only.

---

## Overlay Graph

Used for visual augmentation:

```text
marriage
mentor
adoption
step_parent
member_of
custom
```

Overlay edges do not affect node positioning.

---

# 8. Layout Engine

## ELK.js

ELK.js is the primary layout engine.

Input:

- persons
- biological_parent relations

Only.

---

## Layout Goals

Priorities:

1. readability
2. minimal edge crossings
3. stable positioning
4. generation consistency

---

## Deterministic Layout

Given identical data:

```text
same input
=
same layout
```

The graph should not randomly rearrange itself.

---

# 9. User Interface

## Primary View

Default startup:

```text
Full Graph Overview
Zoom-To-Fit
```

Users should immediately see the entire graph.

---

## Navigation

Supported:

- Pan
- Zoom
- Search
- Node Selection

---

## Search

Shortcut:

```text
CTRL + K
```

Search by:

- name

Future:

- house
- relation type

---

# 10. Selection Model

## Single Selection

Click:

```text
select node
```

Opens details panel.

---

## Multi Selection

Shift + Click:

```text
select node A
select node B
```

---

## MVP Analysis Mode

Calculate:

```text
Lowest Common Ancestor
```

using biological lineage only.

---

## Visualization

Highlight:

- connecting lineage
- common ancestor

Fade:

- unrelated nodes

---

## Future Extension

Optional:

```text
Shortest Path
```

across all relation types.

Not part of MVP.

---

# 11. Houses

MVP:

```json
{
  "houses": [
    "Dunedain"
  ]
}
```

House values are simple tags.

---

Future possibility:

```text
House as Node
```

with dedicated relations.

Not part of MVP.

---

# 12. Timeline Strategy

Timeline is a future feature.

---

## Important Rule

Timeline is:

```text
Derived View
```

NOT:

```text
Primary Data Model
```

---

## Timeline Sources

Derived from:

- Person.birthYear
- Person.deathYear
- Relation.attributes.year
- Event.year

---

## Timeline Purpose

Examples:

- births
- deaths
- marriages
- coronations
- battles

---

# 13. Performance Targets

MVP Dataset:

```text
500 - 3000 persons
```

Target.

---

## Non-Target

The following is explicitly NOT a requirement:

```text
50,000+ nodes
```

Such datasets may require:

- clustering
- viewport culling
- WebGL rendering
- progressive loading

These are future concerns.

---

# 14. IDs

All entities use UUIDs.

Example:

```text
550e8400-e29b-41d4-a716-446655440000
```

---

## Rules

IDs:

- generated once
- immutable
- never derived from names

---

# 15. Validation Rules

Future CI validation may verify:

- valid JSON
- unique IDs
- reference existence
- biological parent constraints

---

## MVP Behavior

Invalid references:

```text
warning
```

not necessarily hard failure.

Maintainers decide how to resolve issues.

---

# 16. Tooling

Optional PowerShell tooling:

```powershell
$p = New-Person

New-Relation `
    -Type biological_parent `
    -From $parent `
    -To $child
```

Purpose:

- simplify authoring
- reduce manual JSON editing

Tooling must generate valid JSON.

JSON remains the source of truth.

---

# 17. Hosting

Primary target:

GitHub Pages

Requirements:

- fully static
- client-side only

---

# 18. Future Features

Potential future additions:

- GEDCOM import
- GEDCOM export
- Timeline view
- House nodes
- Source citations
- Data confidence
- Historical uncertainty
- Graph shortest-path analysis
- Browser editing
- Contributor workflow tooling

---

# 19. Non-Goals

Not planned for MVP:

- Database
- Backend API
- Event sourcing
- Real-time collaboration
- Historical graph reconstruction
- Automatic duplicate detection
- Temporal queries

---

# 20. Final Definition

The application is:

> A Git-native, client-side graph explorer that projects biological lineage into a readable tree structure while supporting arbitrary social relationship overlays and future historical event visualization.
````
