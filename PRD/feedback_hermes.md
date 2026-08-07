# Feature Request: Descendant Relations

## Problem
Das Backend unterstützt aktuell nur `biological_parent` und `marriage` Relationen. Für urzeitliche Elfen (Elf-Väter wie Imin, Tata, Enel) und ihre Nachkommen über mehrere Generationen fehlt eine `descendant` Relation.

## Use Case
Die drei Elf-Väter erwachten bei Cuiviénen ohne eigene Eltern. Ihre Nachkommen (z.B. Finwë, Ingwë, Elwë) sind über viele Generationen entfernt, aber die genaue Genealogie ist nicht überliefert.

**Beispiele:**
- **Imin** → Ingwë (High King der Vanyar): Mehrere Generationen dazwischen, keine direkte Eltern-Relation möglich
- **Tata** → Finwë (High King der Noldor): Über Maidros/Nurwe Linie, aber Genealogie unbekannt
- **Enel** → Elwë/Olwë: ✅ Aktuell gelöst via direkte `biological_parent` Relation (Workaround)

## Aktuelle Workarounds

### Workaround 1: Direkte biological_parent (falsch)
Aktuell müsste man Finwë als direktes Kind von Tata eintragen:
```json
{
  "type": "biological_parent",
  "from": "g7h8i9j0-k1l2-4m3n-4o5p-6q7r8s9t0u06",  // Tata
  "to": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01",    // Finwë
  "attributes": { "date": { "era": "Years of the Trees", "year": null } }
}
```
**Problem:** Impliziert direkte Elternschaft, was genealogisch falsch ist.

### Workaround 2: Keine Relation (besser)
Finwë bleibt ohne Eltern-Eintrag. Das Backend zeigt ihn als "ohne bekannte Eltern" an.
**Problem:** Die Verbindung zu den Elf-Vätern geht verloren.

## Gewünschtes Feature: `descendant` Relation

### Schema
```json
{
  "id": "<uuid>",
  "type": "descendant",
  "from": "<ancestor_uuid>",
  "to": "<descendant_uuid>",
  "attributes": {
    "generations": "<number|null>",  // Optional: Anzahl Generationen (wenn bekannt)
    "lineage": "<string|null>"       // Optional: "male", "female", "unknown"
  }
}
```

### Beispiele

**Finwë als Nachkomme von Tata:**
```json
{
  "id": "<uuid>",
  "type": "descendant",
  "from": "g7h8i9j0-k1l2-4m3n-4o5p-6q7r8s9t0u06",  // Tata
  "to": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01",    // Finwë
  "attributes": {
    "generations": null,
    "lineage": "unknown"
  }
}
```

**Ingwë als Nachkomme von Imin:**
```json
{
  "id": "<uuid>",
  "type": "descendant",
  "from": "g7h8i9j0-k1l2-4m3n-4o5p-6q7r8s9t0u01",  // Imin
  "to": "<ingwe_uuid>",                              // Ingwë (noch zu erstellen)
  "attributes": {
    "generations": null,
    "lineage": "male"
  }
}
```

## Backend-Änderungen erforderlich

1. **Relation Types erweitern:**
   - Neue Type `descendant` in `relation-schema.json` hinzufügen
   - Validierung: `descendant` erlaubt `generations` und `lineage` Attribute

2. **Graph-Logik anpassen:**
   - `descendant` Relationen im Graph als "schwache" Kanten markieren
   - Bei der Visualisierung: gestrichelte Linie oder andere Farbe als `biological_parent`
   - Nicht für "over_parent" Validierung zählen (da keine direkte Elternschaft)

3. **Frontend-Darstellung:**
   - `descendant` als "Nachkomme von X" anzeigen
   - Optional: "X Generationen später" wenn `generations` gesetzt
   - Im Stammbaum: separate Kategorie oder visuelle Unterscheidung

## Priorität
**Hoch** - Benötigt für korrekte Darstellung der urzeitlichen Elfen-Genealogie.

## Notizen
- Enel → Elwë/Olwë ist aktuell via `biological_parent` gelöst (akzeptabler Workaround da Tolkien hier von direktem Erwachen spricht)
- Imin → Ingwë und Tata → Finwë benötigen zwingend `descendant` da mehrere Generationen dazwischen liegen

---

# Feature Request: Canonical / Non-Canonical Filtering

## Problem
Das Legendarium enthält Figuren und Genealogien aus verschiedenen Quellen mit unterschiedlichem Kanonizitätsgrad:

