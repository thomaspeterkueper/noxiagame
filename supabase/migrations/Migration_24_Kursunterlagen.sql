-- Migration 024: Folien für Kurs 00 (Zahlen & Einheiten) + Kurs 01 (Prozentrechnung)
-- Stand: 23.06.2026

-- ── Hilfsfunktion: kurs_id text → uuid ───────────────────────────────────────
-- Alle INSERTs nutzen Subquery statt hardcodierte UUIDs

-- ═══════════════════════════════════════════════════════════════════════════════
-- KURS 00: Zahlen & Einheiten (6 Folien)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO foundation_folien (kurs_id, position, typ, titel, inhalt)
SELECT k.id, 1, 'text', 'Willkommen in der Akademie', jsonb_build_object(
  'lines', jsonb_build_array(
    '## Warum Zahlen und Einheiten?',
    '',
    'Im Weltall arbeiten wir mit sehr grossen und sehr kleinen Zahlen.',
    'Ohne die richtigen Einheiten entstehen gefährliche Fehler.',
    '',
    '1999 verpasste die NASA-Sonde Mars Climate Orbiter den Mars,',
    'weil ein Team Meter und ein anderes Team Fuss verwendete.',
    'Schaden: 327 Millionen Dollar.',
    '',
    '! In Noxia: Tonnen, Credits, Ticks — jede Einheit hat eine Bedeutung.',
    '  Wer Einheiten verwechselt, verliert Credits oder Kolonisten.'
  )
) FROM foundation_kurse k WHERE k.kurs_id = 'kurs_00_einheiten'
ON CONFLICT (kurs_id, position) DO NOTHING;

INSERT INTO foundation_folien (kurs_id, position, typ, titel, inhalt)
SELECT k.id, 2, 'tabelle', 'Einheiten in Noxia', jsonb_build_object(
  'headers', jsonb_build_array('Einheit', 'Bedeutung', 'Beispiel'),
  'rows', jsonb_build_array(
    jsonb_build_array('Tonne (t)', 'Masse von Ressourcen', '80t Wasser im Laderaum'),
    jsonb_build_array('Credit (Cr)', 'Währung', '1.220 Cr Gewinn pro Flug'),
    jsonb_build_array('Tick', 'Spielzeit-Einheit (~1 Stunde)', 'Wachstum +1%/Tick'),
    jsonb_build_array('AE', 'Astronomische Einheit = 150 Mio. km', 'Mars: 1,52 AE von Sonne'),
    jsonb_build_array('m/s²', 'Beschleunigung', 'Erde: 9,81 m/s² Schwerkraft'),
    jsonb_build_array('km/s', 'Geschwindigkeit', 'Escape Velocity Erde: 11,2 km/s')
  ),
  'highlight_col', 2
) FROM foundation_kurse k WHERE k.kurs_id = 'kurs_00_einheiten'
ON CONFLICT (kurs_id, position) DO NOTHING;

INSERT INTO foundation_folien (kurs_id, position, typ, titel, inhalt)
SELECT k.id, 3, 'text', 'Grosse Zahlen lesen', jsonb_build_object(
  'lines', jsonb_build_array(
    '## Tausend, Million, Milliarde',
    '',
    '1.000         = Tausend        (drei Nullen)',
    '1.000.000     = Million        (sechs Nullen)',
    '1.000.000.000 = Milliarde      (neun Nullen)',
    '',
    '## Abkürzungen',
    '',
    '1k  = 1.000       (k = Kilo)',
    '1M  = 1.000.000   (M = Mega)',
    '1G  = 1.000.000.000  (G = Giga)',
    '',
    '! Erdbevölkerung: ~8 Milliarden = 8.000.000.000 Menschen',
    '  Mars-Kolonie in Noxia: ~12.000 Menschen — winzig dagegen!'
  )
) FROM foundation_kurse k WHERE k.kurs_id = 'kurs_00_einheiten'
ON CONFLICT (kurs_id, position) DO NOTHING;

