# Missbrauchsschutz – Prüfung vom 29.10.2026

Auftrag Thomas: „prüfen, wie wir verhindern können, dass unser Spiel für illegale Absprachen oder so in der realen Welt missbraucht wird, oder Jugendliche Spieler in der echten Welt in Fallen gelockt werden“. Prüfung des Codes (nur lesend), anschließend zwei Sofortmaßnahmen.

## Befund

**Kontaktwege zwischen Spielern**
- **Direktnachrichten** (`app/api/game/chat/route.ts`, Tabelle `chat_messages`): Freitext bis 500 Zeichen, sofort zugestellt (Ably). Der Server prüft nicht, ob beide befreundet sind – die Oberfläche zeigt den Chat nur Freunden, die API nimmt jeden Empfänger. Kein Filter außer der Länge.
- **Freunde** (`app/api/game/friends/route.ts`): Suche findet jeden Spieler über Teile des Namens; Anfragen an jeden.
- **Echtzeit** (Ably): Spieler können nur empfangen, nicht senden. Der Kanal `noxia:transactions` verbreitet Spielername und Ort jeder Transaktion an alle.
- **Namen, die andere sehen:** Spielername (2–20 Zeichen; über die Datenbankregel direkt änderbar), Koloniename (keine Höchstlänge, kein Filter), Ortsbezeichnungen (240 Zeichen). Eine Telefonnummer passt in jedes dieser Felder.
- **NPC-Gespräche:** getrennt je Spieler und Figur; dass Figuren Nachrichten zwischen Spielern weitertragen, gibt es nicht. Der Gesprächsauftrag verbietet aber noch nicht, nach Wohnort, Schule, Alter oder Telefon zu fragen oder echte Treffen vorzuschlagen.

**Reale Orte**
- Gekaufte echte Häuser stehen mit dem **Spielernamen des Eigentümers** an der realen Adresse auf der Karte (`api/world-lab/buildings`). Kauft jemand sein eigenes Wohnhaus, verbindet das Namen und Wohnadresse. Eigentümer-Tabellen (`tile_entities`, `earth_parcel_owners`, `earth_property_listings`) und `profiles` (mit Guthaben, Ort, Reisestatus) sind ohne Anmeldung lesbar.
- Alle neuen Spieler beginnen im selben realen Café im Sauerland – ein bekannter Treffpunkt.
- Keine Live-Positionen anderer Spieler, keine Geräteortung.

**Was fehlt**
- Keine Altersangabe, keine Altersstufe (die frühere `age_range` wurde aus Datenschutzgründen entfernt).
- Kein Melden, kein Blockieren, keine Moderation.
- Kein Filter für Telefonnummern, E-Mail, Messenger-Namen, Links, Treffvorschläge.
- Keine Ratenbegrenzung für Chat, Freundschaftsanfragen, Suche.
- Chat-Nachrichten verschwinden, wenn der Absender sein Konto löscht – Beweise gehen verloren.

## Sofort behoben (29.10.2026)

- **Fremde Chats lesbar:** Die Chat-Historie baute die Spieler-ID ungeprüft in einen Datenbankfilter, der mit Server-Rechten lief. Mit einer präparierten ID ließen sich vermutlich alle Chats lesen. Jetzt werden nur echte IDs angenommen – ebenso beim Senden und bei Freundschaftsanfragen (`chat/route.ts`, `friends/route.ts`).

## Empfohlen, noch nicht umgesetzt

**Vor einem öffentlichen Start (Pflicht)**
1. **Chat-Rechte in der Datenbank:** Spieler können heute mit dem eigenen Schlüssel Nachrichten direkt eintragen (an der API vorbei) und als Empfänger jede Spalte ändern, also Inhalt oder Absender fälschen. Lösung: Eintragen und Ändern nur noch über den Server (die Migration lag bereit, wurde am 29.10. aber nicht freigegeben). Nachrichten beim Löschen des Kontos aufbewahren (Frist festlegen).
2. **Chat nur unter Freunden** – serverseitig prüfen.
3. **Altersstufe bei der Registrierung** (nur „unter 16 / 16–17 / ab 18“ als Kennzeichen). Unter 18: kein Chat mit Fremden, keine Freundessuche nach außen, Name nie an realen Häusern.
4. **Melden und Blockieren** im Chat und in der Freundesliste; Meldungen landen im Admin-Bereich.
5. **Textfilter** (eine Stelle, `lib/moderation/`): Telefonnummern, E-Mails, Messenger-Namen (WhatsApp, Snapchat, Instagram, Telegram, Discord), Links, Adressen und Treffvorschläge („treffen wir uns“, „komm zu …“) – sperren oder zur Prüfung markieren. Für Chat, Spielernamen, Kolonie- und Ortsbezeichnungen.
6. **Eigentümer nicht namentlich** an realen Häusern („gehört einem anderen Spieler“); Eigentümer- und Profiltabellen nur noch über den Server lesbar.
7. **Ratenbegrenzung** für Chat, Anfragen und Suche.

**Danach**
- Figuren fragen nie nach Wohnort, Schule, Alter, Telefon und schlagen keine echten Treffen vor (Gesprächsauftrag in `npc-conversation`).
- Transaktionen in Echtzeit ohne Spielernamen.
- Moderationsansicht im Admin-Bereich (Meldungen, markierte Nachrichten).
- Getrenntes Startgebiet für Minderjährige erwägen.
- Hinweis an Spieler und Aufbewahrungsregeln für alle Protokolle (Gespräche, Verhalten, Wünsche).

## Bezug zu den Wünschen

Wünsche (NOXIA-WISH-0001) sind für andere Spieler nie sichtbar – kein Kanal zwischen Spielern. Private Anliegen werden nicht angezeigt; bei Hinweisen auf eine Notlage nennt das Spiel Hilfe.