1. **Kanonisch** (veröffentlicht von Tolkien): Silmarillion, LOTR, Hobbit
2. **Posthum** (herausgegeben von Christopher Tolkien): History of Middle-earth (HoME), Unfinished Tales
3. **Sekundärquellen** (interpretiert/fan-basiert): Notion Club Archives, Fenopaedia, LOTR Fandom Wiki

**Beispiel:** Die Kinder der Elf-Väter (Maidros, Nurwe als Söhne von Tata) stammen aus HoME-Texten ("The Awaking of the Elves"), sind aber nicht im Silmarillion enthalten. Manche Quellen geben ihnen andere Namen oder keine Namen.

## Gewünschtes Feature: Kanon-Filter

### Schema-Erweiterung: `canonicity` Attribute

**Für Personen:**
```json
{
  "id": "g7h8i9j0-k1l2-4m3n-4o5p-6q7r8s9t0u08",
  "name": "Maidros",
  "gender": "male",
  "species": "Elf",
  "canonicity": {
    "level": "posthumous",  // "canonical", "posthumous", "secondary", "fan"
    "source": "HoME 11: The Later Quenta Silmarillion",
    "notes": "Name varies across manuscripts; some versions unnamed"
  },
  ...
}
```

**Für Relationen:**
```json
{
  "id": "<uuid>",
  "type": "biological_parent",
  "from": "<parent_uuid>",
  "to": "<child_uuid>",
  "canonicity": {
    "level": "posthumous",
    "source": "HoME 11",
    "notes": "Genealogy of Tata's children uncertain"
  }
}
```

### Kanon-Level Definitionen

| Level | Beschreibung | Beispiele |
|-------|-------------|-----------|
| `canonical` | Zu Tolkiens Lebzeiten veröffentlicht | Silmarillion, LOTR, Hobbit Figuren |
| `posthumous` | Aus Christopher Tolkiens Editionen | HoME, Unfinished Tales, Children of Húrin |
| `secondary` | Aus autoritativen Sekundärquellen | Notion Club Archives, Tolkien Gateway (wenn auf HoME basierend) |
| `fan` | Fan-Interpretationen, nicht-kanonisch | Eigene Erfindungen, alternative Genealogien |

### Backend-Änderungen

1. **Schema erweitern:**
   - `canonicity` Objekt zu `person-schema.json` und `relation-schema.json` hinzufügen
   - Felder: `level` (required), `source` (optional), `notes` (optional)

2. **Filter-Logik implementieren:**
   - API-Endpoint: `GET /persons?canonicity=canonical,posthumous`
   - API-Endpoint: `GET /relations?canonicity_min=canonical`
   - Default-Filter: `canonical,posthumous` (zeigt HoME-Inhalte, blendet Fan-Inhalte aus)

3. **Frontend-UI:**
   - Toggle: "Zeige nur kanonische Inhalte" vs. "Zeige alle Quellen"
   - Visuelle Markierung: nicht-kanonische Einträge mit Icon oder Farbe kennzeichnen
   - Tooltip: "Quelle: HoME 11" beim Hover

### Use Case: Maidros/Nurwe Beispiel

**Aktuell:**
- Maidros und Nurwe sind als Söhne von Tata im Dataset
- Keine Unterscheidung zu kanonischen Figuren wie Fëanor

**Mit Filter:**
- Maidros/Nurwe: `canonicity.level = "posthumous"`
- Fëanor: `canonicity.level = "canonical"`
- User kann einstellen: "Zeige nur kanonisch" → Maidros/Nurwe ausgeblendet
- User kann einstellen: "Zeige alle" → Maidros/Nurwe sichtbar, mit Quellenangabe

### Implementierungspriorität

1. **Phase 1:** Schema-Erweiterung (backend)
2. **Phase 2:** API-Filter (backend)
3. **Phase 3:** Frontend-Toggle + visuelle Markierung
4. **Phase 4:** Bestehende Einträge nachträglich taggen

### Migration bestehender Daten

Bestehende Einträge ohne `canonicity`-Attribut werden als `canonical` behandelt (backward compatible).

**Batch-Tagging-Script:**
```python
# Personen aus Silmarillion/LOTR → "canonical"
# Personen nur aus HoME → "posthumous"  
# Personen nur aus Notion Club/Fenopaedia → "secondary"
```

## Notizen
- Dieses Feature ermöglicht es, verschiedene "Versionen" des Legendariums zu unterstützen
- User können selbst entscheiden, wie streng sie den Kanon auslegen wollen
- Erleichtert die Diskussion über widersprüchliche Genealogien (z.B. verschiedene Versionen in HoME)
