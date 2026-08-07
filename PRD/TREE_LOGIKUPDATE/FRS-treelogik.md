# FRS Tree-Logik

## 1. Zweck

Dieses Dokument beschreibt die fachlichen Anforderungen an die Tree-Logik fuer Preview3 und ihre Nachfolge-Implementierung.

Ziel ist eine deterministische, konfigurierbare und von der UI entkoppelte Tree-Logik, die:

- biologische Abstammung als primaere Layout-Grundlage verwendet
- Heirat je nach Modus unterschiedlich darstellt
- Haus-Kontexte und Haus-Anker fachlich sauber behandelt
- kuratierte Reihenfolgen und vertikale Korrekturen erlaubt
- spaeteren Hauskontext wie Dunedain beruecksichtigt, ohne daraus automatisch einen Root-Anchor zu machen

Dieses Dokument ist fachlich nachgeordnet zu:

- PRD-reviewed3.md
- PRD-reviewed4.md
- setup3.md
- README.md

Wenn dieses Dokument einer der obigen Quellen widerspricht, haben die obigen Quellen Vorrang.

## 2. Fachliche Invarianten

### 2.1 Layout-Basis

- Biologische Eltern-Kind-Relationen sind die einzige primaere Layout-Eingabe.
- Heirat ist in Modus 1 und Modus 2 keine biologische Strukturkante.
- Modus 3 darf die Struktur aktiv umformen, aber nur innerhalb der in diesem Dokument definierten Regeln.

### 2.2 Entkopplung

- Die Tree-Logik muss als eigenstaendige Einheit implementiert werden.
- UI, Navigation, Fokus und Bedienlogik duerfen die Tree-Logik nur ueber klar definierte Eingabeparameter beeinflussen.
- Preview3 ist die Referenzbasis fuer diese Entkopplung.

### 2.3 Reihenfolge

- Personen verwenden metadata.order als fachliche Reihenfolge innerhalb einer Stufe.
- Fehlt metadata.order, wird deterministisch sortiert.
- Empfohlene Tiebreaker-Reihenfolge:
  1. metadata.order
  2. Name
  3. ID
- Haeuser verwenden anchor.order fuer die Reihenfolge der Root-Anker.
- Es wird kein paralleles layout.order fuer Personen oder Haeuser eingefuehrt.

### 2.4 Vertikale Korrektur

- Personen duerfen optional metadata.layout.yOffset besitzen.
- Haeuser duerfen optional layout.yOffset besitzen.
- yOffset ist ein relativer Raster-Offset zur automatisch berechneten Position.
- Eine Rastereinheit ist die kuratierte Schrittweite fuer vertikale Verschiebung.
- Kuratierte Werte duerfen mehrfaches Raster verwenden, zum Beispiel 5 x Raster fuer deutlichere fachliche Staffelung.
- Kuratierte yOffset-Werte haben fachlich Vorrang vor automatischer Kollisionsvermeidung, soweit die Engine die Kantenbeziehungen weiter korrekt darstellt.
- Bei Haeusern darf yOffset bewusst groessere vertikale Staffelungen erzeugen, zum Beispiel Elben weiter oben und Edain weiter unten.
- Bei Personen darf yOffset ebenfalls mehrere Rastereinheiten verwenden, wenn dadurch eine fachlich gewuenschte Vergleichbarkeit oder Lesbarkeit entsteht.
- Bei Personen ist yOffset als begruendeter Sonderfall zu verstehen, nicht als flaechiges Standardwerkzeug fuer den gesamten Datensatz.
- Die sichtbare vertikale Position ist damit nicht in jedem Fall eine reine Generationsaussage.
- Die biologische Topologie bleibt dennoch unveraendert; yOffset veraendert die Darstellung, nicht die Eltern-Kind-Relationen selbst.

Leitplanke:

- yOffset ist eine kuratierte Praesentationsuebersteuerung und keine stille Umschreibung biologischer Abstammung.
- Wenn yOffset eingesetzt wird, muessen Kanten, Elternschaft und Traversal fachlich eindeutig bleiben.
- Spaeter darf die UI optional kenntlich machen, dass ein Bereich kuratiert vertikal verschoben wurde.

