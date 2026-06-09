'use client'
// app/colony/[slug]/ColonyView.tsx
// Autarke Colony View — kein DashboardClient, kein gameStore
// Tabs: Übersicht · Markt · Treasury (nur Governor) · Einstellungen (nur Governor)

import { useState, useEffect, useCallback } from 'react'

// ── Typen ────────────────────────────────────────────────────────────────────

interface Location {
  id: string
  name: string
  slug: string
  population: number
  population_max: number
  governor_profile_id: string | null
}

interface Resource {
  resource_type: string
  stock: number
  production: number
  consumption: number
}

interface Price {
  resource_type: string
  buy_price: number
  sell_price: number
}

interface Order {
  id: string
  resource_type: string
  amount: number
  reward: number
  expires_at: string
}

interface Settings {
  tax_property: number
  tax_transaction: number
  tax_landing: number
}

interface Treasury {
  total_income: number | null
  total_expenses: number | null
  balance: number | null
  last_tick: number | null
}

interface TopOwner {
  profile_id: string
  username: string
  count: number
}

interface ColonyData {
  location: Location
  governor: { id: string; username: string } | null
  isGovernor: boolean
  resources: Resource[]
  prices: Price[]
  orders: Order[]
  settings: Settings
  tariffs: { resource_type: string; rate: number }[]
  treasury: Treasury
  topOwners: TopOwner[]
}

interface Props {
  slug: string
  initialLocation: Location
  currentUserId: string | null
  accessToken: string | null
}

// ── Konstanten ───────────────────────────────────────────────────────────────

const RESOURCE_LABELS: Record<string, string> = {
  water: 'Wasser',
  energy: 'Energie',
  metal: 'Metall',
}

const RESOURCE_COLORS: Record<string, string> = {
  water:  '#4a9eff',
  energy: '#ffc947',
  metal:  '#c9a961',
}

// ── Hauptkomponente ──────────────────────────────────────────────────────────

