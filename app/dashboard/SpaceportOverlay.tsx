'use client'

interface SpaceportOverlayProps {
  buildingTypeId: string
  buildingName: string
  onClose: () => void
  onOpenNavigation: () => void
  onOpenMaintenance: () => void
  onOpenCargo: () => void
}

type ActionId = 'navigation' | 'maintenance' | 'cargo'

type ActionDef = {
  id: ActionId
  icon: string
  title: string
  text: string
  button: string
}

const ACTIONS: Record<ActionId, ActionDef> = {
  navigation: {
    id: 'navigation',
    icon: '🧭',
    title: 'Abflug & Navigation',
    text: 'Reiseziel wählen, Flugplanung öffnen und den nächsten Abflug vorbereiten.',
    button: 'Navigation öffnen',
  },
  maintenance: {
    id: 'maintenance',
    icon: '🛠️',
    title: 'Wartung & Werft',
    text: 'Schiff, Module und technische Arbeiten über die vorhandene Werftfunktion verwalten.',
    button: 'Wartung öffnen',
  },
  cargo: {
    id: 'cargo',
    icon: '📦',
    title: 'Fracht & Handel',
    text: 'Frachtumschlag, Markt und offene Handelsaufträge am Standort öffnen.',
    button: 'Fracht öffnen',
  },
}

function actionOrder(buildingTypeId: string): ActionId[] {
  if (buildingTypeId === 'spaceport_service') return ['maintenance', 'navigation', 'cargo']
  if (buildingTypeId === 'spaceport_storage') return ['cargo', 'navigation', 'maintenance']
  if (buildingTypeId.includes('pad') || buildingTypeId === 'landing_pad') return ['navigation', 'maintenance', 'cargo']
  return ['navigation', 'maintenance', 'cargo']
}

export default function SpaceportOverlay({
  buildingTypeId,
  buildingName,
  onClose,
  onOpenNavigation,
  onOpenMaintenance,
  onOpenCargo,
}: SpaceportOverlayProps) {
  const run = (id: ActionId) => {
    onClose()
    if (id === 'navigation') onOpenNavigation()
    if (id === 'maintenance') onOpenMaintenance()
    if (id === 'cargo') onOpenCargo()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2200,
        background: 'rgba(2,7,12,.84)', display: 'grid', placeItems: 'center', padding: '1rem',
      }}
      onClick={event => event.target === event.currentTarget && onClose()}
    >
      <div style={{
        width: 'min(760px, 96vw)', maxHeight: '90vh', overflow: 'auto',
        background: '#eef1ed', border: '1px solid #79909a', borderRadius: 14,
        boxShadow: '0 18px 60px rgba(0,0,0,.48)', color: '#19313c',
      }}>
        <header style={{
          padding: '1rem 1.2rem', background: '#102b38', color: '#edf4f1',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
        }}>
          <div>
            <small style={{ display: 'block', color: '#d8bd68', fontSize: 10, fontWeight: 800, letterSpacing: '.14em' }}>
              RAUMHAFEN · FUNKTIONSZENTRALE
            </small>
            <strong style={{ display: 'block', marginTop: 4, fontSize: 19 }}>{buildingName}</strong>
            <span style={{ display: 'block', marginTop: 4, color: '#9fb6be', fontSize: 11 }}>{buildingTypeId}</span>
          </div>
          <button onClick={onClose} aria-label="Raumhafen schließen" style={{ border: 0, background: 'transparent', color: '#d8e3e5', fontSize: 22, cursor: 'pointer' }}>×</button>
        </header>

        <div style={{ padding: '1rem 1.2rem 1.2rem' }}>
          <p style={{ margin: '0 0 1rem', color: '#50656d', fontSize: 12, lineHeight: 1.55 }}>
            Dieser Raumhafen ist Teil des persistierten Weltzustands. Die folgenden Zugänge öffnen die bereits vorhandenen NOXIA-Systeme; sie erzeugen keinen separaten Raumhafen-Zustand.
          </p>

          <div style={{ display: 'grid', gap: 10 }}>
            {actionOrder(buildingTypeId).map((id, index) => {
              const action = ACTIONS[id]
              return (
                <section key={id} style={{
                  display: 'grid', gridTemplateColumns: '46px minmax(0,1fr) auto', gap: 12, alignItems: 'center',
                  background: index === 0 ? '#fff8df' : '#f9faf7',
                  border: `1px solid ${index === 0 ? '#c4a451' : '#c9d1ce'}`,
                  borderRadius: 10, padding: '12px 13px',
                }}>
                  <div style={{ fontSize: 27, textAlign: 'center' }}>{action.icon}</div>
                  <div>
                    <strong style={{ display: 'block', fontSize: 13 }}>{action.title}</strong>
                    <span style={{ display: 'block', marginTop: 3, color: '#607178', fontSize: 10, lineHeight: 1.45 }}>{action.text}</span>
                  </div>
                  <button onClick={() => run(id)} style={{
                    border: '1px solid #476b79', background: index === 0 ? '#b48a26' : '#183e4d', color: '#fff',
                    borderRadius: 7, padding: '8px 10px', fontSize: 10, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>
                    {action.button} →
                  </button>
                </section>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
