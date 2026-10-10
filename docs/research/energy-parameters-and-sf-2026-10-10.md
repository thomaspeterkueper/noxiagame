# Energie-Kennzahlen und Science-Fiction-Vorbilder für NOXIA-ENERGY-0001

Stand: 10.10.2026. Kennzeichnung: **G** = geprüft (Quelle geöffnet, Zahl steht dort), **N** = nicht geprüft
(Allgemeinwissen), **R** = aus geprüften Werten gerechnet. „Fallback" heißt: nur Wikipedia als Quelle.

## Kennzahlen

| Größe | Wert | Status | Quelle |
|---|---|---|---|
| Heizwert Methan | 13,9 kWh/kg | G, Fallback | en.wikipedia.org/wiki/Heat_of_combustion |
| Heizwert Wasserstoff | 33,3 kWh/kg | G, Fallback | wie oben |
| Mischungsverhältnis Methan/Sauerstoff | 3,6 (Raptor), stöchiometrisch 4,0 | G, Fallback / N | en.wikipedia.org/wiki/SpaceX_Raptor |
| Chemische Energie Methan/Sauerstoff-Gemisch | rund 2,7 kWh/kg | R | – |
| Chemische Energie Wasserstoff/Sauerstoff-Gemisch | rund 3,6 kWh/kg | R | – |
| Elektrolyse | 55 kWh je kg Wasserstoff (System, Stand 2022), Ziel 46 | G | energy.gov/eere/fuelcells/technical-targets-proton-exchange-membrane-electrolysis |
| Wasser je kg Wasserstoff | rund 9 kg | N | – |
| Mars-Treibstoffanlage (NASA-Studie) | 29,7 t Treibstoff aus 15,7 t Wasser in 480 Tagen bei 35–52 kW | G | ntrs.nasa.gov/api/citations/20170005179/downloads/20170005179.pdf |
| daraus: Strom je Tonne Treibstoff | 13,6–20,2 MWh | R | – |
| daraus: Wasser je Tonne Treibstoff | 0,53 t | R | – |
| Mond-Wassergewinnung (NASA-Studie) | 68 kW, 225 Tage, 15 t Wasser | G | ntrs.nasa.gov/api/citations/20210016820/downloads/WaterMiningArchitecture_PTMSS2021_Kleinhenz.pdf |
| daraus: Strom je kg Wasser inkl. Abbau | rund 25 kWh | R | – |
| Lithium-Ionen-Zelle | 240–270 Wh/kg | G | nasa.gov/wp-content/uploads/2023/05/3.-soa-power-2022.pdf |
| Lithium-Ionen-Pack, raumfahrttauglich | 75–155 Wh/kg | G | wie oben |
| Regenerative Brennstoffzelle, Wirkungsgrad hin und zurück | 30–40 % | G | ntrs.nasa.gov/api/citations/20210014627/downloads/TM-20210014627.pdf |
| Regenerative Brennstoffzelle, spezifische Energie | Ziel 550 Wh/kg, nicht demonstriert | G | wie oben |
| Brennstoffzelle Wasserstoff/Sauerstoff | 54,5 % am Auslegungspunkt | G | wie oben |
| Abbrand Leichtwasserreaktor | 40 bis über 60 GWd je Tonne Uran | G | world-nuclear.org/information-library/nuclear-fuel-cycle/conversion-enrichment-and-fabrication/fuel-fabrication |
| Schwermetallanteil eines Brennelements | rund 0,70 | N | – |
| Wirkungsgrad thermisch → elektrisch | rund 33 % (Leichtwasser, N); KRUSTY 4 kW thermisch → 1 kW elektrisch (G) | – | nasa.gov/wp-content/uploads/2017/12/kilopower_media_event_charts_16x9_final.pdf |
| Fission Surface Power | 40 kW elektrisch, unter 6 t, rund 10 Jahre | G | nasa.gov/centers-and-facilities/glenn/nasas-fission-surface-power-project-energizes-lunar-exploration/ |
| Megawatt-Reaktor (Studie) | 2 MW elektrisch bei 19 kg je kW | G | ntrs.nasa.gov/api/citations/20220013600/downloads/ASCEND_22_Brayton_Performance_Mass_Sensitivity.pdf |
| Sonneneinstrahlung | Mars 586 W/m², Erde 1.361 W/m² (Verhältnis 0,43) | G | nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html |
| Staubsturm | Opportunity 2018: 645 → 22 Wh je Sol, also −97 % | G | planetary.org/articles/06-mer-update-opportunity-dust-storm-sleep |
| Mond-Polgipfel | 81–86 % Beleuchtung im Jahr, zwei Punkte kombiniert rund 94 % | G, Fallback | en.wikipedia.org/wiki/Peak_of_eternal_light |
| D-He³-Fusion | rund 161.000 MWh thermisch je kg | G | arxiv.org/pdf/1410.6865 |
| Helium-3 im Mondboden | im Mittel rund 4 ppb, Maxima 10–20 ppb | G | wie oben |
| Stand der Fusion | Keine Anlage hat bisher Netto-Strom erzeugt | G | world-nuclear.org/information-library/current-and-future-generation/nuclear-fusion-power |
| Spezifischer Impuls | Methan 327–380 s, Wasserstoff 450–465 s (Fallback); nuklearthermisch 875–950 s; Hall 1.900–2.800 s | G | ntrs.nasa.gov/api/citations/20120003776/downloads/20120003776.pdf |

