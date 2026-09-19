with k as (
  insert into public.foundation_kurse(
    kurs_id,kg_path_id,titel,untertitel,beschreibung,niveau,thema,thema_farbe,dauer_min,punkte,published,sort_order
  ) values (
    'kurs_geologie_bohrkern','PATH:NOXIA:GEOLOGY:CORE-SAMPLE-L0',
    'Bohrkern lesen: Schichten, Wasser und Evidenz','Vom Bohrprofil zum geologischen Verständnis',
    'Grundlagen zum Lesen von Bohrkernen: Schichtfolge, Porosität und Permeabilität, Aquifere und Deckschichten, mineralisierte Zonen sowie die Trennung zwischen realem Makrokontext und NOXIA-Modellannahmen.',
    1,'Geologie','#8a6a00',12,50,true,240
  )
  on conflict (kurs_id) do update set
    kg_path_id=excluded.kg_path_id,titel=excluded.titel,untertitel=excluded.untertitel,beschreibung=excluded.beschreibung,
    niveau=excluded.niveau,thema=excluded.thema,thema_farbe=excluded.thema_farbe,dauer_min=excluded.dauer_min,
    punkte=excluded.punkte,published=excluded.published,sort_order=excluded.sort_order
  returning id
), deleted as (
  delete from public.foundation_folien where kurs_id=(select id from k)
)
insert into public.foundation_folien(kurs_id,position,typ,titel,inhalt)
select (select id from k),v.position,v.typ,v.titel,v.inhalt
from (values
  (1,'text','Was ein Bohrkern wirklich zeigt',jsonb_build_object('lines',jsonb_build_array(
    'Ein Bohrkern ist kein Scannerbild, sondern eine Probe entlang einer vertikalen Linie.','',
    '## Drei Informationsebenen','1. Beobachtung: Was wurde tatsächlich in der Probe angetroffen?',
    '2. Interpretation: Welche geologische Bedeutung könnte die Schicht haben?',
    '3. Modell: Welche Annahmen ergänzt NOXIA dort, wo reale 3D-Untergrunddaten fehlen?','',
    '! Gute Geologie trennt Messung, Interpretation und Modellannahme.',
    '? Ein leeres Bohrloch beweist nicht, dass im gesamten Gebiet kein Rohstoff oder Wasser existiert.'
  ))),
  (2,'tabelle','Schichten lesen',jsonb_build_object(
    'headers',jsonb_build_array('Schicht','Typische Eigenschaft','Mögliche Bedeutung'),
    'rows',jsonb_build_array(
      jsonb_build_array('Boden / Verwitterung','locker, heterogen','Oberflächenprozesse, geringe Tiefe'),
      jsonb_build_array('Sand / Kies','oft porös und durchlässig','möglicher Aquifer'),
      jsonb_build_array('Ton / Tonstein','feinkörnig, geringe Durchlässigkeit','mögliche Deckschicht / Aquitard'),
      jsonb_build_array('Sandstein','Porosität stark variabel','Aquifer oder Reservoir möglich'),
      jsonb_build_array('Festgestein','meist geringe Primärporosität','Wasser eher in Klüften'),
      jsonb_build_array('Mineralisierte Zone','erhöhte Erz-/Mineralsignatur','Rohstoffziel, weitere Charakterisierung nötig')
    )
  )),
  (3,'zwei_spalten','Porosität ist nicht Permeabilität',jsonb_build_object(
    'left',jsonb_build_object('title','Porosität','lines',jsonb_build_array('Wie viel Hohlraum besitzt ein Material?','Hohe Porosität kann viel Wasser speichern.','Poren können jedoch schlecht miteinander verbunden sein.')),
    'right',jsonb_build_object('title','Permeabilität','lines',jsonb_build_array('Wie gut kann ein Fluid durch das Material fließen?','Gute Verbindung der Poren oder Klüfte ist entscheidend.','Für einen ergiebigen Aquifer braucht es meist beides: Speicher + Fließwege.')),
    'left_accent','#2f86c9','right_accent','#1a7a4a'
  )),
  (4,'text','Aquifer, Deckschicht und Grundwasser',jsonb_build_object('lines',jsonb_build_array(
    'Ein Aquifer ist eine geologische Einheit, die Wasser speichern und in nutzbarer Menge leiten kann.','',
    '## Typisches System','Durchlässige Schicht → Wasser kann eindringen und fließen.',
    'Wenig durchlässige Schicht → Wasserbewegung wird gebremst; sie kann als Deckschicht wirken.',
    'Gefälle und Druckverhältnisse bestimmen zusätzlich die Fließrichtung.','',
    '! Eine wasserführende Schicht ist noch kein Beweis für dauerhaft nutzbares Grundwasser.',
    'Förderrate, Neubildung, Wasserqualität und langfristige Absenkung müssen separat untersucht werden.'
  ))),
  (5,'text','GLiM, lokale Schichten und Unsicherheit',jsonb_build_object('lines',jsonb_build_array(
    'GLiM liefert in NOXIA einen groben lithologischen Makrokontext. Die Auflösung ist viel gröber als ein einzelnes Bohrloch.','',
    'Die vertikale Schichtfolge im aktuellen Bohrkernmodell ist daher deterministisch erzeugt und wird als noxia_stratigraphy_v1 gekennzeichnet.',
    'Auch die modellierte Lagerstättentiefe ist kein reales Tiefenmessdatum.','',
    '## Warum das wichtig ist','Eine wissenschaftlich saubere Oberfläche muss zeigen, welche Aussage gemessen, dokumentiert, modelliert oder nur wahrscheinlich ist.',
    '! Mehr Messmethoden reduzieren Unsicherheit, sie löschen sie nicht vollständig.'
  ))),
  (6,'quiz','Verständnischeck',jsonb_build_object('fragen',jsonb_build_array(
    jsonb_build_object('frage','Welche Aussage beschreibt einen guten Aquifer am besten?','optionen',jsonb_build_array('Er hat nur hohe Porosität.','Er kann Wasser speichern und ausreichend gut leiten.','Er besteht immer aus Kalkstein.','Er liegt immer unter einer Tonschicht.'),'richtig',1,'erklaerung','Ein Aquifer braucht nutzbaren Speicherraum und ausreichende hydraulische Leitfähigkeit.'),
    jsonb_build_object('frage','Was bedeutet eine Tonschicht über einer wasserführenden Sandschicht häufig?','optionen',jsonb_build_array('Sie kann als wenig durchlässige Deckschicht wirken.','Sie macht Grundwasser unmöglich.','Sie beweist eine Erzader.','Sie erhöht automatisch die Porosität des Sandes.'),'richtig',0,'erklaerung','Ton besitzt typischerweise geringe hydraulische Leitfähigkeit und kann den vertikalen Wasserfluss bremsen.'),
    jsonb_build_object('frage','Was bedeutet GLiM im aktuellen NOXIA-Bohrprofil?','optionen',jsonb_build_array('Exakte lokale Bohrlochgeologie.','Ein grober lithologischer Makrokontext.','Eine Laboranalyse des Bohrkerns.','Eine garantierte Rohstofflagerstätte.'),'richtig',1,'erklaerung','GLiM wird nur als großräumiger lithologischer Kontext verwendet.'),
    jsonb_build_object('frage','Eine 50-m-Bohrung trifft keinen Rohstoff. Was folgt daraus?','optionen',jsonb_build_array('Im gesamten Gebiet existiert kein Rohstoff.','Unter 50 m kann nichts mehr liegen.','An dieser Probenlinie wurde bis 50 m kein modelliertes Vorkommen durchschnitten.','Der Scanner war defekt.'),'richtig',2,'erklaerung','Bohrungen sind punktuelle Proben. Ein negatives Ergebnis gilt nur für den untersuchten Ort und Tiefenbereich.'),
    jsonb_build_object('frage','Warum trennt NOXIA Messung, Interpretation und Modell?','optionen',jsonb_build_array('Damit Spieler weniger Informationen sehen.','Damit Unsicherheit und Datenherkunft wissenschaftlich nachvollziehbar bleiben.','Damit jede Bohrung zufällig anders ist.','Weil reale Geologie keine Schichten besitzt.'),'richtig',1,'erklaerung','Die Trennung verhindert Scheingenauigkeit und macht Evidenz transparent.')
  )))
) as v(position,typ,titel,inhalt);