INSERT INTO foundation_folien (kurs_id, position, typ, titel, inhalt)
SELECT k.id, 4, 'zwei_spalten', 'Multiplikation und Division mit Einheiten', jsonb_build_object(
  'left', jsonb_build_object(
    'title', 'Multiplikation',
    'lines', jsonb_build_array(
      'Preis × Menge = Gesamtpreis',
      '',
      '130 Cr/t × 80t = 10.400 Cr',
      '',
      '4 Energie/Tick × 5 Ticks',
      '= 20 Energie',
      '',
      'Einheiten kürzen sich:',
      'Cr/t × t = Cr ✓'
    )
  ),
  'right', jsonb_build_object(
    'title', 'Division',
    'lines', jsonb_build_array(
      'Gesamtpreis ÷ Menge = Preis',
      '',
      '10.400 Cr ÷ 80t = 130 Cr/t',
      '',
      '20 Energie ÷ 4 Energie/Tick',
      '= 5 Ticks',
      '',
      'Einheiten kürzen sich:',
      'Energie ÷ Energie/Tick = Tick ✓'
    )
  ),
  'left_accent', '#1a4e8a',
  'right_accent', '#1a7a4a'
) FROM foundation_kurse k WHERE k.kurs_id = 'kurs_00_einheiten'
ON CONFLICT (kurs_id, position) DO NOTHING;

INSERT INTO foundation_folien (kurs_id, position, typ, titel, inhalt)
SELECT k.id, 5, 'formel', 'Die wichtigste Formel: Gewinn', jsonb_build_object(
  'formel', 'Gewinn = (Verkaufspreis - Kaufpreis) × Menge - Kosten',
  'erklaerung', 'Diese Formel verwendest du bei jeder Handelsentscheidung in Noxia. Kaufpreis und Verkaufspreis haben die Einheit Cr/t, Menge in Tonnen, Kosten in Credits.',
  'beispiele', jsonb_build_array(
    'Wasser Mond→Mars: (155 - 130) × 80t - 780 Cr Energie = 1.220 Cr',
    'Metall Mond→Mars: (58 - 35) × 88t - 780 Cr Energie = 1.244 Cr',
    '? Energie Mond→Phobos: (58 - 65) × 88t - 650 Cr = -1.266 Cr  VERLUST!'
  )
) FROM foundation_kurse k WHERE k.kurs_id = 'kurs_00_einheiten'
ON CONFLICT (kurs_id, position) DO NOTHING;

INSERT INTO foundation_folien (kurs_id, position, typ, titel, inhalt)
SELECT k.id, 6, 'quiz', 'Abschluss-Quiz: Zahlen & Einheiten', jsonb_build_object(
  'fragen', jsonb_build_array(
    jsonb_build_object(
      'frage', 'Ein Frachter lädt 80 Tonnen Wasser zum Preis von 130 Cr/t. Wie viel kostet das insgesamt?',
      'optionen', jsonb_build_array('10.400 Cr', '1.625 Cr', '80 Cr', '130 Cr'),
      'richtig', 0,
      'erklaerung', '80t × 130 Cr/t = 10.400 Cr. Die Einheiten kürzen sich: t × Cr/t = Cr.'
    ),
    jsonb_build_object(
      'frage', 'Was bedeutet die Einheit "Cr/t"?',
      'optionen', jsonb_build_array('Credits pro Tick', 'Credits pro Tonne', 'Cargo rate', 'Cr dividiert durch Tick'),
      'richtig', 1,
      'erklaerung', 'Cr/t = Credits pro Tonne. Diese Einheit beschreibt einen Preis — wie viel eine Tonne kostet.'
    ),
    jsonb_build_object(
      'frage', 'Eine Kolonie verbraucht 5t Wasser/Tick. Wie viel Wasser braucht sie in 24 Ticks?',
      'optionen', jsonb_build_array('5t', '24t', '120t', '480t'),
      'richtig', 2,
      'erklaerung', '5t/Tick × 24 Ticks = 120t. Die Einheiten: t/Tick × Tick = t.'
    ),
    jsonb_build_object(
      'frage', 'Gewinn = (155 - 130) × 80 - 780. Was ist das Ergebnis?',
      'optionen', jsonb_build_array('1.220 Cr', '2.000 Cr', '440 Cr', '-780 Cr'),
      'richtig', 0,
      'erklaerung', '(155-130) = 25, × 80 = 2.000, - 780 = 1.220 Cr.'
    )
  )
) FROM foundation_kurse k WHERE k.kurs_id = 'kurs_00_einheiten'
ON CONFLICT (kurs_id, position) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- KURS 01: Prozentrechnung (7 Folien)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO foundation_folien (kurs_id, position, typ, titel, inhalt)
SELECT k.id, 1, 'text', 'Was sind Prozent?', jsonb_build_object(
  'lines', jsonb_build_array(
    '## 1 Prozent = 1 Hundertstel',
    '',
    '100% = das Ganze     50% = die Hälfte     25% = ein Viertel',
    '',
    '## Die Grundformel',
    '',
    'Prozentwert = Grundwert × (Prozentsatz ÷ 100)',
    '',
    'Beispiel: 1% von 500 Einwohnern = 500 × 0,01 = 5 Einwohner',
    '',
    '! In Noxia: Kolonien wachsen um +1%/Tick wenn versorgt.',
    '  Bei 1.000 Einwohnern = 10 neue Einwohner pro Tick.',
    '  Bei 10.000 Einwohnern = 100 neue pro Tick — exponentielles Wachstum!'
  )
) FROM foundation_kurse k WHERE k.kurs_id = 'kurs_01_prozentrechnung'
ON CONFLICT (kurs_id, position) DO NOTHING;