### 2.5 Haus-Semantik

- tier: start bedeutet: Dieses Haus ist fachlich root-anchor-faehig.
- anchor.enabled: true bedeutet: Dieses Haus wird als sichtbarer Root-Anchor gerendert.
- tier: later bedeutet: Dieses Haus ist ein spaeterer oder nicht-rootiger Hauskontext.
- Spaetere Haeuser duerfen in Personen vorkommen, ohne dadurch selbst zu Root-Ankern zu werden.
- Es wird kein zusaetzliches isRootAnchor-Feld eingefuehrt.
- Wenn eine Person mehrere Haeuser besitzt, gilt der erste Eintrag in Person.houses als fachlich fuehrendes Haus fuer Hauskontext-Entscheidungen.
- Weitere Haeuser bleiben sichtbare oder analysierbare Metadaten, werden aber nicht automatisch zu gleichwertigen Root- oder Primärkontexten.

## 3. Root-Haeuser und spaetere Haeuser

### 3.1 Root-Haeuser

Root-Haeuser sind die Haeuser, die fuer den globalen Baumeinstieg als Anker verwendet werden duerfen.

Aktuell wird dies im Datensatz ueber house-definitions.json mit tier: start und anchor.enabled: true ausgedrueckt.

### 3.2 Spaetere Haeuser

Spaetere Haeuser sind fachlich gueltig, erzeugen aber nicht automatisch Root-Anker.

Konkreter Demo-Fall heute:

- Dunedain ist in house-definitions.json als tier: later und anchor.enabled: false definiert.
- Gleichzeitig kommt Dunedain in mehreren Personen vor, z. B. bei Arathorn II, Aragorn II, Arwen und Eldarion.

Fachliche Folge:

- Der Baum darf spaetere Hauszugehoerigkeit anzeigen oder in der Logik nutzen.
- Daraus darf aber kein eigener Start-Anker entstehen, solange die Hausdefinition dies nicht explizit erlaubt.

## 4. Modus-Definitionen und Roadmap

### 4.0 Umsetzungs-Roadmap

- Mode 0 ist die eingefrorene Ist-Loesung.
- Mode 1 und Mode 2 bilden den aktiven Implementationsumfang dieser FRS.
- Mode 3 ist fachlich in dieser FRS beschrieben, wird aber implementierungsseitig bewusst zurueckgestellt, bis Mode 1 und Mode 2 stabil umgesetzt sind.
- Die fachliche Beschreibung von Mode 3 bleibt trotzdem verbindlich, damit spaetere Umsetzung nicht erneut konzeptionell offen ist.

Mode-Logik in der ersten umsetzbaren Ausbaustufe:

- Mode 0: aktueller eingefrorener Referenzstand
- Mode 1: biologisch fokussierte Darstellung mit Partnerprojektion
- Mode 2: biologische Struktur plus Heirats-Overlay ohne Reflow
- Mode 3: fachlich definiert, aber nicht Teil des ersten verpflichtenden Implementationsumfangs

## 4.1 Modus 1: Aktuelles Fokusverhalten

Modus 1 bildet das heutige Grundverhalten nach.

Fachliche Regeln:

- Der Baum wird entlang der biologischen Hauptstruktur dargestellt.
- Bei einem Paar wird der Partner angezeigt.
- Die UI darf einen Partner anklickbar machen, um zum Partner zu springen.
- Die Partner-Navigation ist UI-Verhalten, nicht Kern der Tree-Logik.
- Das Layout selbst bleibt biologisch zentriert.

ASCII-Beispiel mit realem Demo-Fall:

Quelle im Demo-Datensatz:

- Arathorn II
- Gilraen
- Aragorn II
- Arwen
- Eldarion

Fachliche Skizze:

```text
Arathorn II ---- Gilraen
      |             |
      +------ Aragorn II ------ [Partnerfeld: Arwen]
                           |
                       Eldarion
```

