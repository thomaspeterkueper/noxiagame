import type { ReactNode } from 'react'
import Link from 'next/link'
import { fetchSsfKnowledgeModules } from '@/lib/ssfKnowledge'
import SsfModuleActions from './SsfModuleActions'

export const revalidate = 300

export default async function Page() {
  const modules = await fetchSsfKnowledgeModules()

  return (
    <main style={{ minHeight: '100vh', background: '#050910', color: '#d9e6f2', padding: '48px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ maxWidth: 1150, margin: '0 auto' }}>
        <Link href="/dashboard" style={{ color: '#c9a961', textDecoration: 'none', fontWeight: 700 }}>Zurueck zum Dashboard</Link>
        <p style={{ color: '#8a6d2b', letterSpacing: 3, textTransform: 'uppercase', marginTop: 32 }}>Solar Science Foundation</p>
        <h1 style={{ fontSize: '2.4rem', marginBottom: 12 }}>SSF Wissensmodule in NOXIA</h1>
        <p style={{ color: '#9fb3c8', maxWidth: 780, lineHeight: 1.6 }}>
          NOXIA liest diese Module direkt aus der Solar Science Foundation. Lernfortschritt aus SSF wird als Modulfortschritt gespeichert und kann spaeter Spiel-Freischaltungen ausloesen.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginTop: 32 }}>
          {modules.length === 0 ? (
            <Panel>
              <strong>Keine SSF-Module erreichbar</strong>
              <small>Pruefe SSF-Deploy und die NOXIA-Variable SSF_BASE_URL.</small>
            </Panel>
          ) : modules.map((module) => (
            <Panel key={module.id}>
              <strong>{module.title}</strong>
              <small>{module.id}</small>
              <small>{module.domain} · {module.durationMinutes} min · Schwierigkeit {module.difficulty}</small>
              <p style={{ color: '#9fb3c8', lineHeight: 1.5 }}>{module.summary}</p>
              {module.unlocks.length > 0 && <small>Unlock: {module.unlocks.join(', ')}</small>}
              <a href={module.ssfUrl} target="_blank" rel="noreferrer" style={{ color: '#c9a961', textDecoration: 'none', fontWeight: 700 }}>In SSF lernen</a>
              <SsfModuleActions moduleId={module.id} />
            </Panel>
          ))}
        </div>
      </section>
    </main>
  )
}

function Panel({ children }: { children: ReactNode; key?: string }) {
  return <article style={{ border: '1px solid rgba(120,150,180,0.2)', borderRadius: 12, padding: 16, background: 'rgba(255,255,255,0.035)', display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</article>
}