INSERT INTO foundation_folien (kurs_id, position, typ, titel, inhalt)
SELECT k.id, 2, 'tabelle', 'Die drei Grundaufgaben', jsonb_build_object(
  'headers', jsonb_build_array('Gesucht', 'Formel', 'Noxia-Beispiel'),
  'rows', jsonb_build_array(
    jsonb_build_array('Prozentwert', 'G × p ÷ 100', '1.000 × 1 ÷ 100 = 10 Einwohner'),
    jsonb_build_array('Grundwert', 'W × 100 ÷ p', '10 × 100 ÷ 1 = 1.000 Einwohner'),
    jsonb_build_array('Prozentsatz', 'W × 100 ÷ G', '10 × 100 ÷ 1.000 = 1%')
  ),
  'highlight_col', 1
) FROM foundation_kurse k WHERE k.kurs_id = 'kurs_01_prozentrechnung'
ON CONFLICT (kurs_id, position) DO NOTHING;

INSERT INTO foundation_folien (kurs_id, position, typ, titel, inhalt)
SELECT k.id, 3, 'animation', 'Bevölkerungswachstum live', jsonb_build_object(
  'animation_id', 'bevoelkerungswachstum',
  'params', jsonb_build_object(
    'start', 1000,
    'wachstum_rate', 0.01,
    'rueckgang_rate', 0.02,
    'ticks', 20
  )
) FROM foundation_kurse k WHERE k.kurs_id = 'kurs_01_prozentrechnung'
ON CONFLICT (kurs_id, position) DO NOTHING;

INSERT INTO foundation_folien (kurs_id, position, typ, titel, inhalt)
SELECT k.id, 4, 'zwei_spalten', 'Wachstum vs. Rückgang', jsonb_build_object(
  'left', jsonb_build_object(
    'title', 'Versorgt: +1%/Tick',
    'lines', jsonb_build_array(
      'Tick 0:    1.000 Einw.', 'Tick 1:    1.010 Einw.',
      'Tick 5:    1.051 Einw.', 'Tick 10:  1.105 Einw.',
      'Tick 20:  1.220 Einw.', '',
      'Formel: G × 1,01^n'
    )
  ),
  'right', jsonb_build_object(
    'title', 'Unterversorgt: -2%/Tick',
    'lines', jsonb_build_array(
      'Tick 0:    1.000 Einw.', 'Tick 1:      980 Einw.',
      'Tick 5:      904 Einw.', 'Tick 10:    817 Einw.',
      'Tick 20:    668 Einw.', '',
      'Formel: G × 0,98^n'
    )
  ),
  'left_accent', '#1a7a4a',
  'right_accent', '#c0392b'
) FROM foundation_kurse k WHERE k.kurs_id = 'kurs_01_prozentrechnung'
ON CONFLICT (kurs_id, position) DO NOTHING;

INSERT INTO foundation_folien (kurs_id, position, typ, titel, inhalt)
SELECT k.id, 5, 'formel', 'Habitatkapazität berechnen', jsonb_build_object(
  'formel', 'max. Bevölkerung = Basis + (Anzahl Habitate × 100)',
  'erklaerung', 'Jedes Habitat erhöht die maximale Bevölkerungskapazität um 100 Personen. Übersteigt die Bevölkerung die Kapazität, setzt beschleunigter Rückgang (-2%/Tick) ein.',
  'beispiele', jsonb_build_array(
    'Basis 500 + 3 Habitate × 100 = 800 max. Einwohner',
    'Bevölkerung 750 < 800 → Wachstum möglich ✓',
    '? Bevölkerung 850 > 800 → Überbelegung! Rückgang -2%/Tick',
    'Umsiedlungskosten bei Habitat-Abriss: 5 Cr × verdrängte Einwohner'
  )
) FROM foundation_kurse k WHERE k.kurs_id = 'kurs_01_prozentrechnung'
ON CONFLICT (kurs_id, position) DO NOTHING;

