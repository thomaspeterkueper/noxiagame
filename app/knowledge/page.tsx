import {
  canBuild,
  getAvailableLearningModules,
  getUnlockedBuildings,
  initialKnowledgeProgress,
  knowledgeBuildings,
  learningModules,
  completeLearningModule,
} from '@/lib/knowledge';

const demoProgress = [
  'LRN:SSF:MAT-1001',
  'LRN:SSF:MAT-1002',
  'LRN:SSF:PHY-1201',
  'LRN:SSF:PHY-1101',
].reduce(completeLearningModule, initialKnowledgeProgress);

export default function KnowledgePage() {
  const availableModules = getAvailableLearningModules(demoProgress);
  const unlockedBuildings = getUnlockedBuildings(demoProgress);

  return (
    <main style={{
      minHeight: '100vh',
      background: '#050910',
      color: '#d9e6f2',
      padding: '48px 24px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <section style={{ maxWidth: 1100, margin: '0 auto' }}>
        <p style={{ color: '#8a6d2b', letterSpacing: 3, textTransform: 'uppercase' }}>
          NOXIA · Knowledge Debug
        </p>
        <h1 style={{ fontSize: '2.4rem', marginBottom: 12 }}>
          Wissenspfade und Gebäude-Freischaltungen
        </h1>
        <p style={{ color: '#9fb3c8', maxWidth: 760, lineHeight: 1.6 }}>
          Diese Seite zeigt den ersten technischen Anschluss zwischen Solar Science Foundation und NOXIA.
          Gebäude werden nicht nach Level freigeschaltet, sondern durch abgeschlossene Lernmodule.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 32 }}>
          <Card title="Abgeschlossene Module" value={demoProgress.completedModules.length} />
          <Card title="Aktive Unlocks" value={demoProgress.unlocked.length} />
          <Card title="Freigeschaltete Gebäude" value={unlockedBuildings.length} />
          <Card title="Noch verfügbare Module" value={availableModules.length} />
        </div>

        <h2 style={{ marginTop: 40 }}>Freigeschaltete Gebäude</h2>
        <Grid>
          {unlockedBuildings.map((building) => (
            <Panel key={building.id}>
              <strong>{building.name}</strong>
              <small>{building.id}</small>
              <p>Kategorie: {building.category}</p>
            </Panel>
          ))}
        </Grid>

        <h2 style={{ marginTop: 40 }}>Nächste Lernmodule</h2>
        <Grid>
          {availableModules.map((module) => (
            <Panel key={module.id}>
              <strong>{module.name}</strong>
              <small>{module.id}</small>
              <p>Domäne: {module.domain}</p>
            </Panel>
          ))}
        </Grid>

        <h2 style={{ marginTop: 40 }}>Gebäudeprüfung</h2>
        <Grid>
          {knowledgeBuildings.map((building) => {
            const check = canBuild(building.id, demoProgress);
            return (
              <Panel key={building.id}>
                <strong>{building.name}</strong>
                <small>{building.id}</small>
                <p>{check.canBuild ? 'Baubar' : 'Noch gesperrt'}</p>
                {!check.canBuild && check.missingModules.length > 0 && (
                  <p>Fehlt: {check.missingModules.join(', ')}</p>
                )}
              </Panel>
            );
          })}
        </Grid>

        <h2 style={{ marginTop: 40 }}>Alle Lernmodule im Seed</h2>
        <Grid>
          {learningModules.map((module) => (
            <Panel key={module.id}>
              <strong>{module.name}</strong>
              <small>{module.id}</small>
              <p>Voraussetzungen: {module.requires.length ? module.requires.join(', ') : 'keine'}</p>
            </Panel>
          ))}
        </Grid>
      </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div style={{ border: '1px solid rgba(120,150,180,0.25)', borderRadius: 16, padding: 20, background: 'rgba(255,255,255,0.04)' }}>
      <div style={{ color: '#9fb3c8', fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 32, marginTop: 8 }}>{value}</div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>{children}</div>;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid rgba(120,150,180,0.2)', borderRadius: 12, padding: 16, background: 'rgba(255,255,255,0.035)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}
