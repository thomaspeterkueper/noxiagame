import React from 'react'
import {
  canBuild,
  getAvailableLearningModules,
  getUnlockedBuildings,
  initialKnowledgeProgress,
  knowledgeBuildings,
  learningModules,
  completeLearningModule,
} from '@/lib/knowledge';
import type { LearningModuleId } from '@/lib/knowledge';

const completedDemoModules: LearningModuleId[] = [
  'LRN:SSF:MAT-1001',
  'LRN:SSF:MAT-1002',
  'LRN:SSF:PHY-1201',
  'LRN:SSF:PHY-1101',
];

const demoProgress = completedDemoModules.reduce(
  (progress, moduleId) => completeLearningModule(progress, moduleId),
  initialKnowledgeProgress,
);

const tree: { title: string; modules: LearningModuleId[] }[] = [
  { title: 'Mathematik', modules: ['LRN:SSF:MAT-1001', 'LRN:SSF:MAT-1002', 'LRN:SSF:MAT-1201'] },
  { title: 'Physik', modules: ['LRN:SSF:PHY-1101', 'LRN:SSF:PHY-1201', 'LRN:SSF:PHY-1301', 'LRN:SSF:PHY-1302'] },
  { title: 'Astronomie', modules: ['LRN:SSF:AST-2101', 'LRN:SSF:AST-1201'] },
  { title: 'Chemie', modules: ['LRN:SSF:CHE-1101', 'LRN:SSF:CHE-1301'] },
  { title: 'Biologie', modules: ['LRN:SSF:BIO-1101', 'LRN:SSF:BIO-1201'] },
  { title: 'Technik', modules: ['LRN:SSF:TEC-1101', 'LRN:SSF:TEC-1201'] },
];

export default function KnowledgePage() {
  const availableModules = getAvailableLearningModules(demoProgress);
  const unlockedBuildings = getUnlockedBuildings(demoProgress);
  const moduleById = new Map(learningModules.map((module) => [module.id, module]));

  return (
    <main style={{ minHeight: '100vh', background: '#050910', color: '#d9e6f2', padding: '48px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ maxWidth: 1150, margin: '0 auto' }}>
        <p style={{ color: '#8a6d2b', letterSpacing: 3, textTransform: 'uppercase' }}>NOXIA · Knowledge</p>
        <h1 style={{ fontSize: '2.4rem', marginBottom: 12 }}>Wissen, Forschung und Gebäude</h1>
        <p style={{ color: '#9fb3c8', maxWidth: 780, lineHeight: 1.6 }}>
          Gebäude werden nicht nach Level freigeschaltet, sondern durch abgeschlossene Lernmodule der Solar Science Foundation.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 32 }}>
          <Card title="Abgeschlossene Module" value={demoProgress.completedModules.length} />
          <Card title="Aktive Unlocks" value={demoProgress.unlocked.length} />
          <Card title="Freigeschaltete Gebäude" value={unlockedBuildings.length} />
          <Card title="Nächste Module" value={availableModules.length} />
        </div>

        <h2 style={{ marginTop: 40 }}>Forschungsbaum V1</h2>
        <Grid>
          {tree.map((branch) => (
            <Panel key={branch.title}>
              <strong>{branch.title}</strong>
              {branch.modules.map((id) => {
                const module = moduleById.get(id);
                const done = demoProgress.completedModules.includes(id);
                const available = availableModules.some((candidate) => candidate.id === id);
                return (
                  <div key={id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                    <div>{done ? '✓' : available ? '◇' : '🔒'} {module?.name ?? id}</div>
                    <small>{id}</small>
                  </div>
                );
              })}
            </Panel>
          ))}
        </Grid>

        <h2 style={{ marginTop: 40 }}>Gebäudeprüfung</h2>
        <Grid>
          {knowledgeBuildings.map((building) => {
            const check = canBuild(building.id, demoProgress);
            return (
              <Panel key={building.id}>
                <strong>{check.canBuild ? '✓' : '🔒'} {building.name}</strong>
                <small>{building.id}</small>
                <p>{check.canBuild ? 'Baubar' : 'Noch gesperrt'}</p>
                {!check.canBuild && check.missingModules.length > 0 && <p>Fehlt: {check.missingModules.join(', ')}</p>}
              </Panel>
            );
          })}
        </Grid>
      </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return <div style={{ border: '1px solid rgba(120,150,180,0.25)', borderRadius: 16, padding: 20, background: 'rgba(255,255,255,0.04)' }}><div style={{ color: '#9fb3c8', fontSize: 14 }}>{title}</div><div style={{ fontSize: 32, marginTop: 8 }}>{value}</div></div>;
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>{children}</div>;
}

function Panel({ children }: { children: React.ReactNode; key?: string }) {
  return <div style={{ border: '1px solid rgba(120,150,180,0.2)', borderRadius: 12, padding: 16, background: 'rgba(255,255,255,0.035)' }}><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div></div>;
}
