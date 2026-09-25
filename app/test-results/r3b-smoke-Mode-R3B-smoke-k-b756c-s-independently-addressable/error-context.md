# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: r3b-smoke.spec.ts >> Mode R3B smoke >> keeps both final Finarfin and Earwen projection contexts independently addressable
- Location: tests\r3b-smoke.spec.ts:768:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 28
Received: 888
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - button "Open menu" [ref=e6] [cursor=pointer]
      - generic [ref=e8]:
        - paragraph [ref=e9]: Legendarium Explorer
        - strong [ref=e10]: Legendarium Explorer
    - generic [ref=e11]:
      - group "page theme mode" [ref=e12]:
        - button "Light" [ref=e13] [cursor=pointer]
        - button "Dark" [ref=e21] [cursor=pointer]
        - button "Thematic" [ref=e25] [cursor=pointer]
      - combobox "Custom" [ref=e29]
      - button "Editor" [ref=e30] [cursor=pointer]
  - generic [ref=e37]:
    - generic [ref=e40]:
      - generic [ref=e41]:
        - generic [ref=e42]:
          - button "Reset View" [ref=e43] [cursor=pointer]
          - button "Horizontal Space" [ref=e48] [cursor=pointer]
          - button "Content Fullscreen" [ref=e51] [cursor=pointer]
          - button "Browser Fullscreen" [ref=e58] [cursor=pointer]:
            - generic [ref=e64]: F11
        - generic [ref=e66]:
          - button "Export PNG" [ref=e67] [cursor=pointer]
          - button "Export JSON" [ref=e73] [cursor=pointer]
        - generic [ref=e79]:
          - combobox "Mode R3B" [ref=e80]
          - generic "Toggle overlays" [ref=e81]:
            - checkbox "Overlay" [checked] [ref=e82]
            - generic [ref=e83]: Overlay
        - generic [ref=e85]:
          - group "tree theme mode" [ref=e86]:
            - button "Light" [ref=e87] [cursor=pointer]
            - button "Dark" [ref=e95] [cursor=pointer]
            - button "Thematic" [ref=e99] [cursor=pointer]
          - combobox "Custom" [ref=e103]
          - button "Editor" [ref=e104] [cursor=pointer]
      - status [ref=e109]:
        - strong [ref=e110]: "Mode R3B: Structured Raster Engine v2"
        - generic [ref=e111]: Dedicated branch for the next structured raster tree core with isolated R3B wiring.
      - generic [ref=e112]:
        - generic [ref=e113]:
          - generic [ref=e114]:
            - generic [ref=e115]:
              - paragraph [ref=e116]: Primary Panel
              - heading "Filter, Search & Selection" [level=2] [ref=e117]
            - generic [ref=e118]:
              - button "Float" [ref=e119] [cursor=pointer]
              - button "Minimize" [ref=e124] [cursor=pointer]
          - generic [ref=e127]:
            - generic [ref=e128]:
              - generic [ref=e129]:
                - heading "Filter" [level=3] [ref=e130]
                - button "Clear" [ref=e131] [cursor=pointer]
              - generic [ref=e132]:
                - button "AND" [ref=e133] [cursor=pointer]
                - button "OR" [ref=e134] [cursor=pointer]
                - generic [ref=e135]:
                  - checkbox "Auto-fit matched nodes" [checked] [ref=e136]
                  - text: Auto-fit matched nodes
              - generic [ref=e137]:
                - generic [ref=e138]:
                  - text: House
                  - strong [ref=e139]: "0"
                - generic [ref=e140]:
                  - button "Alqualondë" [ref=e141] [cursor=pointer]
                  - button "Dark Elf" [ref=e142] [cursor=pointer]
                  - button "Dunedain" [ref=e143] [cursor=pointer]
                  - button "House of Bëor" [ref=e144] [cursor=pointer]
                  - button "House of Eorl" [ref=e145] [cursor=pointer]
                  - button "House of Hador" [ref=e146] [cursor=pointer]
                  - button "House of Haleth" [ref=e147] [cursor=pointer]
                  - button "Minyar" [ref=e148] [cursor=pointer]
                  - button "Nelyar" [ref=e149] [cursor=pointer]
                  - button "Noldor" [ref=e150] [cursor=pointer]
                  - button "Sindar" [ref=e151] [cursor=pointer]
                  - button "Tatyar" [ref=e152] [cursor=pointer]
                  - button "Teleri" [ref=e153] [cursor=pointer]
                  - button "Vanyar" [ref=e154] [cursor=pointer]
              - generic [ref=e155]:
                - generic [ref=e156]:
                  - text: Species
                  - strong [ref=e157]: "0"
                - generic [ref=e158]:
                  - button "Elf" [ref=e159] [cursor=pointer]
                  - button "Half-elf" [ref=e160] [cursor=pointer]
                  - button "Maia" [ref=e161] [cursor=pointer]
                  - button "Man" [ref=e162] [cursor=pointer]
              - generic [ref=e163]:
                - generic [ref=e164]:
                  - text: Gender
                  - strong [ref=e165]: "0"
                - generic [ref=e166]:
                  - button "female" [ref=e167] [cursor=pointer]
                  - button "male" [ref=e168] [cursor=pointer]
              - generic [ref=e169]:
                - generic [ref=e170]:
                  - text: Era
                  - strong [ref=e171]: "0"
                - generic [ref=e172]:
                  - button "First Age" [ref=e173] [cursor=pointer]
                  - button "Fourth Age" [ref=e174] [cursor=pointer]
                  - button "Second Age" [ref=e175] [cursor=pointer]
                  - button "Third Age" [ref=e176] [cursor=pointer]
                  - button "Years of the Trees" [ref=e177] [cursor=pointer]
              - paragraph [ref=e178]: 181 matches in the current filter scope.
            - generic [ref=e179]:
              - generic [ref=e180]:
                - heading "Search" [level=3] [ref=e181]
                - generic [ref=e182]: "40"
              - textbox "Search by name, house, species, era..." [ref=e183]
              - generic [ref=e184]:
                - article [ref=e185]:
                  - button [ref=e186]:
                    - strong [ref=e187]: Éomund
                    - text: Man • male • House of Eorl
                  - generic [ref=e188]:
                    - button "Add A" [ref=e189] [cursor=pointer]
                    - button "Add B" [ref=e194] [cursor=pointer]
                - article [ref=e200]:
                  - button [ref=e201]:
                    - strong [ref=e202]: Beleg Cúthalion
                    - text: Elf • male • Sindar, Teleri
                  - generic [ref=e203]:
                    - button "Add A" [ref=e204] [cursor=pointer]
                    - button "Add B" [ref=e209] [cursor=pointer]
                - article [ref=e215]:
                  - button [ref=e216]:
                    - strong [ref=e217]: Haleth
                    - text: Man • female • House of Haleth
                  - generic [ref=e218]:
                    - button "Add A" [ref=e219] [cursor=pointer]
                    - button "Add B" [ref=e224] [cursor=pointer]
                - article [ref=e230]:
                  - button [ref=e231]:
                    - strong [ref=e232]: Tar-Minastir
                    - text: Man • male • Dunedain
                  - generic [ref=e233]:
                    - button "Add A" [ref=e234] [cursor=pointer]
                    - button "Add B" [ref=e239] [cursor=pointer]
                - article [ref=e245]:
                  - button [ref=e246]:
                    - strong [ref=e247]: Ar-Adûnakhôr
                    - text: Man • male • Dunedain
                  - generic [ref=e248]:
                    - button "Add A" [ref=e249] [cursor=pointer]
                    - button "Add B" [ref=e254] [cursor=pointer]
                - article [ref=e260]:
                  - button [ref=e261]:
                    - strong [ref=e262]: Amandil
                    - text: Man • male • Dunedain
                  - generic [ref=e263]:
                    - button "Add A" [ref=e264] [cursor=pointer]
                    - button "Add B" [ref=e269] [cursor=pointer]
                - article [ref=e275]:
                  - button [ref=e276]:
                    - strong [ref=e277]: Tar-Calmacil
                    - text: Man • male • Dunedain
                  - generic [ref=e278]:
                    - button "Add A" [ref=e279] [cursor=pointer]
                    - button "Add B" [ref=e284] [cursor=pointer]
                - article [ref=e290]:
                  - button [ref=e291]:
                    - strong [ref=e292]: Tarondor
                    - text: Man • male • Dunedain
                  - generic [ref=e293]:
                    - button "Add A" [ref=e294] [cursor=pointer]
                    - button "Add B" [ref=e299] [cursor=pointer]
                - article [ref=e305]:
                  - button [ref=e306]:
                    - strong [ref=e307]: Elenwë
                    - text: Elf • female • Vanyar, Noldor
                  - generic [ref=e308]:
                    - button "Add A" [ref=e309] [cursor=pointer]
                    - button "Add B" [ref=e314] [cursor=pointer]
                - article [ref=e320]:
                  - button [ref=e321]:
                    - strong [ref=e322]: Haleth
                    - text: Man • male • House of Eorl
                  - generic [ref=e323]:
                    - button "Add A" [ref=e324] [cursor=pointer]
                    - button "Add B" [ref=e329] [cursor=pointer]
                - article [ref=e335]:
                  - button [ref=e336]:
                    - strong [ref=e337]: Celeborn
                    - text: Elf • male • Teleri, Noldor
                  - generic [ref=e338]:
                    - button "Add A" [ref=e339] [cursor=pointer]
                    - button "Add B" [ref=e344] [cursor=pointer]
                - article [ref=e350]:
                  - button [ref=e351]:
                    - strong [ref=e352]: Galadhon
                    - text: Elf • male • Teleri
                  - generic [ref=e353]:
                    - button "Add A" [ref=e354] [cursor=pointer]
                    - button "Add B" [ref=e359] [cursor=pointer]
                - article [ref=e365]:
                  - button [ref=e366]:
                    - strong [ref=e367]: Ar-Pharazôn
                    - text: Man • male • Dunedain
                  - generic [ref=e368]:
                    - button "Add A" [ref=e369] [cursor=pointer]
                    - button "Add B" [ref=e374] [cursor=pointer]
                - article [ref=e380]:
                  - button [ref=e381]:
                    - strong [ref=e382]: Haldir
                    - text: Man • male • House of Haleth
                  - generic [ref=e383]:
                    - button "Add A" [ref=e384] [cursor=pointer]
                    - button "Add B" [ref=e389] [cursor=pointer]
                - article [ref=e395]:
                  - button [ref=e396]:
                    - strong [ref=e397]: Tar-Telemmaitë
                    - text: Man • male • Dunedain
                  - generic [ref=e398]:
                    - button "Add A" [ref=e399] [cursor=pointer]
                    - button "Add B" [ref=e404] [cursor=pointer]
                - article [ref=e410]:
                  - button [ref=e411]:
                    - strong [ref=e412]: Elrohir
                    - text: Half-elf • male
                  - generic [ref=e413]:
                    - button "Add A" [ref=e414] [cursor=pointer]
                    - button "Add B" [ref=e419] [cursor=pointer]
                - article [ref=e425]:
                  - button [ref=e426]:
                    - strong [ref=e427]: Tar-Palantir
                    - text: Man • male • Dunedain
                  - generic [ref=e428]:
                    - button "Add A" [ref=e429] [cursor=pointer]
                    - button "Add B" [ref=e434] [cursor=pointer]
                - article [ref=e440]:
                  - button [ref=e441]:
                    - strong [ref=e442]: Elwë (Thingol)
                    - text: Elf • male • Teleri
                  - generic [ref=e443]:
                    - button "Add A" [ref=e444] [cursor=pointer]
                    - button "Add B" [ref=e449] [cursor=pointer]
                - article [ref=e455]:
                  - button [ref=e456]:
                    - strong [ref=e457]: Walda
                    - text: Man • male • House of Eorl
                  - generic [ref=e458]:
                    - button "Add A" [ref=e459] [cursor=pointer]
                    - button "Add B" [ref=e464] [cursor=pointer]
                - article [ref=e470]:
                  - button [ref=e471]:
                    - strong [ref=e472]: Melian
                    - text: Maia • female • Teleri
                  - generic [ref=e473]:
                    - button "Add A" [ref=e474] [cursor=pointer]
                    - button "Add B" [ref=e479] [cursor=pointer]
                - article [ref=e485]:
                  - button [ref=e486]:
                    - strong [ref=e487]: Araval
                    - text: Man • male • Dunedain
                  - generic [ref=e488]:
                    - button "Add A" [ref=e489] [cursor=pointer]
                    - button "Add B" [ref=e494] [cursor=pointer]
                - article [ref=e500]:
                  - button [ref=e501]:
                    - strong [ref=e502]: Tar-Elendil
                    - text: Man • male • Dunedain
                  - generic [ref=e503]:
                    - button "Add A" [ref=e504] [cursor=pointer]
                    - button "Add B" [ref=e509] [cursor=pointer]
                - article [ref=e515]:
                  - button [ref=e516]:
                    - strong [ref=e517]: Ar-Sakalthôr
                    - text: Man • male • Dunedain
                  - generic [ref=e518]:
                    - button "Add A" [ref=e519] [cursor=pointer]
                    - button "Add B" [ref=e524] [cursor=pointer]
                - article [ref=e530]:
                  - button [ref=e531]:
                    - strong [ref=e532]: Mablung
                    - text: Elf • male • Sindar, Teleri
                  - generic [ref=e533]:
                    - button "Add A" [ref=e534] [cursor=pointer]
                    - button "Add B" [ref=e539] [cursor=pointer]
                - article [ref=e545]:
                  - button [ref=e546]:
                    - strong [ref=e547]: Fréawine
                    - text: Man • male • House of Eorl
                  - generic [ref=e548]:
                    - button "Add A" [ref=e549] [cursor=pointer]
                    - button "Add B" [ref=e554] [cursor=pointer]
                - article [ref=e560]:
                  - button [ref=e561]:
                    - strong [ref=e562]: Déor
                    - text: Man • male • House of Eorl
                  - generic [ref=e563]:
                    - button "Add A" [ref=e564] [cursor=pointer]
                    - button "Add B" [ref=e569] [cursor=pointer]
                - article [ref=e575]:
                  - button [ref=e576]:
                    - strong [ref=e577]: Tuor
                    - text: Man • male • House of Hador
                  - generic [ref=e578]:
                    - button "Add A" [ref=e579] [cursor=pointer]
                    - button "Add B" [ref=e584] [cursor=pointer]
                - article [ref=e590]:
                  - button [ref=e591]:
                    - strong [ref=e592]: Elatan
                    - text: Man • male • Dunedain
                  - generic [ref=e593]:
                    - button "Add A" [ref=e594] [cursor=pointer]
                    - button "Add B" [ref=e599] [cursor=pointer]
                - article [ref=e605]:
                  - button [ref=e606]:
                    - strong [ref=e607]: Tar-Telperiën
                    - text: Man • female • Dunedain
                  - generic [ref=e608]:
                    - button "Add A" [ref=e609] [cursor=pointer]
                    - button "Add B" [ref=e614] [cursor=pointer]
                - article [ref=e620]:
                  - button [ref=e621]:
                    - strong [ref=e622]: Thengel
                    - text: Man • male • House of Eorl
                  - generic [ref=e623]:
                    - button "Add A" [ref=e624] [cursor=pointer]
                    - button "Add B" [ref=e629] [cursor=pointer]
                - article [ref=e635]:
                  - button [ref=e636]:
                    - strong [ref=e637]: Eärendil
                    - text: Half-elf • male • House of Hador
                  - generic [ref=e638]:
                    - button "Add A" [ref=e639] [cursor=pointer]
                    - button "Add B" [ref=e644] [cursor=pointer]
                - article [ref=e650]:
                  - button [ref=e651]:
                    - strong [ref=e652]: Idril
                    - text: Elf • female • Noldor, Teleri
                  - generic [ref=e653]:
                    - button "Add A" [ref=e654] [cursor=pointer]
                    - button "Add B" [ref=e659] [cursor=pointer]
                - article [ref=e665]:
                  - button [ref=e666]:
                    - strong [ref=e667]: Brego
                    - text: Man • male • House of Eorl
                  - generic [ref=e668]:
                    - button "Add A" [ref=e669] [cursor=pointer]
                    - button "Add B" [ref=e674] [cursor=pointer]
                - article [ref=e680]:
                  - button [ref=e681]:
                    - strong [ref=e682]: Arathorn II
                    - text: Man • male • Dunedain
                  - generic [ref=e683]:
                    - button "Add A" [ref=e684] [cursor=pointer]
                    - button "Add B" [ref=e689] [cursor=pointer]
                - article [ref=e695]:
                  - button [ref=e696]:
                    - strong [ref=e697]: Gilraen
                    - text: Man • female • Dunedain
                  - generic [ref=e698]:
                    - button "Add A" [ref=e699] [cursor=pointer]
                    - button "Add B" [ref=e704] [cursor=pointer]
                - article [ref=e710]:
                  - button [ref=e711]:
                    - strong [ref=e712]: Aragorn II
                    - text: Man • male • Dunedain
                  - generic [ref=e713]:
                    - button "Add A" [ref=e714] [cursor=pointer]
                    - button "Add B" [ref=e719] [cursor=pointer]
                - article [ref=e725]:
                  - button [ref=e726]:
                    - strong [ref=e727]: Arwen
                    - text: Half-elf • female • Dunedain
                  - generic [ref=e728]:
                    - button "Add A" [ref=e729] [cursor=pointer]
                    - button "Add B" [ref=e734] [cursor=pointer]
                - article [ref=e740]:
                  - button [ref=e741]:
                    - strong [ref=e742]: Eldarion
                    - text: Man • male • Dunedain
                  - generic [ref=e743]:
                    - button "Add A" [ref=e744] [cursor=pointer]
                    - button "Add B" [ref=e749] [cursor=pointer]
                - article [ref=e755]:
                  - button [ref=e756]:
                    - strong [ref=e757]: Elrond
                    - text: Half-elf • male • Dunedain
                  - generic [ref=e758]:
                    - button "Add A" [ref=e759] [cursor=pointer]
                    - button "Add B" [ref=e764] [cursor=pointer]
                - article [ref=e770]:
                  - button [ref=e771]:
                    - strong [ref=e772]: Hador
                    - text: Man • male • House of Hador
                  - generic [ref=e773]:
                    - button "Add A" [ref=e774] [cursor=pointer]
                    - button "Add B" [ref=e779] [cursor=pointer]
            - generic [ref=e785]:
              - generic [ref=e786]:
                - heading "Selection" [level=3] [ref=e787]
                - generic [ref=e788]: 0/2 selected
              - generic [ref=e789]:
                - button "Swap A/B" [disabled] [ref=e790] [cursor=pointer]
                - button "Clear" [disabled] [ref=e791] [cursor=pointer]
              - paragraph [ref=e792]:
                - strong [ref=e793]: A
                - generic [ref=e794]: None selected
                - generic [ref=e795]:
                  - button "Focus" [disabled] [ref=e796] [cursor=pointer]
                  - button "Remove" [disabled] [ref=e797] [cursor=pointer]
              - paragraph [ref=e798]:
                - strong [ref=e799]: B
                - generic [ref=e800]: Use Shift+Click or Add B
                - generic [ref=e801]:
                  - button "Focus" [disabled] [ref=e802] [cursor=pointer]
                  - button "Remove" [disabled] [ref=e803] [cursor=pointer]
              - generic [ref=e804]:
                - generic [ref=e805]: Fade unrelated
                - combobox "Dim" [ref=e806]
              - paragraph [ref=e807]: Click selects A. Shift+Click assigns B. ESC clears selection or closes overlays.
        - generic [ref=e808]:
          - generic [ref=e809]:
            - generic [ref=e810]:
              - paragraph [ref=e811]: Primary Panel
              - heading "Inspector & LCA" [level=2] [ref=e812]
            - generic [ref=e813]:
              - button "Float" [ref=e814] [cursor=pointer]
              - button "Minimize" [ref=e819] [cursor=pointer]
          - generic [ref=e822]:
            - generic [ref=e823]:
              - heading "Inspector" [level=3] [ref=e824]
              - paragraph [ref=e825]: No person selected.
            - generic [ref=e826]:
              - generic [ref=e827]:
                - heading "LCA" [level=3] [ref=e828]
                - generic [ref=e829]:
                  - generic [ref=e830]: Idle
                  - button "Center ancestor" [disabled] [ref=e831] [cursor=pointer]
              - paragraph [ref=e832]: Select two people to compute the biological lowest common ancestor.
        - img "Family tree graph" [ref=e833]:
          - generic [ref=e836]: Minyar and Vanyar line
          - generic [ref=e840]: Nelyar and Teleri line
          - generic [ref=e844]: Tatyar and Noldor line
          - generic [ref=e848]: House of Beor
          - generic [ref=e852]: House of Hador
          - generic [ref=e856]: House of Haleth
          - generic [ref=e860]: House of Eorl
          - generic [ref=e975]:
            - generic [ref=e977]: Finarfin
            - generic [ref=e978]: Elf
          - generic [ref=e981]:
            - generic [ref=e983]: Eärwen
            - generic [ref=e984]: Elf
          - generic [ref=e987]:
            - generic [ref=e989]: Beren Erchamion
            - generic [ref=e990]: Man
          - generic [ref=e993]:
            - generic [ref=e995]: Dior
            - generic [ref=e996]: Half-elf
          - generic [ref=e999]:
            - generic [ref=e1001]: Galadriel
            - generic [ref=e1002]: Elf
          - generic [ref=e1005]:
            - generic [ref=e1007]: Celeborn
            - generic [ref=e1008]: Elf
          - generic [ref=e1011]:
            - generic [ref=e1013]: Elrond
            - generic [ref=e1014]: Half-elf
          - generic [ref=e1017]:
            - generic [ref=e1019]: Hareth
            - generic [ref=e1020]: Man
          - generic [ref=e1023]:
            - generic [ref=e1025]: Emeldir
            - generic [ref=e1026]: Man
          - generic [ref=e1029]:
            - generic [ref=e1031]: Galdor
            - generic [ref=e1032]: Man
          - generic [ref=e1035]:
            - generic [ref=e1037]: Barahir
            - generic [ref=e1038]: Man
          - generic [ref=e1041]:
            - generic [ref=e1043]: Hurin
            - generic [ref=e1044]: Man
          - generic [ref=e1047]:
            - generic [ref=e1049]: Huor
            - generic [ref=e1050]: Man
          - generic [ref=e1053]:
            - generic [ref=e1055]: Rían
            - generic [ref=e1056]: Man
          - generic [ref=e1059]:
            - generic [ref=e1061]: Morwen
            - generic [ref=e1062]: Man
          - generic [ref=e1065]:
            - generic [ref=e1067]: Luthien
            - generic [ref=e1068]: Half-elf
          - generic [ref=e1071]:
            - generic [ref=e1073]: Nimloth
            - generic [ref=e1074]: Elf
          - generic [ref=e1077]:
            - generic [ref=e1079]: Elwing
            - generic [ref=e1080]: Half-elf
          - generic [ref=e1083]:
            - generic [ref=e1085]: Eärendil
            - generic [ref=e1086]: Half-elf
          - generic [ref=e1089]:
            - generic [ref=e1091]: Celebrian
            - generic [ref=e1092]: Elf
          - generic [ref=e1095]:
            - generic [ref=e1097]: Aragorn II
            - generic [ref=e1098]: Man
          - generic [ref=e1101]:
            - generic [ref=e1103]: Arwen
            - generic [ref=e1104]: Half-elf
          - generic [ref=e1105] [cursor=pointer]:
            - generic [ref=e1108]: Éomund
            - generic [ref=e1109]: Man • House of Eorl
          - generic [ref=e1111] [cursor=pointer]:
            - generic [ref=e1114]: Beleg Cúthalion
            - generic [ref=e1115]: Elf • Sindar
          - generic [ref=e1117] [cursor=pointer]:
            - generic [ref=e1120]: Haleth
            - generic [ref=e1121]: Man • House of Haleth
          - generic [ref=e1123] [cursor=pointer]:
            - generic [ref=e1126]: Tar-Minastir
            - generic [ref=e1127]: Man • Dunedain
          - generic [ref=e1129] [cursor=pointer]:
            - generic [ref=e1132]: Ar-Adûnakhôr
            - generic [ref=e1133]: Man • Dunedain
          - generic [ref=e1135] [cursor=pointer]:
            - generic [ref=e1138]: Amandil
            - generic [ref=e1139]: Man • Dunedain
          - generic [ref=e1141] [cursor=pointer]:
            - generic [ref=e1144]: Tar-Calmacil
            - generic [ref=e1145]: Man • Dunedain
          - generic [ref=e1147] [cursor=pointer]:
            - generic [ref=e1150]: Tarondor
            - generic [ref=e1151]: Man • Dunedain
          - generic [ref=e1153] [cursor=pointer]:
            - generic [ref=e1156]: Elenwë
            - generic [ref=e1157]: Elf • Vanyar
          - generic [ref=e1159] [cursor=pointer]:
            - generic [ref=e1162]: Haleth
            - generic [ref=e1163]: Man • House of Eorl
          - generic [ref=e1165] [cursor=pointer]:
            - generic [ref=e1168]: Celeborn
            - generic [ref=e1169]: Elf • Teleri
          - generic [ref=e1171] [cursor=pointer]:
            - generic [ref=e1174]: Galadhon
            - generic [ref=e1175]: Elf • Teleri
          - generic [ref=e1177] [cursor=pointer]:
            - generic [ref=e1180]: Ar-Pharazôn
            - generic [ref=e1181]: Man • Dunedain
          - generic [ref=e1183] [cursor=pointer]:
            - generic [ref=e1186]: Haldir
            - generic [ref=e1187]: Man • House of Haleth
          - generic [ref=e1189] [cursor=pointer]:
            - generic [ref=e1192]: Tar-Telemmaitë
            - generic [ref=e1193]: Man • Dunedain
          - generic [ref=e1195] [cursor=pointer]:
            - generic [ref=e1198]: Elrohir
            - generic [ref=e1199]: Half-elf • no house
          - generic [ref=e1201] [cursor=pointer]:
            - generic [ref=e1204]: Tar-Palantir
            - generic [ref=e1205]: Man • Dunedain
          - generic [ref=e1207] [cursor=pointer]:
            - generic [ref=e1210]: Elwë (Thingol)
            - generic [ref=e1211]: Elf • Teleri
          - generic [ref=e1213] [cursor=pointer]:
            - generic [ref=e1216]: Walda
            - generic [ref=e1217]: Man • House of Eorl
          - generic [ref=e1219] [cursor=pointer]:
            - generic [ref=e1222]: Melian
            - generic [ref=e1223]: Maia • Teleri
          - generic [ref=e1225] [cursor=pointer]:
            - generic [ref=e1228]: Araval
            - generic [ref=e1229]: Man • Dunedain
          - generic [ref=e1231] [cursor=pointer]:
            - generic [ref=e1234]: Tar-Elendil
            - generic [ref=e1235]: Man • Dunedain
          - generic [ref=e1237] [cursor=pointer]:
            - generic [ref=e1240]: Ar-Sakalthôr
            - generic [ref=e1241]: Man • Dunedain
          - generic [ref=e1243] [cursor=pointer]:
            - generic [ref=e1246]: Mablung
            - generic [ref=e1247]: Elf • Sindar
          - generic [ref=e1249] [cursor=pointer]:
            - generic [ref=e1252]: Fréawine
            - generic [ref=e1253]: Man • House of Eorl
          - generic [ref=e1255] [cursor=pointer]:
            - generic [ref=e1258]: Déor
            - generic [ref=e1259]: Man • House of Eorl
          - generic [ref=e1261] [cursor=pointer]:
            - generic [ref=e1264]: Tuor
            - generic [ref=e1265]: Man • House of Hador
          - generic [ref=e1267] [cursor=pointer]:
            - generic [ref=e1270]: Elatan
            - generic [ref=e1271]: Man • Dunedain
          - generic [ref=e1273] [cursor=pointer]:
            - generic [ref=e1276]: Tar-Telperiën
            - generic [ref=e1277]: Man • Dunedain
          - generic [ref=e1279] [cursor=pointer]:
            - generic [ref=e1282]: Thengel
            - generic [ref=e1283]: Man • House of Eorl
          - generic [ref=e1285] [cursor=pointer]:
            - generic [ref=e1288]: Eärendil
            - generic [ref=e1289]: Half-elf • House of Hador
          - generic [ref=e1291] [cursor=pointer]:
            - generic [ref=e1294]: Idril
            - generic [ref=e1295]: Elf • Noldor
          - generic [ref=e1297] [cursor=pointer]:
            - generic [ref=e1300]: Brego
            - generic [ref=e1301]: Man • House of Eorl
          - generic [ref=e1303] [cursor=pointer]:
            - generic [ref=e1306]: Arathorn II
            - generic [ref=e1307]: Man • Dunedain
          - generic [ref=e1309] [cursor=pointer]:
            - generic [ref=e1312]: Gilraen
            - generic [ref=e1313]: Man • Dunedain
          - generic [ref=e1315] [cursor=pointer]:
            - generic [ref=e1318]: Aragorn II
            - generic [ref=e1319]: Man • Dunedain
          - generic [ref=e1321] [cursor=pointer]:
            - generic [ref=e1324]: Arwen
            - generic [ref=e1325]: Half-elf • Dunedain
          - generic [ref=e1327] [cursor=pointer]:
            - generic [ref=e1330]: Eldarion
            - generic [ref=e1331]: Man • Dunedain
          - generic [ref=e1333] [cursor=pointer]:
            - generic [ref=e1336]: Elrond
            - generic [ref=e1337]: Half-elf • Dunedain
          - generic [ref=e1339] [cursor=pointer]:
            - generic [ref=e1342]: Hador
            - generic [ref=e1343]: Man • House of Hador
          - generic [ref=e1345] [cursor=pointer]:
            - generic [ref=e1348]: Gidlis
            - generic [ref=e1349]: Man • no house
          - generic [ref=e1351] [cursor=pointer]:
            - generic [ref=e1354]: Galdor
            - generic [ref=e1355]: Man • House of Hador
          - generic [ref=e1357] [cursor=pointer]:
            - generic [ref=e1360]: Hareth
            - generic [ref=e1361]: Man • House of Haleth
          - generic [ref=e1363] [cursor=pointer]:
            - generic [ref=e1366]: Haldar
            - generic [ref=e1367]: Man • House of Haleth
          - generic [ref=e1369] [cursor=pointer]:
            - generic [ref=e1372]: Haldan
            - generic [ref=e1373]: Man • House of Haleth
          - generic [ref=e1375] [cursor=pointer]:
            - generic [ref=e1378]: Halmir
            - generic [ref=e1379]: Man • House of Haleth
          - generic [ref=e1381] [cursor=pointer]:
            - generic [ref=e1384]: Hurin
            - generic [ref=e1385]: Man • House of Hador
          - generic [ref=e1387] [cursor=pointer]:
            - generic [ref=e1390]: Beor
            - generic [ref=e1391]: Man • House of Bëor
          - generic [ref=e1393] [cursor=pointer]:
            - generic [ref=e1396]: Baran
            - generic [ref=e1397]: Man • House of Bëor
          - generic [ref=e1399] [cursor=pointer]:
            - generic [ref=e1402]: Boron
            - generic [ref=e1403]: Man • House of Bëor
          - generic [ref=e1405] [cursor=pointer]:
            - generic [ref=e1408]: Beren (the Elder)
            - generic [ref=e1409]: Man • House of Bëor
          - generic [ref=e1411] [cursor=pointer]:
            - generic [ref=e1414]: Bregor
            - generic [ref=e1415]: Man • House of Bëor
          - generic [ref=e1417] [cursor=pointer]:
            - generic [ref=e1420]: Barahir
            - generic [ref=e1421]: Man • House of Bëor
          - generic [ref=e1423] [cursor=pointer]:
            - generic [ref=e1426]: Emeldir
            - generic [ref=e1427]: Man • House of Bëor
          - generic [ref=e1429] [cursor=pointer]:
            - generic [ref=e1432]: Bregolas
            - generic [ref=e1433]: Man • House of Bëor
          - generic [ref=e1435] [cursor=pointer]:
            - generic [ref=e1438]: Baragund
            - generic [ref=e1439]: Man • House of Bëor
          - generic [ref=e1441] [cursor=pointer]:
            - generic [ref=e1444]: Belegund
            - generic [ref=e1445]: Man • House of Bëor
          - generic [ref=e1447] [cursor=pointer]:
            - generic [ref=e1450]: Belemir
            - generic [ref=e1451]: Man • House of Bëor
          - generic [ref=e1453] [cursor=pointer]:
            - generic [ref=e1456]: Beren
            - generic [ref=e1457]: Man • House of Bëor
          - generic [ref=e1459] [cursor=pointer]:
            - generic [ref=e1462]: Belen
            - generic [ref=e1463]: Man • House of Bëor
          - generic [ref=e1465] [cursor=pointer]:
            - generic [ref=e1468]: Beldir
            - generic [ref=e1469]: Man • House of Bëor
          - generic [ref=e1471] [cursor=pointer]:
            - generic [ref=e1474]: Tar-Anárion
            - generic [ref=e1475]: Man • Dunedain
          - generic [ref=e1477] [cursor=pointer]:
            - generic [ref=e1480]: Hundar
            - generic [ref=e1481]: Man • House of Haleth
          - generic [ref=e1483] [cursor=pointer]:
            - generic [ref=e1486]: Númendil
            - generic [ref=e1487]: Man • Dunedain
          - generic [ref=e1488] [cursor=pointer]:
            - generic [ref=e1491]: Huor
            - generic [ref=e1492]: Man • House of Hador
          - generic [ref=e1494] [cursor=pointer]:
            - generic [ref=e1497]: Arantar
            - generic [ref=e1498]: Man • Dunedain
          - generic [ref=e1500] [cursor=pointer]:
            - generic [ref=e1503]: Éorl the Young
            - generic [ref=e1504]: Man • House of Eorl
          - generic [ref=e1506] [cursor=pointer]:
            - generic [ref=e1509]: Argonui
            - generic [ref=e1510]: Man • Dunedain
          - generic [ref=e1512] [cursor=pointer]:
            - generic [ref=e1515]: Aldor
            - generic [ref=e1516]: Man • House of Eorl
          - generic [ref=e1518] [cursor=pointer]:
            - generic [ref=e1521]: Brytta
            - generic [ref=e1522]: Man • House of Eorl
          - generic [ref=e1524] [cursor=pointer]:
            - generic [ref=e1527]: Elwing
            - generic [ref=e1528]: Half-elf • Teleri
          - generic [ref=e1530] [cursor=pointer]:
            - generic [ref=e1533]: Tar-Ciryatan
            - generic [ref=e1534]: Man • Dunedain
          - generic [ref=e1536] [cursor=pointer]:
            - generic [ref=e1539]: Rían
            - generic [ref=e1540]: Man • House of Bëor
          - generic [ref=e1542] [cursor=pointer]:
            - generic [ref=e1545]: Tar-Vanimeldë
            - generic [ref=e1546]: Man • Dunedain
          - generic [ref=e1548] [cursor=pointer]:
            - generic [ref=e1551]: Tar-Alcarin
            - generic [ref=e1552]: Man • Dunedain
          - generic [ref=e1554] [cursor=pointer]:
            - generic [ref=e1557]: Haldad
            - generic [ref=e1558]: Man • House of Haleth
          - generic [ref=e1560] [cursor=pointer]:
            - generic [ref=e1563]: Tar-Atanamir
            - generic [ref=e1564]: Man • Dunedain
          - generic [ref=e1566] [cursor=pointer]:
            - generic [ref=e1569]: Nimloth
            - generic [ref=e1570]: Elf • Teleri
          - generic [ref=e1572] [cursor=pointer]:
            - generic [ref=e1575]: Tar-Súrion
            - generic [ref=e1576]: Man • Dunedain
          - generic [ref=e1578] [cursor=pointer]:
            - generic [ref=e1581]: Hiril
            - generic [ref=e1582]: Man • House of Haleth
          - generic [ref=e1584] [cursor=pointer]:
            - generic [ref=e1587]: Tar-Ancalimë
            - generic [ref=e1588]: Man • Dunedain
          - generic [ref=e1590] [cursor=pointer]:
            - generic [ref=e1593]: Malvegil
            - generic [ref=e1594]: Man • Dunedain
          - generic [ref=e1596] [cursor=pointer]:
            - generic [ref=e1599]: Tar-Ancalimon
            - generic [ref=e1600]: Man • Dunedain
          - generic [ref=e1602] [cursor=pointer]:
            - generic [ref=e1605]: Arveleg II
            - generic [ref=e1606]: Man • Dunedain
          - generic [ref=e1608] [cursor=pointer]:
            - generic [ref=e1611]: Valandil
            - generic [ref=e1612]: Man • Dunedain
          - generic [ref=e1614] [cursor=pointer]:
            - generic [ref=e1617]: Beleg
            - generic [ref=e1618]: Man • Dunedain
          - generic [ref=e1620] [cursor=pointer]:
            - generic [ref=e1623]: Argeleb I
            - generic [ref=e1624]: Man • Dunedain
          - generic [ref=e1626] [cursor=pointer]:
            - generic [ref=e1629]: Celebrimbor
            - generic [ref=e1630]: Elf • Noldor
          - generic [ref=e1632] [cursor=pointer]:
            - generic [ref=e1635]: Mallor
            - generic [ref=e1636]: Man • Dunedain
          - generic [ref=e1638] [cursor=pointer]:
            - generic [ref=e1641]: Tar-Meneldur
            - generic [ref=e1642]: Man • Dunedain
          - generic [ref=e1644] [cursor=pointer]:
            - generic [ref=e1647]: Elros
            - generic [ref=e1648]: Half-elf • Dunedain
          - generic [ref=e1650] [cursor=pointer]:
            - generic [ref=e1653]: Círdan
            - generic [ref=e1654]: Elf • Teleri
          - generic [ref=e1656] [cursor=pointer]:
            - generic [ref=e1659]: Arathorn I
            - generic [ref=e1660]: Man • Dunedain
          - generic [ref=e1662] [cursor=pointer]:
            - generic [ref=e1665]: Elmo
            - generic [ref=e1666]: Elf • Teleri
          - generic [ref=e1668] [cursor=pointer]:
            - generic [ref=e1671]: Eärendur
            - generic [ref=e1672]: Man • Dunedain
          - generic [ref=e1673] [cursor=pointer]:
            - generic [ref=e1676]: Númendil (Lord of Andúnie)
            - generic [ref=e1677]: Man • Dunedain
          - generic [ref=e1678] [cursor=pointer]:
            - generic [ref=e1681]: Arveleg I
            - generic [ref=e1682]: Man • Dunedain
          - generic [ref=e1684] [cursor=pointer]:
            - generic [ref=e1687]: Araphant
            - generic [ref=e1688]: Man • Dunedain
          - generic [ref=e1690] [cursor=pointer]:
            - generic [ref=e1693]: Éomer
            - generic [ref=e1694]: Man • House of Eorl
          - generic [ref=e1696] [cursor=pointer]:
            - generic [ref=e1699]: Ar-Gimilzôr
            - generic [ref=e1700]: Man • Dunedain
          - generic [ref=e1702] [cursor=pointer]:
            - generic [ref=e1705]: Galathil
            - generic [ref=e1706]: Elf • Teleri
          - generic [ref=e1708] [cursor=pointer]:
            - generic [ref=e1711]: Tarcil
            - generic [ref=e1712]: Man • Dunedain
          - generic [ref=e1714] [cursor=pointer]:
            - generic [ref=e1717]: Hama
            - generic [ref=e1718]: Man • House of Eorl
          - generic [ref=e1720] [cursor=pointer]:
            - generic [ref=e1723]: Elfwine the Fair
            - generic [ref=e1724]: Man • House of Eorl
          - generic [ref=e1726] [cursor=pointer]:
            - generic [ref=e1729]: Finwë
            - generic [ref=e1730]: Elf • Noldor
          - generic [ref=e1732] [cursor=pointer]:
            - generic [ref=e1735]: Míriel
            - generic [ref=e1736]: Elf • Noldor
          - generic [ref=e1738] [cursor=pointer]:
            - generic [ref=e1741]: Nerdanel
            - generic [ref=e1742]: Elf • Noldor
          - generic [ref=e1744] [cursor=pointer]:
            - generic [ref=e1747]: Amlaith
            - generic [ref=e1748]: Man • Dunedain
          - generic [ref=e1750] [cursor=pointer]:
            - generic [ref=e1753]: Beren Erchamion
            - generic [ref=e1754]: Man • House of Bëor
          - generic [ref=e1756] [cursor=pointer]:
            - generic [ref=e1759]: Folca
            - generic [ref=e1760]: Man • House of Eorl
          - generic [ref=e1762] [cursor=pointer]:
            - generic [ref=e1765]: Ar-Zimrathôn
            - generic [ref=e1766]: Man • Dunedain
          - generic [ref=e1768] [cursor=pointer]:
            - generic [ref=e1771]: Valandur
            - generic [ref=e1772]: Man • Dunedain
          - generic [ref=e1774] [cursor=pointer]:
            - generic [ref=e1777]: Fingolfin
            - generic [ref=e1778]: Elf • Noldor
          - generic [ref=e1780] [cursor=pointer]:
            - generic [ref=e1783]: Finarfin
            - generic [ref=e1784]: Elf • Noldor
          - generic [ref=e1786] [cursor=pointer]:
            - generic [ref=e1789]: Eärendur (Lord of Andúnie)
            - generic [ref=e1790]: Man • Dunedain
          - generic [ref=e1791] [cursor=pointer]:
            - generic [ref=e1794]: Fréaláf Hildeson
            - generic [ref=e1795]: Man • House of Eorl
          - generic [ref=e1797] [cursor=pointer]:
            - generic [ref=e1800]: Folcwine
            - generic [ref=e1801]: Man • House of Eorl
          - generic [ref=e1803] [cursor=pointer]:
            - generic [ref=e1806]: Morwen
            - generic [ref=e1807]: Man • House of Bëor
          - generic [ref=e1809] [cursor=pointer]:
            - generic [ref=e1812]: Turin
            - generic [ref=e1813]: Man • House of Hador
          - generic [ref=e1815] [cursor=pointer]:
            - generic [ref=e1818]: Nienor
            - generic [ref=e1819]: Man • House of Hador
          - generic [ref=e1821] [cursor=pointer]:
            - generic [ref=e1824]: Arvegil
            - generic [ref=e1825]: Man • Dunedain
          - generic [ref=e1827] [cursor=pointer]:
            - generic [ref=e1830]: Daeron
            - generic [ref=e1831]: Elf • Sindar
          - generic [ref=e1833] [cursor=pointer]:
            - generic [ref=e1836]: Goldwine
            - generic [ref=e1837]: Man • House of Eorl
          - generic [ref=e1839] [cursor=pointer]:
            - generic [ref=e1842]: Fingon
            - generic [ref=e1843]: Elf • Noldor
          - generic [ref=e1845] [cursor=pointer]:
            - generic [ref=e1848]: Turgon
            - generic [ref=e1849]: Elf • Noldor
          - generic [ref=e1851] [cursor=pointer]:
            - generic [ref=e1854]: Aredhel
            - generic [ref=e1855]: Elf • Noldor
          - generic [ref=e1857] [cursor=pointer]:
            - generic [ref=e1860]: Elladan
            - generic [ref=e1861]: Half-elf • no house
          - generic [ref=e1863] [cursor=pointer]:
            - generic [ref=e1866]: Hild
            - generic [ref=e1867]: Man • House of Eorl
          - generic [ref=e1869] [cursor=pointer]:
            - generic [ref=e1872]: Argeleb II
            - generic [ref=e1873]: Man • Dunedain
          - generic [ref=e1875] [cursor=pointer]:
            - generic [ref=e1878]: Arador
            - generic [ref=e1879]: Man • Dunedain
          - generic [ref=e1881] [cursor=pointer]:
            - generic [ref=e1884]: Valandil (Lord of Andúnie)
            - generic [ref=e1885]: Man • Dunedain
          - generic [ref=e1887] [cursor=pointer]:
            - generic [ref=e1890]: Vardamë Nólimon
            - generic [ref=e1891]: Half-elf • no house
          - generic [ref=e1893] [cursor=pointer]:
            - generic [ref=e1896]: Finrod Felagund
            - generic [ref=e1897]: Elf • Noldor
          - generic [ref=e1899] [cursor=pointer]:
            - generic [ref=e1902]: Angrod
            - generic [ref=e1903]: Elf • Noldor
          - generic [ref=e1905] [cursor=pointer]:
            - generic [ref=e1908]: Aegnor
            - generic [ref=e1909]: Elf • Noldor
          - generic [ref=e1911] [cursor=pointer]:
            - generic [ref=e1914]: Galadriel
            - generic [ref=e1915]: Elf • Noldor
          - generic [ref=e1917] [cursor=pointer]:
            - generic [ref=e1920]: Théodred
            - generic [ref=e1921]: Man • House of Eorl
          - generic [ref=e1923] [cursor=pointer]:
            - generic [ref=e1926]: Théoden
            - generic [ref=e1927]: Man • House of Eorl
          - generic [ref=e1929] [cursor=pointer]:
            - generic [ref=e1932]: Silmariën
            - generic [ref=e1933]: Man • Dunedain
          - generic [ref=e1935] [cursor=pointer]:
            - generic [ref=e1938]: Fréa
            - generic [ref=e1939]: Man • House of Eorl
          - generic [ref=e1941] [cursor=pointer]:
            - generic [ref=e1944]: Celebrendil
            - generic [ref=e1945]: Man • Dunedain
          - generic [ref=e1947] [cursor=pointer]:
            - generic [ref=e1950]: Tar-Amandil
            - generic [ref=e1951]: Man • Dunedain
          - generic [ref=e1953] [cursor=pointer]:
            - generic [ref=e1956]: Maedhros
            - generic [ref=e1957]: Elf • Noldor
          - generic [ref=e1959] [cursor=pointer]:
            - generic [ref=e1962]: Maglor
            - generic [ref=e1963]: Elf • Noldor
          - generic [ref=e1965] [cursor=pointer]:
            - generic [ref=e1968]: Celegorm
            - generic [ref=e1969]: Elf • Noldor
          - generic [ref=e1971] [cursor=pointer]:
            - generic [ref=e1974]: Caranthir
            - generic [ref=e1975]: Elf • Noldor
          - generic [ref=e1977] [cursor=pointer]:
            - generic [ref=e1980]: Curufin
            - generic [ref=e1981]: Elf • Noldor
          - generic [ref=e1983] [cursor=pointer]:
            - generic [ref=e1986]: Amrod
            - generic [ref=e1987]: Elf • Noldor
          - generic [ref=e1989] [cursor=pointer]:
            - generic [ref=e1992]: Amras
            - generic [ref=e1993]: Elf • Noldor
          - generic [ref=e1995] [cursor=pointer]:
            - generic [ref=e1998]: Tar-Aldarion
            - generic [ref=e1999]: Man • Dunedain
          - generic [ref=e2001] [cursor=pointer]:
            - generic [ref=e2004]: Araphor
            - generic [ref=e2005]: Man • Dunedain
          - generic [ref=e2007] [cursor=pointer]:
            - generic [ref=e2010]: Luthien
            - generic [ref=e2011]: Half-elf • Teleri
          - generic [ref=e2013] [cursor=pointer]:
            - generic [ref=e2016]: Argon
            - generic [ref=e2017]: Elf • Noldor
          - generic [ref=e2019] [cursor=pointer]:
            - generic [ref=e2022]: Fengel
            - generic [ref=e2023]: Man • House of Eorl
          - generic [ref=e2025] [cursor=pointer]:
            - generic [ref=e2028]: Gram
            - generic [ref=e2029]: Man • House of Eorl
          - generic [ref=e2031] [cursor=pointer]:
            - generic [ref=e2034]: Eöl
            - generic [ref=e2035]: Elf • Dark Elf
          - generic [ref=e2037] [cursor=pointer]:
            - generic [ref=e2040]: Helm Hammerhand
            - generic [ref=e2041]: Man • House of Eorl
          - generic [ref=e2043] [cursor=pointer]:
            - generic [ref=e2046]: Fëanor
            - generic [ref=e2047]: Elf • Noldor
          - generic [ref=e2049] [cursor=pointer]:
            - generic [ref=e2052]: Eldacar
            - generic [ref=e2053]: Man • Dunedain
          - generic [ref=e2055] [cursor=pointer]:
            - generic [ref=e2058]: Elendil
            - generic [ref=e2059]: Man • Dunedain
          - generic [ref=e2061] [cursor=pointer]:
            - generic [ref=e2064]: Enel
            - generic [ref=e2065]: Elf • Nelyar
          - generic [ref=e2067] [cursor=pointer]:
            - generic [ref=e2070]: Enelyë
            - generic [ref=e2071]: Elf • Nelyar
          - generic [ref=e2073] [cursor=pointer]:
            - generic [ref=e2076]: Olwë
            - generic [ref=e2077]: Elf • Teleri
          - generic [ref=e2079] [cursor=pointer]:
            - generic [ref=e2082]: Eärwen
            - generic [ref=e2083]: Elf • Teleri
          - generic [ref=e2085] [cursor=pointer]:
            - generic [ref=e2088]: Celepharn
            - generic [ref=e2089]: Man • Dunedain
          - generic [ref=e2091] [cursor=pointer]:
            - generic [ref=e2094]: Celebrian
            - generic [ref=e2095]: Elf • Noldor
          - generic [ref=e2097] [cursor=pointer]:
            - generic [ref=e2100]: Dior
            - generic [ref=e2101]: Half-elf • House of Bëor
          - generic [ref=e2103] [cursor=pointer]:
            - generic [ref=e2106]: Eärendur
            - generic [ref=e2107]: Man • Dunedain
          - generic [ref=e2109] [cursor=pointer]:
            - generic [ref=e2112]: Maeglin
            - generic [ref=e2113]: Elf • Noldor
          - generic [ref=e2115] [cursor=pointer]:
            - generic [ref=e2118]: Imin
            - generic [ref=e2119]: Elf • Minyar
          - generic [ref=e2121] [cursor=pointer]:
            - generic [ref=e2124]: Iminyë
            - generic [ref=e2125]: Elf • Minyar
          - generic [ref=e2127] [cursor=pointer]:
            - generic [ref=e2130]: Ingwë
            - generic [ref=e2131]: Elf • Minyar
          - generic [ref=e2133] [cursor=pointer]:
            - generic [ref=e2136]: Ilwen
            - generic [ref=e2137]: Elf • Minyar
          - generic [ref=e2139] [cursor=pointer]:
            - generic [ref=e2142]: Ingwion
            - generic [ref=e2143]: Elf • Minyar
          - generic [ref=e2145] [cursor=pointer]:
            - generic [ref=e2148]: Tata
            - generic [ref=e2149]: Elf • Tatyar
          - generic [ref=e2151] [cursor=pointer]:
            - generic [ref=e2154]: Tatië
            - generic [ref=e2155]: Elf • Tatyar
          - generic [ref=e2157] [cursor=pointer]:
            - generic [ref=e2160]: Maidros
            - generic [ref=e2161]: Elf • Tatyar
          - generic [ref=e2163] [cursor=pointer]:
            - generic [ref=e2166]: Nurwe
            - generic [ref=e2167]: Elf • Tatyar
          - generic [ref=e2169] [cursor=pointer]:
            - generic [ref=e2172]: Indis
            - generic [ref=e2173]: Elf • Minyar
          - generic [ref=e2175] [cursor=pointer]:
            - generic [ref=e2178]: Findis
            - generic [ref=e2179]: Elf • Noldor
          - generic [ref=e2181] [cursor=pointer]:
            - generic [ref=e2184]: Lalwen
            - generic [ref=e2185]: Elf • Noldor
        - generic [ref=e2187]:
          - generic [ref=e2188]:
            - heading "Legend" [level=3] [ref=e2189]
            - button "Min" [ref=e2190] [cursor=pointer]
          - generic [ref=e2191]:
            - paragraph [ref=e2192]: Person node
            - paragraph [ref=e2194]: Biological parent edge
            - paragraph [ref=e2196]: Social overlay edge
            - paragraph [ref=e2198]: Warning marker
            - paragraph [ref=e2200]: Source available
            - paragraph [ref=e2202]: Selected or focused
    - separator [ref=e2204]
    - complementary [ref=e2207]:
      - generic [ref=e2208]:
        - generic [ref=e2209]:
          - paragraph [ref=e2210]: Secondary Panel
          - heading "Global Statistics" [level=2] [ref=e2211]
        - generic [ref=e2212]: ok
      - generic [ref=e2213]:
        - article [ref=e2214]:
          - generic [ref=e2215]: Persons
          - strong [ref=e2216]: "181"
        - article [ref=e2217]:
          - generic [ref=e2218]: Connections
          - strong [ref=e2219]: "191"
        - article [ref=e2220]:
          - generic [ref=e2221]: Warnings
          - strong [ref=e2222]: "0"
        - article [ref=e2223]:
          - generic [ref=e2224]: Components
          - strong [ref=e2225]: "12"
      - generic [ref=e2226]:
        - generic [ref=e2227]:
          - heading "Dataset" [level=3] [ref=e2228]
          - generic [ref=e2229]: demo
        - generic [ref=e2230]:
          - generic [ref=e2231]: Scenario source
          - combobox "Demo" [ref=e2232]
        - paragraph [ref=e2233]: Persistence is global across datasets, as agreed for v1.
      - generic [ref=e2234]:
        - generic [ref=e2235]:
          - heading "Workspace State" [level=3] [ref=e2236]
          - generic [ref=e2237]: light / light
        - list [ref=e2238]:
          - listitem [ref=e2239]: Default canvas width
          - listitem [ref=e2240]: No active filters
          - listitem [ref=e2241]: 0 selected persons
        - button "Reset settings" [ref=e2242] [cursor=pointer]
      - generic [ref=e2247]:
        - generic [ref=e2248]:
          - heading "Debug" [level=3] [ref=e2249]
          - generic [ref=e2250]: modeR3B
        - generic [ref=e2251]:
          - checkbox "Show debug overlays in tree and PNG export" [ref=e2252]
          - generic [ref=e2253]: Show debug overlays in tree and PNG export
        - generic [ref=e2254]:
          - paragraph [ref=e2255]:
            - strong [ref=e2256]: "Mode R3B: Structured Raster Engine v2"
          - paragraph [ref=e2257]: Dedicated branch for the next structured raster tree core with isolated R3B wiring.
        - generic [ref=e2258]:
          - heading "Strategy summary" [level=4] [ref=e2259]
          - list [ref=e2260]:
            - listitem [ref=e2261]: "Layout: enhanced"
            - listitem [ref=e2262]: "House anchors: legacy"
            - listitem [ref=e2263]: "Spouse projection: on"
            - listitem [ref=e2264]: "Marriage overlay: rigid"
            - listitem [ref=e2265]: "Curated person order: off"
            - listitem [ref=e2266]: "Curated person offsets: off"
            - listitem [ref=e2267]: "Layout component spacing: 96px"
            - listitem [ref=e2268]: "Layout X scale: 1.00x"
            - listitem [ref=e2269]: "Layout Y scale: 1.00x"
            - listitem [ref=e2270]: "House subtree offsets: on"
            - listitem [ref=e2271]: "House subtree vertical yOffset: off"
            - listitem [ref=e2272]: "House anchor yOffset: on (192px per unit, generation)"
            - listitem [ref=e2273]: "House anchor vertical alignment: global-top-row"
            - listitem [ref=e2274]: "Anchor centering: strict founder-centered"
            - listitem [ref=e2275]: "House order X resolution: off"
            - listitem [ref=e2276]: "Horizontal de-overlap: off"
            - listitem [ref=e2277]: "Disconnected component packing: off"
            - listitem [ref=e2278]: "FollowRulerLine: off"
            - listitem [ref=e2279]: "R3 artifacts present: yes"
            - listitem [ref=e2280]: "R3 family placements: 115"
            - listitem [ref=e2281]: "R3 house anchor placements: 7"
        - generic [ref=e2282]:
          - heading "Active stages" [level=4] [ref=e2283]
          - list [ref=e2284]:
            - listitem [ref=e2285]: validate-dataset
            - listitem [ref=e2286]: base-layout
            - listitem [ref=e2287]: marriage-pair-alignment
            - listitem [ref=e2288]: house-anchor-placement
            - listitem [ref=e2289]: render-tree-preparation
        - generic [ref=e2290]:
          - heading "House anchors" [level=4] [ref=e2291]
          - generic [ref=e2292]:
            - article [ref=e2293]:
              - generic [ref=e2294]:
                - heading "Minyar and Vanyar line" [level=4] [ref=e2295]
                - generic [ref=e2296]: 2 roots
              - paragraph [ref=e2297]: "Ideal / placed / drift: 238 / 238 / 0"
              - paragraph [ref=e2298]: "Reserved span / cluster width: 396 / 396"
              - paragraph [ref=e2299]: "House yOffset: 0"
              - paragraph [ref=e2300]: "Root nodes: Imin, Iminyë"
            - article [ref=e2301]:
              - generic [ref=e2302]:
                - heading "Tatyar and Noldor line" [level=4] [ref=e2303]
                - generic [ref=e2304]: 2 roots
              - paragraph [ref=e2305]: "Ideal / placed / drift: 2788 / 2788 / 0"
              - paragraph [ref=e2306]: "Reserved span / cluster width: 396 / 396"
              - paragraph [ref=e2307]: "House yOffset: 0"
              - paragraph [ref=e2308]: "Root nodes: Tata, Tatië"
            - article [ref=e2309]:
              - generic [ref=e2310]:
                - heading "Nelyar and Teleri line" [level=4] [ref=e2311]
                - generic [ref=e2312]: 2 roots
              - paragraph [ref=e2313]: "Ideal / placed / drift: 5025 / 5025 / 0"
              - paragraph [ref=e2314]: "Reserved span / cluster width: 396 / 396"
              - paragraph [ref=e2315]: "House yOffset: 0"
              - paragraph [ref=e2316]: "Root nodes: Enel, Enelyë"
            - article [ref=e2317]:
              - generic [ref=e2318]:
                - heading "House of Beor" [level=4] [ref=e2319]
                - generic [ref=e2320]: 1 roots
              - paragraph [ref=e2321]: "Ideal / placed / drift: 7113 / 7113 / 0"
              - paragraph [ref=e2322]: "Reserved span / cluster width: 176 / 176"
              - paragraph [ref=e2323]: "House yOffset: 1920"
              - paragraph [ref=e2324]: "Root nodes: Beor"
            - article [ref=e2325]:
              - generic [ref=e2326]:
                - heading "House of Hador" [level=4] [ref=e2327]
                - generic [ref=e2328]: 1 roots
              - paragraph [ref=e2329]: "Ideal / placed / drift: 8870 / 8870 / 0"
              - paragraph [ref=e2330]: "Reserved span / cluster width: 176 / 176"
              - paragraph [ref=e2331]: "House yOffset: 1920"
              - paragraph [ref=e2332]: "Root nodes: Hador"
            - article [ref=e2333]:
              - generic [ref=e2334]:
                - heading "House of Haleth" [level=4] [ref=e2335]
                - generic [ref=e2336]: 1 roots
              - paragraph [ref=e2337]: "Ideal / placed / drift: 10168 / 10168 / 0"
              - paragraph [ref=e2338]: "Reserved span / cluster width: 176 / 176"
              - paragraph [ref=e2339]: "House yOffset: 1920"
              - paragraph [ref=e2340]: "Root nodes: Haldad"
            - article [ref=e2341]:
              - generic [ref=e2342]:
                - heading "House of Eorl" [level=4] [ref=e2343]
                - generic [ref=e2344]: 2 roots
              - paragraph [ref=e2345]: "Ideal / placed / drift: 11931 / 11931 / 0"
              - paragraph [ref=e2346]: "Reserved span / cluster width: 1045 / 1045"
              - paragraph [ref=e2347]: "House yOffset: 4800"
              - paragraph [ref=e2348]: "Root nodes: Éomund, Éorl the Young"
        - generic [ref=e2349]:
          - heading "Applied offsets" [level=4] [ref=e2350]
          - paragraph [ref=e2351]: "House offsets: House of Beor (10), House of Hador (10), House of Haleth (10), House of Eorl (25)"
          - paragraph [ref=e2352]: "Person offsets: none"
      - generic [ref=e2353]:
        - generic [ref=e2354]:
          - heading "Warnings" [level=3] [ref=e2355]
          - generic [ref=e2356]: "0"
        - paragraph [ref=e2358]: No data warnings in this dataset slice.