Interpretation fuer Modus 1:

- Die biologische Linie bleibt im Vordergrund.
- Der Partner kann als seitlich oder zusaetzlich angedocktes Element erscheinen.
- Die Darstellung darf den Fokus auf einer dominanten Stammlinie behalten.

## 4.2 Modus 2: Blutlinie starr

Modus 2 zeigt Heirat explizit, ohne dass die Heiratslinie den biologischen Layout-Fluss verdrängt.

Fachliche Regeln:

- Heirat wird als direkte visuelle Verbindung dargestellt.
- Diese Verbindung ist ein Overlay.
- Die Heiratslinie bewirkt kein Ausweichen anderer Nodes.
- Das biologische Layout bleibt unveraendert.

ASCII-Beispiel mit demselben Demo-Fall:

```text
Arathorn II      Gilraen
     \            /
      \          /
       +-- Aragorn II ---- Arwen
              |
           Eldarion

Legende:
- Vertikale Linie: biologische Abstammung
- Horizontale Ehe-Linie: Overlay ohne Reflow
```

## 4.3 Modus 3: Kombinierter Kontext durch Heirat

Modus 3 ist ein eigener fachlicher Render-Modus.

Er ist kein reines Overlay, sondern darf die Struktur aktiv umformen.

Fachliche Regeln:

- Ausgangspunkt ist eine Heiratsbeziehung.
- Wenn der User eine Ehe explizit auswaehlt, ist diese Ehe der aktive kombinierte Kontext.
- Wenn keine Ehe explizit gewaehlt ist, darf ein Fallback auf die naheliegendste Ehe zur aktuell selektierten Person verwendet werden.
- Bei Mehrfachheiraten darf immer nur ein priorisierter kombinierter Kontext gleichzeitig aktiv sein.
- Der kombinierte Kontext beginnt beim Ehepaar selbst.
- Der kombinierte Kontext wirkt nach unten zu den Nachkommen.
- Der aktive Modus-3-Kontext umfasst alle gemeinsamen Nachkommen und deren biologische Unterzweige.
- Im kombinierten Kontext bleiben beide Haeuser sichtbar und gleichberechtigt.
- Es entsteht kein neues dominantes Fusionshaus.
- Heirat allein reicht als Trigger aus.
- Wenn die aktive Ehe keine gemeinsamen biologischen Kinder hat, bleibt mindestens das Ehepaar selbst als kombinierter Kontext hervorgehoben.
- Fehlt einer Seite ein verwertbarer Hauskontext, darf der Modus trotzdem auf Personenlinien-Ebene arbeiten.
- Wenn ein Nachkomme innerhalb des aktiven Modus-3-Kontexts selbst heiratet, bleibt diese Folgeheirat zunaechst Basislayout oder Overlay, bis sie selbst aktiv gewaehlt wird.

### 4.3.1 Konkreter Demo-Fall fuer Modus 3

Empfohlener Primärfall aus dem Demo-Datensatz:

- Beren Erchamion, House of Beor
- Luthien, Teleri
- Dior, House of Beor und Teleri

Warum dieser Fall gut ist:

- Er verbindet zwei unterschiedliche Hauskontexte.
- Der gemeinsame Nachkomme Dior traegt im Datensatz beide Hauszuordnungen.
- Das ist ein guter fachlicher Referenzfall fuer einen kombinierten Stammbaumkontext.

ASCII-Skizze:

```text
House of Beor                 Teleri
     |                           |
   Beren ===== Heirat ===== Luthien
                ||
                ||   aktiver kombinierter Kontext
                \/
              Dior
       [House of Beor, Teleri]
```

### 4.3.2 Zweiter Demo-Fall fuer Modus 3

- Tuor, House of Hador
- Idril, Noldor und Teleri
- Eärendil

ASCII-Skizze:

```text
House of Hador             Noldor / Teleri
      |                           |
    Tuor ===== Heirat ===== Idril
               ||
               \/
            Eärendil
```

