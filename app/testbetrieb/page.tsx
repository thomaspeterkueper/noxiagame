import Link from 'next/link'

// NOXIA-PRIVACY-0004 (05.11.2026): Gespräche werden nur automatisch ausgewertet.
// NOXIA-SAFETY-0001: Schutzfilter gegen Realwelt-Kriminalität (mehrsprachig, KI-Prüfung). NOXIA-LEARN-0001: Figuren lernen.

export default function TestbetriebInformation() {
  return <main className="min-h-screen bg-[#f6f4ee] px-5 py-10 text-[#1d2a30]">
    <article className="mx-auto max-w-3xl rounded-xl border bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#1f4f54]">NOXIAGAME · Testbetrieb</p>
      <h1 className="mt-2 text-3xl font-bold">Gespräche in NOXIA</h1>
      <p className="mt-4 text-lg">Gespräche in NOXIA werden automatisch ausgewertet, um die Welt und ihre Figuren zu verbessern. Kein Mensch liest sie – außer ein automatischer Schutzfilter erkennt den Verdacht auf Straftaten in der realen Welt. NPCs merken sich in Kurzform, was ihr miteinander erlebt habt, und lernen aus dem, was ihr über die Welt erzählt. Wenn du willst, dass wir ein Gespräch ansehen, nutze „Gespräch melden“.</p>

      <h2 className="mt-6 text-lg font-semibold">Was ausgewertet wird</h2>
      <p className="mt-2">Gespräche mit NPCs und Nachrichten an andere Spieler – im Raum und im Freundes-Chat. Ein Programm erkennt daraus Themen, Gesprächsausgang, Fehler der Figuren, Wünsche und ausgelöste Aktionen in der Spielwelt. Das Team sieht davon nur zusammengefasste Zahlen, und zwar erst, wenn mindestens fünf verschiedene Spieler beteiligt sind – nie, was ein einzelner Spieler gesagt hat.</p>

      <h2 className="mt-6 text-lg font-semibold">Was nicht passiert</h2>
      <p className="mt-2">Es gibt im Adminbereich keine Ansicht, keinen Export und keine Schnittstelle, über die der Wortlaut deiner Gespräche gelesen werden kann. Die Datenbankrechte sind entsprechend gesetzt; die Zusage ist technisch umgesetzt, nicht nur versprochen.</p>

      <h2 className="mt-6 text-lg font-semibold">Spiel ist Spiel – reale Straftaten nicht</h2>
      <p className="mt-2">In NOXIA darfst du frei sprechen: schmuggeln, intrigieren, streiten, Grenzen testen – das gehört zur Welt, und die Figuren reagieren darauf, ohne zu moralisieren. NOXIA darf aber nicht genutzt werden, um Straftaten in der realen Welt zu verabreden. Ein automatischer Schutzfilter achtet darauf, wenn mehrere Hinweise zusammenkommen, etwa reale Drogen oder Waffen mit Geldweg, Gewalt mit Bezug zur echten Welt oder Annäherung an Minderjährige mit Geheimhaltung. Der Filter versteht mehrere Sprachen und achtet auch auf Muster wie Preise in echter Währung – im Spiel zahlt man nur in Credits. Auffällige Ausschnitte aus Gesprächen zwischen Spielern prüft zusätzlich eine KI im Zusammenhang, ohne eure Spielernamen; gespeichert wird dabei nur ihr Ergebnis. Nur wenn sich ein Verdacht ergibt, wird der betreffende Ausschnitt gesichert und von uns geprüft. </p>

      <h2 className="mt-6 text-lg font-semibold">Persönliche Daten werden ausgeblendet</h2>
      <p className="mt-2">Telefonnummern, E-Mail-Adressen, Links, Messenger-Namen, Kontonummern sowie Angaben zu Wohnadresse, Geburtsdatum, echtem Namen oder Schule werden überall durch „xxx“ ersetzt – in Gesprächen mit Figuren, im Raum- und Freundes-Chat und in frei wählbaren Namen. Gespeichert wird nur die ausgeblendete Fassung. Gespräche, in denen echtes Geld, Bezahldienste oder Krypto vorkommen, werden nicht nach 14 Tagen gelöscht, sondern ein Jahr verwahrt – ebenfalls ausgeblendet und ohne dass jemand sie liest, solange kein Verdacht besteht.</p>

      <h2 className="mt-6 text-lg font-semibold">Was Figuren lernen</h2>
      <p className="mt-2">Was du Figuren über die Welt erzählst, können sie sich merken und anderen weitererzählen – als Gerücht, ohne zu sagen, von wem es stammt. Persönliches über dich oder dein Gegenüber, Fragen und Kontaktdaten übernehmen sie nicht. Vergessen wird ab der letzten Erwähnung: Was nur eine Person erzählt, bleibt unbestätigt und ist einen Monat nach dem letzten Mal vergessen; was mehrere unabhängig erzählen, ein halbes Jahr nach dem letzten Mal. Wird etwas immer wieder erzählt, bleibt es. Was mindestens drei Menschen über Wochen hinweg erzählen, wird festes Wissen der Figur und nicht mehr vergessen.</p>

      <h2 className="mt-6 text-lg font-semibold">Wie lange etwas bleibt</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Der Wortlaut von Gesprächen wird nach 14 Tagen automatisch gelöscht. Die daraus gewonnenen Kennzahlen bleiben.</li>
        <li>NPCs behalten eine gekürzte Erinnerung an eure gemeinsamen Gespräche – das gehört zum Spiel und zu ihrer Lebensgeschichte. Diese Erinnerung ist für das Team nicht einsehbar. Löschst du dein Konto, bleibt sie Teil der Biografie der Figur, aber ohne Verbindung zu deinem Konto.</li>
        <li>Was Figuren über die Welt gelernt haben, vergessen sie ab der letzten Erwähnung (siehe oben); auch das bleibt nach einer Kontolöschung ohne Verbindung zu dir erhalten.</li>
        <li>Gemeldete und vom Schutzfilter gesicherte Ausschnitte werden nach 90 Tagen gelöscht.</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold">Gespräch melden</h2>
      <p className="mt-2">Unter jedem NPC-Gespräch und neben Nachrichten anderer Spieler findest du „melden“. Dann werden die letzten Sätze dieses Gesprächs an das Team geschickt und sind für das Team lesbar – nur dieser Ausschnitt, nur weil du es so willst. Nutze das bei Fehlern der Figuren, bei unangenehmen Erlebnissen oder wenn du uns etwas zeigen möchtest.</p>

      <h2 className="mt-6 text-lg font-semibold">Testkonten des Teams</h2>
      <p className="mt-2">Das Team prüft Figuren mit eigenen, gekennzeichneten Testkonten. Nur deren Gespräche sind vollständig lesbar.</p>

      <h2 className="mt-6 text-lg font-semibold">Datenschutz</h2>
      <p className="mt-2">Für die Antworten der Figuren und für die Prüfung auffälliger Ausschnitte werden Nachrichten an einen KI-Dienst (Anthropic, USA) übermittelt. Allgemeine Hinweise stehen in der <Link className="underline" href="/datenschutz">Datenschutzerklärung</Link>. Bitte gib keine Passwörter, Adressen, Finanzdaten oder andere vertrauliche Angaben ein. Für Auskunft, Löschung oder Widerspruch nutze die Kontaktmöglichkeit dort.</p>

      <Link href="/dashboard" className="mt-7 inline-block rounded-lg border px-4 py-2 text-sm font-semibold">Zurück zum Spiel</Link>
    </article>
  </main>
}
