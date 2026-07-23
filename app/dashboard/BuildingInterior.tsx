'use client'
// app/dashboard/BuildingInterior.tsx
// Erstellt:     20.07.2026
// Aktualisiert: 20.07.2026 — Gebäude-Detailansicht (Innenraum-Panel)
// Version:      1.0.0
//
// Zeigt den Innenraum eines Gebäudes als Detailansicht.
// Inhalt ist Projektion des Weltzustands — keine eigene Logik.
// Ersetzt vorübergehend die rechte Sidebar wenn ein Gebäude betreten wird.

import React from 'react'

interface TileEntity {
  id:          string
  entity_id:   string
  entity_type: string
  tile_row:    number
  tile_col:    number
  profile_id:  string | null
  owner_class: string
  actor_name?: string | null
  username?:   string | null
  asking_price?: number | null
  lease_price?:  number | null
}

interface LocationResource {
  resource:    string
  stock:       number
  production:  number
  consumption: number
}

interface Props {
  entity:            TileEntity
  userId:            string
  locationResources: LocationResource[]
  credits:           number
  population:        number
  onClose:           () => void
}

// Gebäude-spezifische Innenraum-Beschreibungen
const INTERIOR: Record<string, {
  icon:   string
  title:  string
  rooms:  string[]
  desc:   (ctx: { stock?: number; production?: number; isOwn: boolean; population: number; credits: number }) => string
}> = {
  habitat: {
    icon:  '🏠',
    title: 'Wohnhabitat',
    rooms: ['Eingangsschleuse', 'Gemeinschaftsraum', 'Wohneinheiten', 'Wartungsgang'],
    desc:  ({ population }) =>
      `${Math.min(100, Math.ceil(population / 10))} von 100 Plätzen belegt. ` +
      `Druckluft: nominal. Temperatur: 21°C.`,
  },
  mine: {
    icon:  '⛏',
    title: 'Bergwerk',
    rooms: ['Stollen-Eingang', 'Förderanlage', 'Abbauhalle', 'Schleuse'],
    desc:  ({ stock, production }) =>
      `Förderung: ${production ?? 0}t Metall/Tick. ` +
      `Lager: ${stock ?? 0}t. ` +
      `Stollen aktiv.`,
  },
  solar: {
    icon:  '☀️',
    title: 'Solaranlage',
    rooms: ['Kontrollraum', 'Inverter-Bank', 'Pufferspeicher'],
    desc:  ({ production }) =>
      `Produktion: ${production ?? 0}t Energie/Tick. ` +
      `Paneele: optimal ausgerichtet. Staubfilter: aktiv.`,
  },
  landing_pad: {
    icon:  '🛬',
    title: 'Landepad',
    rooms: ['Kontrollturm', 'Pad-Fläche', 'Frachtschleuse', 'Tanklager'],
    desc:  ({ isOwn }) =>
      isOwn
        ? 'Dein Pad. Anflugkorridor frei. Treibstoff: verfügbar.'
        : 'Staatliches Pad. Landegebühr fällig. Slot buchbar.',
  },
  docking_bay: {
    icon:  '🛸',
    title: 'Andockbucht',
    rooms: ['Luftschleuse', 'Docktunnel', 'Frachtübergabe'],
    desc:  () => 'Andockkorridor bereit. Magnetkupplungen aktiv.',
  },
  bank: {
    icon:  '🏦',
    title: 'Koloniebank',
    rooms: ['Empfang', 'Beratungsraum', 'Tresorraum', 'Serverraum'],
    desc:  ({ credits }) =>
      `Kontostand: ${credits.toLocaleString()} Cr. ` +
      `Zinssatz: 1.2%/Tick. Kreditrahmen verfügbar.`,
  },
  school: {
    icon:  '🏫',
    title: 'Akademie',
    rooms: ['Hörsaal', 'Laborbereich', 'Bibliothek', 'SSF-Terminal'],
    desc:  () =>
      'SSF-Module verfügbar. Nächste Vorlesung: Orbital-Mechanik. ' +
      'Terminal zur Solar Science Foundation aktiv.',
  },
  warehouse: {
    icon:  '📦',
    title: 'Warenlager',
    rooms: ['Laderampe', 'Hauptlager', 'Kühlsektion', 'Büro'],
    desc:  ({ stock }) =>
      `Lagerbestand: ${stock ?? 0}t gesamt. ` +
      `Kapazität: 500t. Temperaturen nominal.`,
  },
  shipyard: {
    icon:  '⚙️',
    title: 'Werft',
    rooms: ['Empfangshalle', 'Montagehalle', 'Teststand', 'Büros'],
    desc:  () =>
      'Neue Schiffe verfügbar. Montage-Roboter aktiv. ' +
      'Wartezeit für Mk.I: sofort.',
  },
  admin: {
    icon:  '🏛',
    title: 'Verwaltung',
    rooms: ['Empfang', 'Büros', 'Konferenzraum', 'Archiv'],
    desc:  ({ population }) =>
      `Verwaltung für ${population.toLocaleString()} Einwohner. ` +
      `Offene Anträge: 0.`,
  },
  command_center: {
    icon:  '📡',
    title: 'Kontrollzentrum',
    rooms: ['Kontrollraum', 'Kommunikation', 'Serverraum', 'Konferenz'],
    desc:  () =>
      'Alle Systeme nominal. Orbitalverbindung: aktiv. ' +
      'Nächste Kommunikation: Erde +8min.',
  },
}