Fachliche Aussage:

- Dieser Fall eignet sich besonders gut fuer die Frage, wie zwei Hauskontexte gleichberechtigt sichtbar bleiben.
- Er eignet sich weniger gut als Dior fuer eine direkte Mehrfach-Hauszuweisung beim Kind, weil Eärendil im Datensatz aktuell nur House of Hador traegt.

### 4.3.3 Sonderfall ohne gemeinsame Kinder

Fachliche Regel:

- Modus 3 bleibt ein Ehe-getriebener Modus.
- Wenn eine aktive Ehe keine gemeinsamen biologischen Kinder besitzt, entsteht kein Nachkommenraum.
- In diesem Fall wird mindestens das Ehepaar selbst als kombinierter Kontext hervorgehoben.

Hinweis zum Demo-Datensatz:

- Fuer diese FRS-Fassung ist kein belastbar verifizierter Demo-Fall mit Ehe ohne gemeinsame biologische Kinder als Referenzbeispiel fest verdrahtet.
- Die Regel bleibt trotzdem verbindlich, weil sie das Verhalten fuer kuenftige Datensaetze eindeutig macht.

ASCII-Skizze:

```text
Haus A                    Haus B
   |                         |
Person A ===== Heirat ===== Person B

Kein gemeinsamer Nachkommenzweig vorhanden.
Modus 3 hebt das Paar selbst als kombinierten Kontext hervor.
```

## 5. Edge Cases mit realen Demo-Beispielen

## 5.0 Eingefrorener Referenzmodus

Fachliche Bedeutung:

- Mode 0 dient als eingefrorener Vergleichsstand.
- Er erlaubt, die spaeteren Unterschiede von Mode 1 und Mode 2 gegen das heutige Verhalten sichtbar und testbar zu machen.
- Er ist kein Innovationsmodus, sondern ein Stabilitaetsanker fuer Regression und UX-Vergleich.

Geeigneter Demo-Fall:

- Aragorn II, Arwen, Eldarion
- Beren, Luthien, Dior

Fachliche Aussage:

- Beide Faelle existieren bereits im aktuellen Showcase und eignen sich fuer Vorher-/Nachher-Vergleiche zwischen Ist-Stand und neuer Logik.

## 5.1 Mehrfachheirat und Halbgeschwister

Konkreter Demo-Fall:

- Finwë heiratet Míriel.
- Aus dieser Ehe geht Fëanor hervor.
- Finwë heiratet danach Indis.
- Aus dieser Ehe gehen unter anderem Fingolfin und Finarfin hervor.

Fachliche Bedeutung:

- Dies ist der beste vorhandene Demo-Fall fuer Mehrfachheirat.
- In Modus 3 darf nicht automatisch jede moegliche Ehe gleichzeitig kombiniert werden.
- Der aktive Kontext muss priorisiert werden.

ASCII-Skizze:

```text
                 Finwë
                /     \
               /       \
         Míriel         Indis
            |            /  \
          Fëanor   Fingolfin Finarfin

Fall in Modus 3:
- Aktive Ehe A: Finwë + Míriel
- Aktive Ehe B: Finwë + Indis
- Es darf immer nur ein kombinierter Kontext aktiv sein.
```

## 5.2 Kinder aus frueheren Beziehungen

Default-Regel fuer die FRS:

- Kinder aus frueheren Beziehungen bleiben sichtbar.
- Sie werden als Nebenzweige markiert.
- Sie werden nicht automatisch in den Haupt-Merge des aktiven Ehekontexts integriert.

ASCII-Skizze auf Basis des Finwë-Falls:

```text
Aktiver Kontext: Finwë + Indis

           Finwë ===== Indis
                |       |
                +--- gemeinsame Linie
                |      / \
                | Fingolfin Finarfin
                |
         [Nebenzweig: Fëanor aus Ehe mit Míriel]
```

## 5.3 Kuratierte Vertikalverschiebung bei Personen

Konkreter fachlicher Zieltyp:

