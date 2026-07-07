# PRD-REVIEWED3.md

Version: 1.2 (Architecture Locked)

This document supersedes previous review iterations and resolves the remaining ambiguities regarding temporal representation and deterministic biological graph validation.

---

# 1. Canonical Temporal Model

A single temporal representation SHALL be used across the entire system.

Previous alternatives such as:

```json
{
  "birthYear": 2931
}
```

or

```json
{
  "year": 3019
}
```

are deprecated and SHALL NOT be used.

---

## Canonical Time Type

All temporal values SHALL be represented as:

```json
{
  "era": "Third Age",
  "year": 2931
}
```

or:

```json
null
```

---

## Rules

Required fields:

```json
{
  "era": "string",
  "year": "integer"
}
```

Constraints:

- year MUST be an integer
- era MUST be a string
- null is permitted
- floating point values are forbidden
- date ranges are forbidden
- approximate dates are forbidden
- textual dates are forbidden

---

## Valid Examples

```json
{
  "era": "Third Age",
  "year": 2931
}
```

```json
{
  "era": "First Age",
  "year": 455
}
```

```json
null
```

---

## Invalid Examples

```json
{
  "year": 2931
}
```

Missing era.

---

```json
{
  "era": "Third Age"
}
```

Missing year.

---

```json
{
  "era": "Third Age",
  "year": "2931"
}
```

Year must be integer.

---

```json
{
  "era": "Third Age",
  "year": 2931,
  "approximate": true
}
```

Approximation unsupported in MVP.

---

# 2. Supported Eras

The system SHALL support arbitrary eras.

The following eras are provided as defaults:

```text
Years of the Lamps
Years of the Trees
First Age
Second Age
Third Age
Fourth Age
```

The architecture must not hardcode Tolkien-specific limitations.

Additional eras may be introduced by future datasets.

Example:

```json
{
  "era": "Custom Era",
  "year": 123
}
```

is valid.

---

# 3. Person Schema Update

Canonical Person schema:

```json
{
  "id": "uuid",

  "name": "Aragorn",

  "gender": "male",

  "species": "human",

  "birth": {
    "era": "Third Age",
    "year": 2931
  },

  "death": {
    "era": "Fourth Age",
    "year": 120
  },

  "houses": [
    "Dunedain"
  ],

  "sourceLinks": [
    {
      "label": "Tolkien Gateway",
      "url": "https://tolkiengateway.net/wiki/Aragorn"
    }
  ],

  "portraitUrl": "https://example.org/aragorn.jpg",

  "portraitSourceLabel": "Artist page",

  "portraitSourceUrl": "https://example.org/aragorn-artwork",

  "metadata": {
    "description": "optional"
  }
}
```

Rules:

- gender MAY be null
- species MAY be null
- birth MAY be null
- death MAY be null
- houses MAY be omitted or empty
- sourceLinks MAY be omitted or empty
- portraitUrl MAY be null
- portraitSourceLabel MAY be null
- portraitSourceUrl MAY be null

Notes:

- gender is descriptive metadata in MVP and SHALL NOT be used as an implicit layout anchor
- species is descriptive metadata in MVP and MAY contain values such as `elf`, `dwarf`, or `human`
- sourceLinks is an ordered array; entry `0` is the primary source for UI preview and navigation
- sourceLinks entries MUST be explicitly authored; the system MUST NOT auto-generate Tolkien Gateway links
- portraitUrl is optional and MAY reference a remotely hosted image when the dataset author explicitly accepts that source
- portraitSourceLabel and portraitSourceUrl SHOULD be provided whenever portraitUrl is provided so the UI can surface provenance

---

# 4. Relation Schema Update

Canonical Relation schema:

```json
{
  "id": "uuid",

  "type": "marriage",

  "from": "uuid",
  "to": "uuid",

  "attributes": {
    "date": {
      "era": "Third Age",
      "year": 3019
    }
  }
}
```

Rules:

- attributes.date MAY be null
- relation endpoints MUST be persons

---

# 5. Event Schema Update

Canonical Event schema:

```json
{
  "id": "uuid",

  "type": "battle",

  "date": {
    "era": "Third Age",
    "year": 3019
  },

  "participants": [
    "uuid"
  ],

  "metadata": {}
}
```

Rules:

