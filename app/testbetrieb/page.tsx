import Link from 'next/link'

export default function TestbetriebInformation() {
  return <main className="min-h-screen bg-[#f6f4ee] px-5 py-10 text-[#1d2a30]">
    <article className="mx-auto max-w-3xl rounded-xl border bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#1f4f54]">NOXIAGAME · Testbetrieb</p>
      <h1 className="mt-2 text-3xl font-bold">Gespräche in der Testphase</h1>
      <p className="mt-4">NOXIAGAME ist eine noch in Entwicklung befindliche simulierte Welt. NPC-Gespräche können zu Zwecken der technischen Analyse und Verbesserung vollständig protokolliert werden. Dabei kann der Projektbetreiber deine Eingaben, Antworten der NPCs und die daraus erkannten Themen, Aktionen und Fehler im geschützten Adminbereich lesen.</p>
      <h2 className="mt-6 text-lg font-semibold">Was wird erfasst?</h2>
      <p className="mt-2">Spieler- und NPC-Nachrichten, Zeitpunkte, NPC, Spielort, Gesprächsausgang, erkannte Wünsche und technische Aktionshinweise. Nur angemeldete Administratoren können die Diagnoseansicht nutzen; ihre Abrufe werden protokolliert. Die Aufzeichnung betrifft ausschließlich Spielinteraktionen, keine Gespräche außerhalb von NOXIAGAME.</p>
      <h2 className="mt-6 text-lg font-semibold">Zweck und Grenzen</h2>
      <p className="mt-2">Ziel sind Reproduktion und Behebung von Fehlern sowie die Verbesserung von NPC-Sprache, Gedächtnis, Verhalten und Simulation. Die Daten dürfen nicht für eine Bewertung oder öffentliche Bloßstellung von Testspielern verwendet werden. Bitte gib keine realen Passwörter, Adressen, Finanzdaten oder vertrauliche Informationen ein.</p>
      <h2 className="mt-6 text-lg font-semibold">Datenschutz</h2>
      <p className="mt-2">Vor Freischaltung der wörtlichen Adminauswertung muss der Betreiber die konkrete Rechtsgrundlage, eine dokumentierte Interessenabwägung und Aufbewahrungs-/Löschregeln festlegen. Ohne diese Voraussetzungen bleibt die Adminauswertung technisch deaktiviert. Für Auskunft, Löschung oder Widerspruch nutze die Kontaktmöglichkeit des Spielbetreibers in den allgemeinen Datenschutzhinweisen. Es wird kein eigener Einwilligungsklick für jedes Gespräch verlangt.</p>
      <p className="mt-4 text-sm text-[#5d6b70]">Der Projektbetreiber muss diese Hinweise mit seiner vollständigen Datenschutzerklärung einschließlich Kontaktdaten, Rechtsgrundlage, Speicherdauer und Betroffenenrechten abstimmen. Diese Seite allein ersetzt keine vollständige Datenschutzerklärung.</p>
      <Link href="/dashboard" className="mt-7 inline-block rounded-lg border px-4 py-2 text-sm font-semibold">Zurück zum Spiel</Link>
    </article>
  </main>
}