- Einzelne Personen duerfen bewusst vertikal verschoben werden, wenn der Datensatz dadurch fachlich lesbarer oder im Vergleich plausibler wird.
- Ein typischer Anwendungsfall ist eine Person, die biologisch in einer anderen Ebene liegt, fuer die gewuenschte Lesart aber naeher an einen Vergleichspartner oder Ehekontext gezogen werden soll.

Beispielhafte fachliche Zielvorstellung:

```text
Auto-Layout:

Aragorn
    |
 [Abstand]
    |
Arwen

Kuratierte Darstellung:

Aragorn ---- Arwen
       |
   Eldarion
```

Fachliche Aussage:

- Diese Art der Korrektur ist zulaessig, wenn sie die Lesbarkeit des Fachbilds erhoeht.
- Diese Art der Korrektur ist als Sonderfall gedacht und soll nicht still zum Regelfall fuer Personen werden.
- Sie darf aber nicht dazu fuehren, dass Benutzer die biologische Generationsebene als unveraenderliche geometrische Wahrheit missverstehen.

## 5.4 Kuratierte Vertikalverschiebung bei Haeusern

Konkreter fachlicher Zieltyp:

- Root-Haeuser duerfen bewusst vertikal gestaffelt werden, um groessere kulturelle oder fachliche Gruppen lesbarer zu machen.
- Ein geplanter Anwendungsfall ist, Elbenhaeuser sichtbar hoeher und Edain-Haeuser sichtbar tiefer starten zu lassen.

ASCII-Skizze:

```text
Vanyar           Noldor           Teleri
   [hoch]          [hoch]           [hoch]


House of Beor    House of Hador    House of Haleth
    [tiefer]         [tiefer]          [tiefer]
```

Fachliche Aussage:

- Diese Staffelung ist bewusst kuratiert.
- Sie soll Gruppen lesbarer machen und nicht vortaeuschen, dass tiefere Haeuser biologisch spaeter im Sinne einer echten Eltern-Generationskette entstanden seien.

## 5.5 Mehrere Haeuser an einer Person

Konkrete Demo-Faelle:

- Idril: Noldor, Teleri
- Findis: Noldor, Vanyar
- Lalwen: Noldor, Vanyar
- Olwë: Teleri, Alqualondë
- Eärwen: Teleri, Alqualondë

Fachliche Regel:

- Der erste Eintrag in Person.houses ist das fuehrende Haus.
- Weitere Hauswerte bleiben erhalten, erzeugen aber keinen zweiten gleichwertigen Primaerkontext.

ASCII-Skizze:

```text
Idril
   houses = [Noldor, Teleri]

Regel:
- Primärkontext: Noldor
- Zusatzkontext: Teleri
```

Fachliche Bedeutung:

- Diese Regel ist notwendig, damit Root-Anker, Haus-Merge und Sortierung deterministisch bleiben.
- Ohne Primärhaus-Regel waeren Hausstart, Merge-Zugehoerigkeit und Kontextbreite mehrdeutig.

## 5.6 Breite Geschwistergruppe fuer X-Reihenfolge

Konkreter Demo-Fall:

- Fëanor und seine sieben Soehne
- Maedhros, Maglor, Celegorm, Caranthir, Curufin, Amrod, Amras

Fachliche Bedeutung:

- Dieser Fall ist ein starker Referenzfall fuer die X-Reihenfolge innerhalb einer Generation.
- Er eignet sich ausserdem als Belastungsfall fuer horizontale Breite und Lesbarkeit.

ASCII-Skizze:

```text
                         Fëanor
                              |
   -------------------------------------------------
   |        |         |         |        |     |    |
Maedhros Maglor Celegorm Caranthir Curufin Amrod Amras
```

Fachliche Regel:

- Solche Gruppen duerfen nicht zufaellig oder rein implizit angeordnet werden.
- Die Reihenfolge muss deterministisch und spaeter ueber metadata.order kuratierbar sein.

## 5.7 Breiter Root-Haus-Kontext fuer Startpunkt-Abstand