- date MAY be null
- participants MAY be empty

---

# 6. Deterministic Biological Graph Validation

Biological relations define the layout graph.

Invalid biological structures SHALL NOT prevent rendering.

The system SHALL remain fault tolerant.

---

# 7. Self-Parent Validation

Invalid:

```text
A -> A
```

Behavior:

```text
Ignore relation
Generate warning
Continue rendering
```

---

# 8. Missing Reference Validation

Invalid:

```text
Relation references non-existing person
```

Behavior:

```text
Ignore relation
Generate warning
Continue rendering
```

---

# 9. More Than Two Biological Parents

Constraint:

```text
Maximum biological parents per person = 2
```

---

## Invalid Example

```text
P1 -> Child
P2 -> Child
P3 -> Child
```

---

## Deterministic Resolution

The child SHALL be excluded from biological parent linkage.

Meaning:

```text
All biological_parent relations targeting that child
are ignored for layout generation.
```

Result:

```text
Child rendered without biological parents.
```

---

## Rationale

This avoids:

- arbitrary parent selection
- ordering dependencies
- non-deterministic layouts

The data error remains visible.

---

# 10. Cycle Detection

Biological lineage SHALL be acyclic.

---

## Invalid Example

```text
A -> B
B -> C
C -> A
```

---

## Deterministic Resolution

When a cycle is detected:

```text
Remove the biological relation
with the highest relation ID
participating in the cycle.
```

Generate warning.

Continue rendering.

---

## Example

Relations:

```text
R1: A -> B
R2: B -> C
R3: C -> A
```

Resolution:

```text
R3 ignored
```

Result:

```text
A -> B -> C
```

---

# 11. Deterministic Rendering Requirement

---

# 11. Spouse Projection Rule

Marriage remains a social relation and SHALL NOT become part of the biological layout input.

However, the rendered tree MAY project a spouse next to the biologically visible person.

This projection SHALL follow these rules:

1. the biological tree remains the canonical continuation structure
2. if both spouses are already visible as canonical person nodes on the same generation band, the renderer SHALL use those two nodes as one inline pair and SHALL NOT create an additional projected spouse duplicate
3. if the pair is not already co-located as canonical person nodes, a spouse MAY be attached visually to the currently rendered biological branch person as a context alias
4. the descendants of the pair SHALL be fully continued along exactly one canonical continuation path by default
5. the opposite spouse-side continuation MAY be shown in collapsed form
6. the user MAY expand or collapse the opposite spouse-side continuation by context
7. the same descendant subtree SHALL NOT be fully duplicated under both spouse contexts by default

Deterministic default rule:

- if a person is visible through the active biological branch context, that context owns the expanded continuation
- if no explicit user context exists, the expanded continuation SHALL follow the first qualifying biological branch encountered by deterministic traversal order

This means the system stays branch-local and deterministic without requiring sex- or gender-based anchoring rules.

---

# 12. Deterministic Rendering Requirement

Given:

```text
same dataset
same application version
```

The graph SHALL produce:

```text
same layout
same validation outcome
same ignored relations
```

Every run must behave identically.

---

# 13. Timeline Consistency

Timeline generation SHALL exclusively consume the canonical time type.

Sources:

- Person.birth
- Person.death
- Relation.attributes.date
- Event.date

No alternative temporal formats are permitted.

---

# 14. Final Architecture Invariants

The following rules are now considered architecture invariants.

---

## Data Model

```text
Graph
```

---

## Layout Model

```text
Biological Tree Projection
```

---

## Timeline

```text
Derived Projection
```

---

## Social Relationships

```text
Overlay Layer
```

---

## Marriage Rendering

```text
Spouse Projection Layer on top of the Biological Tree Projection
```

---

## Rendering

```text
Fault Tolerant
```

---

## Relation Endpoints

```text
Person -> Person only
```

---

## Biological Parents

```text
0..2 allowed
```

---

## Temporal Representation

```text
{ era, year }
```

or

```text
null
```

only.

---

## Determinism

Validation and layout behavior MUST be deterministic.

No implementation may depend on:

- file ordering
- load ordering
- runtime timing
- browser-specific behavior

---

# Architecture Status

```text
Architecture Locked
```

The remaining work is implementation, tooling, UX refinement, and future feature expansion.

No unresolved architectural blockers remain.