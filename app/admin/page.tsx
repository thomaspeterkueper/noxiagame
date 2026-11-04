import Link from 'next/link'

const sections = [
  {
    href: '/admin/wuensche',
    title: 'Wünsche und Gebete',
    description: 'Wünsche von Spielern und Figuren einsehen, prüfen und bearbeiten.',
  },
]

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#f6f4ee] px-4 py-10 text-[#1d2a30]">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <p className="text-sm font-semibold tracking-wide text-[#53777a]">noχ¹ᐃ · Verwaltung</p>
          <h1 className="mt-2 text-3xl font-bold">Adminbereich</h1>
          <p className="mt-3 text-sm text-[#5d6b70]">
            Verwaltungsfunktionen für berechtigte Konten. Für die Bearbeitung von
            Spieldaten ist zusätzlich zur Zugangssperre eine gültige
            Spielanmeldung mit Adminberechtigung erforderlich.
          </p>
        </header>
        <nav aria-label="Adminfunktionen" className="grid gap-4 sm:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-xl border border-[#dcd7ca] bg-white p-5 shadow-sm transition hover:border-[#53777a] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f4f54]"
            >
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm text-[#5d6b70]">{section.description}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-[#1f4f54]">
                Öffnen →
              </span>
            </Link>
          ))}
        </nav>
        <p className="mt-8 text-xs text-[#5d6b70]">
          Weitere Verwaltungsfunktionen werden hier ergänzt, sobald sie verfügbar sind.
        </p>
      </div>
    </main>
  )
}