Konkreter Demo-Fall:

- Noldor als sehr breiter Kontext ueber Finwë, Fëanor, Fingolfin, Finarfin und deren Folgezweige
- Im Kontrast dazu kleinere oder schmalere Root-Kontexte wie House of Beor in einzelnen Teilbaeumen

Fachliche Bedeutung:

- Der Root-Startpunkt eines Hauses darf nicht nur aus der obersten sichtbaren Root-Zeile abgeleitet werden.
- Die Breite muss aus allen sichtbaren Nachkommen des Root-Haus-Kontexts vorab abgeschaetzt werden.

ASCII-Skizze:

```text
[Root-Haus Noldor]
            |
       Finwë
      /  |   \
Fëanor ... Finarfin ... viele Folgezweige

[Root-Haus House of Beor]
            |
         Beor
          |
      schmalerer Teilbaum
```

Fachliche Regel:

- Die Vorabschaetzung der Root-Haus-Breite erfolgt auf Basis aller sichtbaren Nachkommen des Root-Haus-Kontexts.
- Nur so lassen sich Startpunkte ausreichend entkoppeln und Ueberlappungen reduzieren.

## 5.8 Folgeheirat innerhalb eines aktiven Modus-3-Kontexts

Konkreter Demo-Fall:

- Aktive Ehe 1: Beren und Luthien
- Gemeinsamer Nachkomme: Dior
- Folgeheirat von Dior: Dior und Nimloth
- Gemeinsamer Nachkomme aus der Folgeheirat: Elwing

Fachliche Bedeutung:

- Dieser Fall zeigt, dass Modus 3 nicht automatisch kaskadierend jede nachfolgende Ehe in denselben Merge ziehen darf.
- Wenn Beren + Luthien aktiv sind, bleibt die Ehe Dior + Nimloth zunaechst Basislayout oder Overlay.
- Erst wenn Dior + Nimloth selbst aktiv gewaehlt werden, entsteht daraus ein eigener kombinierter Kontext.

ASCII-Skizze:

```text
Aktiver Kontext A:

Beren ===== Luthien
            ||
            \/
          Dior ----- Nimloth
             |
         Elwing

Regel:
- Beren + Luthien sind aktiver Merge.
- Dior + Nimloth wird sichtbar, aber noch nicht automatisch zu Merge B.
```

## 5.9 Fehlender oder leerer Hauskontext bei Nachkommen

Konkreter Demo-Fall:

- Elrond und Celebrian sind verheiratet.
- Arwen hat im Datensatz Dunedain.
- Elladan und Elrohir haben im Datensatz leere houses-Arrays.

Fachliche Bedeutung:

- Die Modus-3-Logik darf nicht daran scheitern, dass einzelne Nachkommen keinen Hauswert tragen.
- Der kombinierte Kontext muss in solchen Faellen ueber Personenlinien weiter funktionieren.

ASCII-Skizze:

```text
Elrond ===== Celebrian
   |            |
   +---- Arwen      [Haus vorhanden]
   +---- Elladan    [houses: []]
   +---- Elrohir    [houses: []]
```

## 5.10 Spaeteres Haus ohne Root-Anker

Konkreter Demo-Fall:

- Dunedain ist in house-definitions.json ein spaeteres Haus.
- Personen wie Arathorn II, Aragorn II, Arwen und Eldarion tragen dennoch Dunedain.

Fachliche Bedeutung:

- Das Haus ist fachlich relevant.
- Es darf aber im globalen Einstieg nicht wie ein Root-Haus behandelt werden.

ASCII-Skizze:

```text
[Kein Root-Anchor fuer Dunedain]

Arathorn II ---- Gilraen
      |
   Aragorn II ---- Arwen
         |
      Eldarion

Alle koennen Dunedain tragen,
ohne dass Dunedain oben als eigener Start-Anker entsteht.
```

## 5.11 Kein belastbarer Demo-Fall fuer Heirat ohne Nachkommen verifiziert