### Strom je Kilogramm Brennelement (Rechnung)

1 GWd entspricht 24.000 MWh thermisch.

- **Leichtwasserreaktor:** 45–60 GWd/t ergeben 1.080–1.440 MWh thermisch je kg Schwermetall. Mal 0,33
  Wirkungsgrad und 0,70 Schwermetallanteil bleiben **rund 250–330 MWh elektrisch je kg Brennelement**.
- **Kleiner Raumreaktor (Kilopower):** 10 kW über 10 Jahre sind 876 MWh aus einem 226-kg-Kern, also
  **rund 4 MWh je kg Kern**. Kleine Reaktoren nutzen ihren Brennstoff kaum aus.

### Folgerungen für das Modell

- **Treibstoff ist kein Stromspeicher.** Methan/Sauerstoff trägt rund 2,7 kWh/kg, kostet in der
  Herstellung aber 14–20 kWh/kg. Sein Wert ist Schub, nicht gespeicherter Strom.
- **Wasser ist der Engpass:** rund 0,53 t je Tonne Treibstoff auf dem Mars.
- **Batterien für Stunden, Brennstoffzellen für die Mondnacht:** Packs rund 150 Wh/kg bei hohem
  Wirkungsgrad; regenerative Systeme rund 550 Wh/kg bei nur 30–40 %.
- **Brennstäbe sind extrem dicht:** gehandelt werden Kilogramm, nicht Tonnen. Der Preis sollte Anreicherung
  und Fertigung abbilden, nicht die Masse.
- **Reaktoren sind massebegrenzt:** 150 kg je kW (klein) bis rund 20 kg je kW (Megawatt-Klasse).
- **Solar:** Mars-Faktor 0,43, dazu Sturmereignisse mit bis zu −97 % über Wochen; an den Mondpolen 81–94 %
  Verfügbarkeit.
- **Helium-3 ist ein armes Erz:** rund 250.000 t Mondboden je kg bei 4 ppb.
- **Energiequelle und Reaktionsmasse sind getrennte Güter** (Wasserstoff bei nuklearthermisch,
  Xenon oder Argon bei elektrisch).

## Science-Fiction: Konsequenzen statt Zahlen

Aus den Werken wird übernommen, was aus der Energielogistik gesellschaftlich folgt, nicht ihre Leistungswerte.
Quellen sind Zusammenfassungen (Wikipedia als Fallback), nicht die Romane selbst.

- **The Expanse:** Ein Fusionsantrieb erlaubt Dauerbeschleunigung; der Wirkungsgrad ist erfunden. Folge:
  Der Gürtel fördert Rohstoffe, die inneren Planeten kontrollieren die Lebensgüter – Abhängigkeit und
  Aufstand. Die Handlung beginnt auf einem Eisfrachter.
- **Der Marsianer:** Rover-Reichweite ist durch Ladezeit begrenzt, ein Staubsturm bedroht die Ladeleistung
  (real, siehe Opportunity). Folge: Energie als täglicher Fahrplan.
- **Robinson, Mars-Trilogie:** Kernreaktoren, Erdwärmeschächte, Orbitalspiegel, Weltraumlift. Folge:
  Infrastruktur ist Machtfrage; der Lift wird in der Revolution gekappt.
- **McDonald, Luna:** Helium-3-Abbau, fünf Familien mit je einem Monopol; Luft, Wasser, Kohlenstoff und
  Daten werden je Person abgerechnet. Folge: Monopole je Lebensgut erzeugen Politik.
- **Heinlein, The Moon Is a Harsh Mistress:** Ein elektromagnetisches Katapult exportiert Weizen. Folge:
  Export entzieht dem Mond Wasser, daraus folgen Ressourcenkollaps und Revolte.
- **Atomic Rockets (projectrho.com):** Antriebstabellen mit getrennten Feldern für Brennstoff, Reaktor und
  Reaktionsmasse; chemische Raketen sind die Ausnahme, bei der beides dasselbe ist.

### Was sich übernehmen lässt

- Exportbilanz flüchtiger Stoffe: Jede exportierte Tonne Wasser oder Treibstoff fehlt der Kolonie dauerhaft.
- Abbaurechte und Monopole je Lebensgut sind Hebel der Verwaltung.
- Engpass-Infrastruktur (Reaktor, Treibstoffanlage, Depot) ist Machtzentrum.
- Energie als Tagesbudget: Laden gegen Fahren, Sturm als Ereignis mit Vorwarnzeit.
- Antriebe als Tabelle mit getrennten Feldern für Energiequelle und Reaktionsmasse.