```

# Test source

```ts
  730 |         mainNodes,
  731 |       }
  732 |     })
  733 | 
  734 |     expect(geometry.aredhel).not.toBeNull()
  735 |     expect(geometry.finrod).not.toBeNull()
  736 |     expect(geometry.earwen).not.toBeNull()
  737 |     expect(geometry.luthien).not.toBeNull()
  738 |     expect(geometry.finarfinProjections).not.toEqual([])
  739 |     expect(geometry.berenProjections).not.toEqual([])
  740 | 
  741 |     const aredhel = geometry.aredhel as { x: number; width: number }
  742 |     const finrod = geometry.finrod as { x: number }
  743 |     expect(finrod.x - (aredhel.x + aredhel.width)).toBeLessThan(900)
  744 | 
  745 |     const overlaps = (left: { x: number; y: number; width: number; height: number }, right: { x: number; y: number; width: number; height: number }) => {
  746 |       return left.x < right.x + right.width
  747 |         && right.x < left.x + left.width
  748 |         && left.y < right.y + right.height
  749 |         && right.y < left.y + left.height
  750 |     }
  751 |     const busyProjections = [
  752 |       ...(geometry.finarfinProjections as Array<{ x: number; y: number; width: number; height: number }>),
  753 |       ...(geometry.berenProjections as Array<{ x: number; y: number; width: number; height: number }>),
  754 |     ]
  755 | 
  756 |     for (const projection of busyProjections) {
  757 |       expect(geometry.mainNodes.some((node) => overlaps(projection, node))).toBe(false)
  758 |     }
  759 | 
  760 |     const earwen = geometry.earwen as { x: number; y: number; width: number; height: number }
  761 |     const finarfinProjection = (geometry.finarfinProjections as Array<{ x: number; y: number; width: number; height: number }>)
  762 |       .sort((left, right) => Math.abs(left.y - (geometry.earwen as { y: number }).y) - Math.abs(right.y - (geometry.earwen as { y: number }).y))[0]
  763 |     expect(finarfinProjection).toBeDefined()
  764 |     expect(Math.abs(finarfinProjection.y - earwen.y)).toBeLessThan(earwen.height * 3)
  765 |     expect(overlaps(finarfinProjection, geometry.luthien as { x: number; y: number; width: number; height: number })).toBe(false)
  766 |   })
  767 | 
  768 |   test('keeps both final Finarfin and Earwen projection contexts independently addressable', async ({ page }) => {
  769 |     const geometry = await page.locator('svg.preview3-graph').evaluate((svg) => {
  770 |       type Box = { id: string; label: string; x: number; y: number; width: number; height: number }
  771 |       const getNumber = (element: Element, attribute: string) => Number(element.getAttribute(attribute) ?? 'NaN')
  772 |       const getTranslate = (element: Element) => {
  773 |         const match = /translate\(([-0-9.]+)\s+([-0-9.]+)\)/.exec(element.getAttribute('transform') ?? '')
  774 |         return match ? { x: Number(match[1]), y: Number(match[2]) } : null
  775 |       }
  776 |       const mainById = new Map<string, Box>()
  777 |       for (const group of Array.from(svg.querySelectorAll('g[data-person-id]'))) {
  778 |         const rect = group.querySelector(':scope > rect[rx="18"]')
  779 |         const label = group.querySelector(':scope > text.preview3-svg-name')?.textContent?.trim() ?? ''
  780 |         const id = group.getAttribute('data-person-id')
  781 |         if (!rect || !id) {
  782 |           continue
  783 |         }
  784 | 
  785 |         const x = getNumber(rect, 'x')
  786 |         const y = getNumber(rect, 'y')
  787 |         const width = getNumber(rect, 'width')
  788 |         const height = getNumber(rect, 'height')
  789 |         if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height)) {
  790 |           mainById.set(id, { id, label, x, y, width, height })
  791 |         }
  792 |       }
  793 | 
  794 |       const projections = Array.from(svg.querySelectorAll('g[data-projection-context]')).flatMap((group) => {
  795 |         const rect = group.querySelector(':scope > rect[rx="16"]')
  796 |         const translate = getTranslate(group)
  797 |         const ownerId = group.getAttribute('data-projection-owner-id')
  798 |         const companionId = group.getAttribute('data-projection-companion-id')
  799 |         const context = group.getAttribute('data-projection-context')
  800 |         const planned = group.getAttribute('data-projection-planned')
  801 |         if (!rect || !translate || !ownerId || !companionId || !context) {
  802 |           return []
  803 |         }
  804 | 
  805 |         const width = getNumber(rect, 'width')
  806 |         const height = getNumber(rect, 'height')
  807 |         const owner = mainById.get(ownerId)
  808 |         const companion = mainById.get(companionId)
  809 |         return Number.isFinite(width) && Number.isFinite(height) && owner && companion
  810 |           ? [{ context, planned, owner, companion, x: translate.x, y: translate.y, width, height }]
  811 |           : []
  812 |       }).filter((projection) => {
  813 |         return (projection.owner.label === 'Finarfin' && projection.companion.label === 'Eärwen')
  814 |           || (projection.owner.label === 'Eärwen' && projection.companion.label === 'Finarfin')
  815 |       })
  816 | 
  817 |       return { projections }
  818 |     })
  819 | 
  820 |     expect(geometry.projections).toHaveLength(2)
  821 |     expect(new Set(geometry.projections.map((projection) => projection.context.split(':').slice(1).join(':'))).size).toBe(2)
  822 |     expect(geometry.projections.map((projection) => projection.planned)).toEqual(['true', 'true'])
  823 | 
  824 |     for (const projection of geometry.projections) {
  825 |       const ownerRight = projection.owner.x + projection.owner.width
  826 |       const projectionRight = projection.x + projection.width
  827 |       const horizontalGap = projection.x >= ownerRight
  828 |         ? projection.x - ownerRight
  829 |         : projection.owner.x - projectionRight
> 830 |       expect(horizontalGap).toBe(28)
      |                             ^ Error: expect(received).toBe(expected) // Object.is equality
  831 |       expect(projection.y - projection.owner.y).toBe(6)
  832 |     }
  833 | 
  834 |     const [first, second] = geometry.projections
  835 |     const overlaps = first.x < second.x + second.width
  836 |       && second.x < first.x + first.width
  837 |       && first.y < second.y + second.height
  838 |       && second.y < first.y + first.height
  839 |     expect(overlaps).toBe(false)
  840 |   })
  841 | 
  842 |   test('completes final R3B geometry without box collisions and preserves shared start-house roots', async ({ page }) => {
  843 |     const geometry = await page.locator('svg.preview3-graph').evaluate((svg) => {
  844 |       type Box = { id: string; label: string; kind: 'main' | 'projection'; x: number; y: number; width: number; height: number }
  845 | 
  846 |       const getNumber = (element: Element, attribute: string) => Number(element.getAttribute(attribute) ?? 'NaN')
  847 |       const getTranslate = (group: Element) => {
  848 |         const match = /translate\(([-0-9.]+)\s+([-0-9.]+)\)/.exec(group.getAttribute('transform') ?? '')
  849 |         return match ? { x: Number(match[1]), y: Number(match[2]) } : null
  850 |       }
  851 |       const getMainBoxes = (): Box[] => Array.from(svg.querySelectorAll('g[data-person-id]')).flatMap((group) => {
  852 |         const rect = group.querySelector(':scope > rect[rx="18"]')
  853 |         const label = group.querySelector(':scope > text.preview3-svg-name')?.textContent?.trim() ?? ''
  854 |         if (!rect) {
  855 |           return []
  856 |         }
  857 | 
  858 |         const x = getNumber(rect, 'x')
  859 |         const y = getNumber(rect, 'y')
  860 |         const width = getNumber(rect, 'width')
  861 |         const height = getNumber(rect, 'height')
  862 |         return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height)
  863 |           ? [{ id: group.getAttribute('data-person-id') ?? label, label, kind: 'main' as const, x, y, width, height }]
  864 |           : []
  865 |       })
  866 |       const getProjectionBoxes = (): Box[] => Array.from(svg.querySelectorAll('g')).flatMap((group) => {
  867 |         const rect = group.querySelector(':scope > rect[rx="16"]')
  868 |         const label = group.querySelector(':scope > text.preview3-svg-name')?.textContent?.trim() ?? ''
  869 |         const translate = getTranslate(group)
  870 |         if (!rect || !label || !translate) {
  871 |           return []
  872 |         }
  873 | 
  874 |         const width = getNumber(rect, 'width')
  875 |         const height = getNumber(rect, 'height')
  876 |         return Number.isFinite(width) && Number.isFinite(height)
  877 |           ? [{ id: `${label}:${translate.x}:${translate.y}`, label, kind: 'projection' as const, x: translate.x, y: translate.y, width, height }]
  878 |           : []
  879 |       })
  880 |       const mainBoxes = getMainBoxes()
  881 |       const projectionBoxes = getProjectionBoxes()
  882 |       const boxes = [...mainBoxes, ...projectionBoxes]
  883 |       const overlaps = (left: Box, right: Box) => left.x < right.x + right.width
  884 |         && right.x < left.x + left.width
  885 |         && left.y < right.y + right.height
  886 |         && right.y < left.y + left.height
  887 |       const overlapsByPair = boxes.flatMap((left, index) => boxes.slice(index + 1)
  888 |         .filter((right) => overlaps(left, right))
  889 |         .map((right) => `${left.kind}:${left.label}|${right.kind}:${right.label}`))
  890 |       const mainByLabel = (label: string) => mainBoxes.filter((box) => box.label === label)
  891 |       const enel = mainByLabel('Enel')[0] ?? null
  892 |       const enelye = mainByLabel('Enelyë')[0] ?? null
  893 |       const sharedChildren = ['Elwë (Thingol)', 'Olwë']
  894 |         .map((label) => mainByLabel(label)[0] ?? null)
  895 |         .filter((node): node is Box => node !== null)
  896 |       const parentCenterX = enel && enelye
  897 |         ? ((enel.x + enel.width / 2) + (enelye.x + enelye.width / 2)) / 2
  898 |         : null
  899 |       const sharedChildBandCenterX = sharedChildren.length === 0
  900 |         ? null
  901 |         : (Math.min(...sharedChildren.map((node) => node.x + node.width / 2))
  902 |           + Math.max(...sharedChildren.map((node) => node.x + node.width / 2))) / 2
  903 |       const mainParentLines = enel && enelye
  904 |         ? [enel, enelye].filter((parent) => Array.from(svg.querySelectorAll('line')).some((line) => {
  905 |             const x1 = getNumber(line, 'x1')
  906 |             const y1 = getNumber(line, 'y1')
  907 |             const x2 = getNumber(line, 'x2')
  908 |             const y2 = getNumber(line, 'y2')
  909 |             return Math.abs(x1 - (parent.x + parent.width / 2)) < 0.5
  910 |               && Math.abs(x2 - x1) < 0.5
  911 |               && Math.abs(y1 - (parent.y + parent.height)) < 0.5
  912 |               && y2 > y1
  913 |           })).length
  914 |         : 0
  915 |       const nelyarAnchor = Array.from(svg.querySelectorAll('text')).flatMap((text) => {
  916 |         if (text.textContent?.trim() !== 'Nelyar and Teleri line') {
  917 |           return []
  918 |         }
  919 | 
  920 |         const group = text.parentElement
  921 |         const rect = group?.querySelector(':scope > rect')
  922 |         const translate = group ? getTranslate(group) : null
  923 |         if (!group || !rect || !translate) {
  924 |           return []
  925 |         }
  926 | 
  927 |         const width = getNumber(rect, 'width')
  928 |         return Number.isFinite(width) ? [{ centerX: translate.x + width / 2 }] : []
  929 |       })[0] ?? null
  930 | 
```