Stand dieser FRS:

- Im aktuellen Demo-Datensatz wurde fuer diese Fassung kein belastbar verifizierter Referenzfall dokumentiert, der als klare Ehe ohne gemeinsame biologische Nachkommen dienen soll.
- Die Fachregel bleibt dennoch gueltig: Modus 3 darf auch durch Heirat allein aktiviert werden.
- Sobald ein sauberer Demo-Fall kuratiert ist, soll dieses Kapitel erweitert werden.

## 6. Anforderungen an Haus-Anker-Abstaende

- Die Startposition von Root-Haeusern darf nicht nur an den obersten aktuellen Knoten haengen.
- Die Position muss die erwartete Baumbreite des jeweiligen Root-Haus-Kontexts beruecksichtigen.
- Ziel ist eine geringere Ueberlappung und weniger verwirrende Relationen.
- Die Vorabschaetzung der Hausbreite erfolgt fachlich auf Basis aller sichtbaren Nachkommen des Root-Haus-Kontexts.

Fachliche Folge:

- Vor der finalen Root-Anker-Platzierung ist eine Breitenvorabschaetzung pro Root-Haus erforderlich.

## 7. Anforderungen an Preview3 als Referenzbasis

- Preview3 ist fuer dieses Update der fachliche und technische Referenzpfad.
- Die Tree-Logik muss dort als von UI-Komponenten getrennte Einheit weitergefuehrt werden.
- UI-Ereignisse wie Partner-Sprung, Auswahl einer aktiven Ehe oder Wechsel des Modus sind Eingaben an die Tree-Logik, aber keine Fachregeln der Layoutberechnung selbst.

Verifizierter Bezugsrahmen:

- Die aktuelle Preview3-Struktur trennt bereits Tree-Core, Pipeline und Canvas-Darstellung.
- Die Umsetzung soll auf dieser Trennung aufbauen und sie nicht wieder aufweichen.

## 8. Anforderungen an konsumierende UI-Abhaengigkeiten

Diese Punkte sind nicht Kern der Tree-Logik, aber fuer den ersten umsetzbaren Stand als konsumierende Anforderungen verbindlich:

- Tree Navigator mit Zoom, Richtungsnavigation und Ein-/Ausklappen oder Verbergen
- Mode Switch fuer mindestens Mode 0, Mode 1 und Mode 2
- Aktive Ehe fuer Mode 3 spaeter explizit waehlbar per Klick auf Ehe-Link oder Partnerkontext

Fachliche Auswahlregel fuer aktive Ehe:

- Primaer durch expliziten Klick auf Ehe-Link oder Partnerkontext
- Wenn spaeter kein expliziter Ehe-Fokus gesetzt ist, darf ein Fallback ueber die aktuell selektierte Person erfolgen

## 9. Nicht-blockierende Folgepunkte

- Ein spaeterer expliziter Demo-Fall fuer Ehe ohne gemeinsame Nachkommen ist wuenschenswert, aber nicht blocker fuer den ersten Implementationsumfang.
- Die visuelle Kennzeichnung kuratierter yOffset-Zonen in der UI ist sinnvoll, aber nicht blocker fuer die Tree-Core-Umsetzung.
- Mode 3 bleibt fachlich definiert, wird aber erst nach stabiler Umsetzung von Mode 1 und Mode 2 praktisch aktiviert.

## 10. Zusammenfassung

Die Tree-Logik soll kuenftig klar unterscheidbare Modi besitzen:

- Mode 0: eingefrorener Ist-Stand
- Mode 1: biologisch fokussierte Darstellung mit Partnerprojektion
- Mode 2: biologische Struktur plus Heirats-Overlay ohne Reflow
- Mode 3: aktiver kombinierter Kontext ab einer Ehe, mit kontrollierter Strukturumformung

Die Demo-Beispiele in diesem Dokument sind absichtlich aus dem vorhandenen Datensatz gewaehlt, damit fachliche Diskussion und spaetere Umsetzung am selben Material validiert werden koennen.