const DEFAULT_INTERIOR = {
  icon: '🏗', title: 'Gebäude',
  rooms: ['Eingang', 'Hauptraum'],
  desc: () => 'Gebäude in Betrieb.',
}

export default function BuildingInterior({
  entity, userId, locationResources, credits, population, onClose,
}: Props) {
  const def = INTERIOR[entity.entity_id] ?? DEFAULT_INTERIOR
  const isOwn   = entity.profile_id === userId
  const isState = entity.owner_class === 'STATE'
  const ownerLabel = isOwn ? '🔑 Dein Gebäude'
    : isState ? '🏛 Staatlich'
    : `👤 ${entity.actor_name ?? entity.username ?? 'Fremd'}`

  // Weltzustand: Ressource für dieses Gebäude
  const res = locationResources.find(r =>
    (entity.entity_id === 'mine'  && r.resource === 'metal') ||
    (entity.entity_id === 'solar' && r.resource === 'energy') ||
    (entity.entity_id === 'warehouse' && r.resource === 'water')
  )

  const desc = def.desc({
    stock: res?.stock, production: res?.production, isOwn, population, credits,
  } as any)

  const T = {
    bg:     '#f8f5ee',
    border: '#ddd6c8',
    text:   '#1a1a18',
    muted:  '#6b6357',
    faint:  '#9e9485',
    blue:   '#2a4e7a',
    gold:   '#c9a961',
  }

  return (
    <div style={{
      background: T.bg, border: `1px solid ${T.border}`,
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    }}>
      {/* Header */}
      <div style={{
        background: T.blue, color: '#fff',
        padding: '0.75rem 1rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '0.58rem', opacity: 0.7, letterSpacing: '0.15em',
            textTransform: 'uppercase' as const, fontFamily: 'monospace' }}>
            Innenansicht
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: 2 }}>
            {def.icon} {def.title}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.15)', border: 'none',
          color: '#fff', borderRadius: 6, padding: '4px 10px',
          cursor: 'pointer', fontSize: '0.75rem',
        }}>✕ Verlassen</button>
      </div>

      <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {/* Eigentümer */}
        <div style={{ fontSize: '0.68rem', color: T.muted }}>{ownerLabel}</div>

        {/* Zustandsbeschreibung — aus Weltzustand */}
        <div style={{
          padding: '0.6rem 0.75rem',
          background: 'rgba(42,78,122,0.06)',
          border: `1px solid ${T.border}`,
          borderRadius: 8, fontSize: '0.75rem', color: T.text, lineHeight: 1.6,
        }}>
          {desc}
        </div>

        {/* Räume */}
        <div>
          <div style={{ fontSize: '0.58rem', color: T.faint, textTransform: 'uppercase' as const,
            letterSpacing: '0.15em', fontFamily: 'monospace', marginBottom: 6 }}>
            Bereiche
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {def.rooms.map((room, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px', borderRadius: 6,
                background: i === 0 ? 'rgba(42,78,122,0.08)' : 'transparent',
                border: `1px solid ${i === 0 ? T.border : 'transparent'}`,
                fontSize: '0.72rem', color: i === 0 ? T.blue : T.muted,
              }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.6rem',
                  color: T.faint, width: 16 }}>
                  {i === 0 ? '▶' : '·'}
                </span>
                {room}
                {i === 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.6rem',
                    color: T.faint, fontStyle: 'italic' }}>Du bist hier</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Ressource-Daten wenn vorhanden */}
        {res && (
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '0.5rem 0.75rem', background: 'rgba(42,78,122,0.04)',
            border: `1px solid ${T.border}`, borderRadius: 8,
          }}>
            {[
              ['Ressource', res.resource],
              ['Lager', `${res.stock}t`],
              ['Produktion', `+${res.production}t/Tick`],
            ].map(([k, v]) => (
              <div key={k} style={{ textAlign: 'center' as const }}>
                <div style={{ fontSize: '0.58rem', color: T.faint }}>{k}</div>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: T.blue }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {/* Verlassen-Button */}
        <button onClick={onClose} style={{
          padding: '0.5rem', background: 'none',
          border: `1px solid ${T.border}`, borderRadius: 8,
          cursor: 'pointer', fontSize: '0.72rem', color: T.muted,
          marginTop: 4,
        }}>
          ← Zurück zur Straße
        </button>
      </div>
    </div>
  )
}