INSERT INTO foundation_folien (kurs_id, position, typ, titel, inhalt)
SELECT k.id, 6, 'text', 'Typische Fehler', jsonb_build_object(
  'lines', jsonb_build_array(
    '## Fehler 1: Prozent addieren statt multiplizieren',
    '',
    '? Falsch: 1.000 + 1% = 1.001',
    '! Richtig: 1.000 × 1,01 = 1.010',
    '',
    '## Fehler 2: Rückgang unterschätzen',
    '',
    'Wachstum +1%/Tick: nach 10 Ticks × 1,105 = +10,5%',
    '? Rückgang -2%/Tick: nach 10 Ticks × 0,817 = -18,3%',
    '',
    '! Rückgang ist fast doppelt so stark wie Wachstum!',
    '  Niemals die Versorgung unterbrechen — der Schaden ist schwer rückgängig zu machen.',
    '',
    '## Fehler 3: Kapazität ignorieren',
    '',
    'Wachstum stoppt wenn Bevölkerung = max. Kapazität.',
    'Habitate rechtzeitig bauen — nicht erst wenn es zu spät ist.'
  )
) FROM foundation_kurse k WHERE k.kurs_id = 'kurs_01_prozentrechnung'
ON CONFLICT (kurs_id, position) DO NOTHING;

INSERT INTO foundation_folien (kurs_id, position, typ, titel, inhalt)
SELECT k.id, 7, 'quiz', 'Abschluss-Quiz: Prozentrechnung', jsonb_build_object(
  'fragen', jsonb_build_array(
    jsonb_build_object(
      'frage', 'Mars hat 12.000 Einwohner und wächst um 1%/Tick. Wie viele Einwohner kommen pro Tick hinzu?',
      'optionen', jsonb_build_array('1 Einwohner', '12 Einwohner', '120 Einwohner', '1.200 Einwohner'),
      'richtig', 2,
      'erklaerung', '12.000 × 0,01 = 120 neue Einwohner pro Tick.'
    ),
    jsonb_build_object(
      'frage', 'Eine Kolonie hat Basis-Kapazität 500 und 4 Habitate. Wie viele Einwohner passen maximal rein?',
      'optionen', jsonb_build_array('504', '900', '600', '400'),
      'richtig', 1,
      'erklaerung', '500 + 4 × 100 = 900 maximale Einwohner.'
    ),
    jsonb_build_object(
      'frage', 'Phobos hat 1.000 Einwohner und verliert 2%/Tick. Wie viele sind es nach 3 Ticks?',
      'optionen', jsonb_build_array('940 Einwohner', '970 Einwohner', '941 Einwohner', '994 Einwohner'),
      'richtig', 2,
      'erklaerung', '1.000 × 0,98 × 0,98 × 0,98 = 1.000 × 0,941 ≈ 941 Einwohner.'
    ),
    jsonb_build_object(
      'frage', 'Wachstum +1%/Tick ist halb so stark wie Rückgang -2%/Tick. Stimmt das?',
      'optionen', jsonb_build_array('Ja, genau halb so stark', 'Nein, Rückgang ist fast doppelt so stark', 'Sie sind gleich stark', 'Wachstum ist stärker'),
      'richtig', 1,
      'erklaerung', 'Nach 10 Ticks: Wachstum +10,5%, Rückgang -18,3%. Rückgang ist fast doppelt so stark!'
    )
  )
) FROM foundation_kurse k WHERE k.kurs_id = 'kurs_01_prozentrechnung'
ON CONFLICT (kurs_id, position) DO NOTHING;

-- ── Kontrolle ─────────────────────────────────────────────────────────────────
SELECT k.kurs_id, k.titel, COUNT(f.id) AS folien
FROM foundation_kurse k
LEFT JOIN foundation_folien f ON f.kurs_id = k.id
GROUP BY k.id, k.kurs_id, k.titel
ORDER BY k.sort_order;