export default function ColonyView({ slug, initialLocation, currentUserId, accessToken }: Props) {
  const [data, setData]     = useState<ColonyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]       = useState<'overview' | 'market' | 'treasury' | 'settings'>('overview')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/colony?slug=${slug}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [slug, accessToken])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <ColonyShell><LoadingState /></ColonyShell>
  if (!data)   return <ColonyShell><div style={styles.error}>Kolonie nicht gefunden.</div></ColonyShell>

  const tabs = [
    { id: 'overview',  label: 'Übersicht' },
    { id: 'market',    label: 'Markt' },
    ...(data.isGovernor ? [
      { id: 'treasury',  label: 'Kasse' },
      { id: 'settings',  label: 'Verwaltung' },
    ] : []),
  ] as const

  return (
    <ColonyShell>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div>
            <div style={styles.headerEyebrow}>Kolonie</div>
            <h1 style={styles.headerTitle}>{data.location.name}</h1>
          </div>
          <div style={styles.headerMeta}>
            {data.governor ? (
              <div style={styles.governorBadge}>
                <span style={styles.governorDot} />
                Verwalter: <strong>{data.governor.username}</strong>
                {data.isGovernor && <span style={styles.youBadge}>Du</span>}
              </div>
            ) : (
              <div style={styles.noGovernor}>Kein aktiver Verwalter</div>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav style={styles.tabBar}>
        {tabs.map(t => (
          <button
            key={t.id}
            style={{ ...styles.tabBtn, ...(tab === t.id ? styles.tabBtnActive : {}) }}
            onClick={() => setTab(t.id as typeof tab)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={styles.content}>
        {tab === 'overview'  && <OverviewTab  data={data} />}
        {tab === 'market'    && <MarketTab    data={data} />}
        {tab === 'treasury'  && data.isGovernor && <TreasuryTab data={data} />}
        {tab === 'settings'  && data.isGovernor && (
          <SettingsTab
            data={data}
            accessToken={accessToken}
            slug={slug}
            onSaved={fetchData}
          />
        )}
      </main>
    </ColonyShell>
  )
}

// ── Shell ────────────────────────────────────────────────────────────────────

function ColonyShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={styles.shell}>
      <div style={styles.container}>{children}</div>
    </div>
  )
}

// ── Übersicht Tab ────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: ColonyData }) {
  const popPct = data.location.population_max > 0
    ? Math.min(100, (data.location.population / data.location.population_max) * 100)
    : 0
  const overcrowded = data.location.population > data.location.population_max

  return (
    <div style={styles.grid2}>
      {/* Bevölkerung */}
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Bevölkerung</h2>
        <div style={styles.bigNumber}>
          {data.location.population.toLocaleString('de-DE')}
        </div>
        <div style={styles.subLine}>
          von max. {data.location.population_max.toLocaleString('de-DE')} Einwohnern
        </div>
        <div style={styles.barTrack}>
          <div style={{
            ...styles.barFill,
            width: `${popPct}%`,
            background: overcrowded ? '#e05252' : '#c9a961',
          }} />
        </div>
        {overcrowded && (
          <div style={styles.warningText}>⚠ Überbelegung — Bevölkerung schrumpft</div>
        )}
      </section>

      {/* Ressourcen */}
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Lagerbestände</h2>
        {data.resources.map(r => (
          <ResourceRow key={r.resource_type} resource={r} />
        ))}
      </section>

      {/* Top-Eigentümer */}
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Größte Eigentümer</h2>
        {data.topOwners.length === 0 && (
          <div style={styles.empty}>Noch keine Gebäude in dieser Kolonie.</div>
        )}
        {data.topOwners.map((o, i) => (
          <div key={o.profile_id} style={styles.ownerRow}>
            <span style={styles.ownerRank}>#{i + 1}</span>
            <span style={styles.ownerName}>{o.username}</span>
            <span style={styles.ownerCount}>{o.count} Gebäude</span>
          </div>
        ))}
      </section>

      {/* Aktive Aufträge */}
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Offene Aufträge</h2>
        {data.orders.length === 0 && (
          <div style={styles.empty}>Keine offenen Aufträge.</div>
        )}
        {data.orders.map(o => (
          <div key={o.id} style={styles.orderRow}>
            <span style={{ color: RESOURCE_COLORS[o.resource_type] ?? '#fff' }}>
              {RESOURCE_LABELS[o.resource_type] ?? o.resource_type}
            </span>
            <span>{o.amount}t</span>
            <span style={styles.reward}>{o.reward.toLocaleString('de-DE')} Cr</span>
          </div>
        ))}
      </section>
    </div>
  )
}

function ResourceRow({ resource: r }: { resource: Resource }) {
  const color = RESOURCE_COLORS[r.resource_type] ?? '#c9a961'
  const net   = r.production - r.consumption
  return (
    <div style={styles.resourceRow}>
      <div style={{ ...styles.resourceDot, background: color }} />
      <div style={styles.resourceLabel}>
        {RESOURCE_LABELS[r.resource_type] ?? r.resource_type}
      </div>
      <div style={styles.resourceStock}>{r.stock.toLocaleString('de-DE')}t</div>
      <div style={{ ...styles.resourceNet, color: net >= 0 ? '#6fcf97' : '#e05252' }}>
        {net >= 0 ? '+' : ''}{net}/Tick
      </div>
    </div>
  )
}

// ── Markt Tab ────────────────────────────────────────────────────────────────

function MarketTab({ data }: { data: ColonyData }) {
  return (
    <div>
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Aktuelle Marktpreise</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Ressource</th>
              <th style={styles.th}>Kaufen</th>
              <th style={styles.th}>Verkaufen</th>
              <th style={styles.th}>Spread</th>
            </tr>
          </thead>
          <tbody>
            {data.prices.map(p => (
              <tr key={p.resource_type}>
                <td style={styles.td}>
                  <span style={{ color: RESOURCE_COLORS[p.resource_type] ?? '#fff' }}>
                    {RESOURCE_LABELS[p.resource_type] ?? p.resource_type}
                  </span>
                </td>
                <td style={styles.td}>{p.buy_price.toLocaleString('de-DE')} Cr</td>
                <td style={styles.td}>{p.sell_price.toLocaleString('de-DE')} Cr</td>
                <td style={styles.td}>{(p.buy_price - p.sell_price).toLocaleString('de-DE')} Cr</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Zölle (sichtbar für alle, nur Governor kann sie ändern) */}
      <section style={{ ...styles.card, marginTop: 16 }}>
        <h2 style={styles.cardTitle}>Einfuhrzölle</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Ressource</th>
              <th style={styles.th}>Zollsatz</th>
            </tr>
          </thead>
          <tbody>
            {data.tariffs.map(t => (
              <tr key={t.resource_type}>
                <td style={styles.td}>
                  <span style={{ color: RESOURCE_COLORS[t.resource_type] ?? '#fff' }}>
                    {RESOURCE_LABELS[t.resource_type] ?? t.resource_type}
                  </span>
                </td>
                <td style={styles.td}>
                  {t.rate === 0
                    ? <span style={{ color: '#6fcf97' }}>Kein Zoll</span>
                    : <span style={{ color: '#e05252' }}>{(t.rate * 100).toFixed(1)} %</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

// ── Treasury Tab (nur Governor) ──────────────────────────────────────────────

function TreasuryTab({ data }: { data: ColonyData }) {
  const t = data.treasury
  const fmt = (v: number | null) =>
    v != null ? v.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' Cr' : '—'

  return (
    <div style={styles.grid2}>
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Koloniekasse (Gesamt)</h2>
        <div style={styles.ledgerRow}>
          <span>Einnahmen</span>
          <span style={{ color: '#6fcf97' }}>{fmt(t.total_income)}</span>
        </div>
        <div style={styles.ledgerRow}>
          <span>Ausgaben</span>
          <span style={{ color: '#e05252' }}>{fmt(t.total_expenses)}</span>
        </div>
        <div style={{ ...styles.ledgerRow, borderTop: '1px solid #2a3a4a', marginTop: 8, paddingTop: 8 }}>
          <span><strong>Saldo</strong></span>
          <span style={{ color: (t.balance ?? 0) >= 0 ? '#c9a961' : '#e05252', fontWeight: 700 }}>
            {fmt(t.balance)}
          </span>
        </div>
        {t.last_tick && (
          <div style={{ ...styles.subLine, marginTop: 12 }}>
            Letzter Tick: #{t.last_tick}
          </div>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Aktuelle Steuersätze</h2>
        <div style={styles.ledgerRow}>
          <span>Grundsteuer</span>
          <span>{data.settings.tax_property.toLocaleString('de-DE')} Cr / Gebäude / Tick</span>
        </div>
        <div style={styles.ledgerRow}>
          <span>Transaktionssteuer</span>
          <span>{(data.settings.tax_transaction * 100).toFixed(1)} %</span>
        </div>
        <div style={styles.ledgerRow}>
          <span>Landegebühr</span>
          <span>{data.settings.tax_landing.toLocaleString('de-DE')} Cr / Landung</span>
        </div>
      </section>
    </div>
  )
}

// ── Einstellungen Tab (nur Governor) ─────────────────────────────────────────

function SettingsTab({
  data,
  accessToken,
  slug,
  onSaved,
}: {
  data: ColonyData
  accessToken: string | null
  slug: string
  onSaved: () => void
}) {
  const [property,    setProperty]    = useState(String(data.settings.tax_property))
  const [transaction, setTransaction] = useState(String((data.settings.tax_transaction * 100).toFixed(2)))
  const [landing,     setLanding]     = useState(String(data.settings.tax_landing))
  const [saving, setSaving]           = useState(false)
  const [feedback, setFeedback]       = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const params = new URLSearchParams({
        slug,
        action:          'setTax',
        tax_property:    property,
        tax_transaction: String(parseFloat(transaction) / 100),
        tax_landing:     landing,
      })
      const res = await fetch(`/api/game/colony?${params}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      })
      if (res.ok) {
        setFeedback('Gespeichert.')
        onSaved()
      } else {
        const j = await res.json()
        setFeedback(j.error ?? 'Fehler beim Speichern.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Steuerverwaltung</h2>
        <p style={styles.settingsNote}>
          Änderungen wirken ab dem nächsten Tick. Die Grundsteuer wird automatisch
          von den Gebäude-Eigentümern eingezogen.
        </p>

        <SettingsField
          label="Grundsteuer"
          unit="Cr / Gebäude / Tick"
          value={property}
          onChange={setProperty}
          hint="0 = keine Grundsteuer"
        />
        <SettingsField
          label="Transaktionssteuer"
          unit="% auf Kauf/Verkauf"
          value={transaction}
          onChange={setTransaction}
          hint="0–100 %, max. sinnvoll ~10 %"
        />
        <SettingsField
          label="Landegebühr"
          unit="Cr / Landung"
          value={landing}
          onChange={setLanding}
          hint="0 = kostenlose Landung"
        />

        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={styles.saveBtn} onClick={save} disabled={saving}>
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
          {feedback && (
            <span style={{ color: feedback === 'Gespeichert.' ? '#6fcf97' : '#e05252', fontSize: 14 }}>
              {feedback}
            </span>
          )}
        </div>
      </section>
    </div>
  )
}

function SettingsField({
  label, unit, value, onChange, hint,
}: {
  label: string; unit: string; value: string; onChange: (v: string) => void; hint?: string
}) {
  return (
    <div style={styles.settingsField}>
      <label style={styles.settingsLabel}>{label}</label>
      <div style={styles.settingsInputRow}>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={styles.settingsInput}
        />
        <span style={styles.settingsUnit}>{unit}</span>
      </div>
      {hint && <div style={styles.settingsHint}>{hint}</div>}
    </div>
  )
}

// ── Loading ──────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ padding: '64px 0', textAlign: 'center', color: '#4a6a8a' }}>
      Lade Kolonie…
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100vh',
    background: '#020408',
    color: '#d4cfc7',
    fontFamily: "'Courier Prime', monospace",
  },
  container: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '0 16px 64px',
  },

  // Header
  header: {
    borderBottom: '1px solid #1a2a3a',
    padding: '32px 0 24px',
    marginBottom: 0,
  },
  headerInner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 16,
  },
  headerEyebrow: {
    fontSize: 11,
    letterSpacing: '0.15em',
    color: '#4a6a8a',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: 'Georgia, serif',
    fontSize: 32,
    fontWeight: 700,
    color: '#f4f2ed',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  headerMeta: {
    textAlign: 'right' as const,
  },
  governorBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#8aaccc',
  },
  governorDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#c9a961',
    display: 'inline-block',
  },
  youBadge: {
    background: '#c9a961',
    color: '#020408',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    padding: '2px 6px',
    borderRadius: 2,
  },
  noGovernor: {
    fontSize: 13,
    color: '#4a6a8a',
    fontStyle: 'italic',
  },

  // Tabs
  tabBar: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid #1a2a3a',
    marginBottom: 24,
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#4a6a8a',
    fontFamily: "'Courier Prime', monospace",
    fontSize: 13,
    letterSpacing: '0.05em',
    padding: '14px 20px',
    cursor: 'pointer',
    transition: 'color 0.15s',
    marginBottom: -1,
  },
  tabBtnActive: {
    color: '#c9a961',
    borderBottomColor: '#c9a961',
  },

  // Content
  content: {
    minHeight: 400,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
    gap: 16,
  },

  // Cards
  card: {
    background: '#0a1520',
    border: '1px solid #1a2a3a',
    borderRadius: 4,
    padding: '20px 24px',
  },
  cardTitle: {
    fontFamily: 'Georgia, serif',
    fontSize: 14,
    fontWeight: 700,
    color: '#8aaccc',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    margin: '0 0 16px',
  },

  // Population
  bigNumber: {
    fontFamily: 'Georgia, serif',
    fontSize: 40,
    fontWeight: 700,
    color: '#f4f2ed',
    lineHeight: 1,
  },
  subLine: {
    fontSize: 12,
    color: '#4a6a8a',
    marginTop: 4,
  },
  barTrack: {
    height: 4,
    background: '#1a2a3a',
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.3s',
  },
  warningText: {
    fontSize: 12,
    color: '#e05252',
    marginTop: 8,
  },

  // Resources
  resourceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 0',
    borderBottom: '1px solid #0f1e2e',
  },
  resourceDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  resourceLabel: {
    flex: 1,
    fontSize: 13,
    color: '#d4cfc7',
  },
  resourceStock: {
    fontSize: 13,
    color: '#f4f2ed',
    minWidth: 60,
    textAlign: 'right' as const,
  },
  resourceNet: {
    fontSize: 12,
    minWidth: 70,
    textAlign: 'right' as const,
  },

  // Owners
  ownerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '7px 0',
    borderBottom: '1px solid #0f1e2e',
    fontSize: 13,
  },
  ownerRank: {
    color: '#4a6a8a',
    minWidth: 28,
  },
  ownerName: {
    flex: 1,
    color: '#d4cfc7',
  },
  ownerCount: {
    color: '#c9a961',
    fontSize: 12,
  },

  // Orders
  orderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '7px 0',
    borderBottom: '1px solid #0f1e2e',
    fontSize: 13,
  },
  reward: {
    color: '#c9a961',
    fontWeight: 700,
  },

  // Market Table
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 13,
  },
  th: {
    textAlign: 'left' as const,
    color: '#4a6a8a',
    fontWeight: 400,
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    padding: '6px 0',
    borderBottom: '1px solid #1a2a3a',
  },
  td: {
    padding: '9px 0',
    borderBottom: '1px solid #0f1e2e',
    color: '#d4cfc7',
  },

  // Treasury
  ledgerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    fontSize: 13,
    borderBottom: '1px solid #0f1e2e',
  },

  // Settings
  settingsNote: {
    fontSize: 12,
    color: '#4a6a8a',
    marginBottom: 20,
    lineHeight: 1.6,
  },
  settingsField: {
    marginBottom: 20,
  },
  settingsLabel: {
    display: 'block',
    fontSize: 12,
    color: '#8aaccc',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  },
  settingsInputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  settingsInput: {
    background: '#020408',
    border: '1px solid #2a3a4a',
    borderRadius: 3,
    color: '#f4f2ed',
    fontFamily: "'Courier Prime', monospace",
    fontSize: 14,
    padding: '8px 12px',
    width: 120,
    outline: 'none',
  },
  settingsUnit: {
    fontSize: 12,
    color: '#4a6a8a',
  },
  settingsHint: {
    fontSize: 11,
    color: '#2a4a6a',
    marginTop: 4,
  },
  saveBtn: {
    background: '#c9a961',
    border: 'none',
    borderRadius: 3,
    color: '#020408',
    fontFamily: "'Courier Prime', monospace",
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: '0.05em',
    padding: '10px 24px',
    cursor: 'pointer',
  },

  // Misc
  empty: {
    fontSize: 13,
    color: '#2a4a6a',
    fontStyle: 'italic',
    padding: '8px 0',
  },
  error: {
    padding: '64px 0',
    textAlign: 'center' as const,
    color: '#e05252',
    fontSize: 14,
  },
}
