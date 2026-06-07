// app/dashboard/SellPanel.tsx
// Verkaufs-UI für die ColonyGrid-Sidebar.
// Zeigt den marktwertbasierten Quote und die zwei Verkaufswege:
//   - Regulär: voller Wert, Auszahlung nach 2 Ticks
//   - Sofort:  15% Abschlag auf den Ertragswert, Auszahlung sofort
// Negativer Wert = Entsorgung (Spieler zahlt) wird klar ausgewiesen.
//
// Einbindung in ColonyGrid.tsx (Sidebar, wenn angeklicktes Tile eine
// eigene tile_entity mit entity_type='building' ist):
//   <SellPanel entityId={entity.id} entityName={tileName}
//              onSold={() => { reloadEntities(); reloadCredits(); }} />

'use client'

import { useEffect, useState } from 'react'

// ── Styling-Konstanten (Dark-Grid-Ästhetik) ──
const C = {
  bg:     '#020408',
  panel:  '#0a1018',
  line:   '#1c2836',
  text:   '#aab8c8',
  dim:    '#5a6878',
  gold:   '#c9a961',
  blue:   '#4a7eba',
  red:    '#c96161',
  green:  '#7ac961',
}

interface Quote {
  ertragswert: number
  rueckbau: number
  umsiedlung: number
  verdraengte: number
  valueNormal: number
  valueInstant: number
  isStrandedAsset: boolean
}

interface SellPanelProps {
  entityId: string
  entityName: string          // z.B. "Solarfeld"
  onSold?: () => void         // Bestand + Credits neu laden
}

async function getToken(): Promise<string | null> {
  const { createBrowserClient } = await import('@supabase/ssr')
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export default function SellPanel({ entityId, entityName, onSold }: SellPanelProps) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [durationTicks, setDurationTicks] = useState(2)
  const [loading, setLoading] = useState(true)
  const [selling, setSelling] = useState(false)
  const [confirm, setConfirm] = useState<'normal' | 'instant' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  // Quote laden, sobald ein Gebäude ausgewählt ist
  useEffect(() => {
    let cancelled = false
    setQuote(null); setError(null); setDone(null); setConfirm(null)
    setLoading(true)

    ;(async () => {
      const token = await getToken()
      const res = await fetch(
        `/api/game/build?action=sellQuote&entityId=${entityId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (cancelled) return
      if (data.error) setError(data.error)
      else {
        setQuote(data.quote)
        setDurationTicks(data.durationTicks ?? 2)
      }
      setLoading(false)
    })()

    return () => { cancelled = true }
  }, [entityId])

  async function executeSell(mode: 'normal' | 'instant') {
    setSelling(true); setError(null)
    const token = await getToken()
    const res = await fetch(
      `/api/game/build?action=sell&entityId=${entityId}&mode=${mode}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    setSelling(false)

    if (data.error) { setError(data.error); setConfirm(null); return }

    if (mode === 'instant') {
      setDone(data.payout >= 0
        ? `Verkauft · +${fmt(data.payout)} Cr`
        : `Entsorgt · ${fmt(data.payout)} Cr`)
    } else {
      setDone(`Verkauf läuft · ${fmt(data.payout)} Cr in ${durationTicks} Ticks`)
    }
    onSold?.()
  }

  const fmt = (n: number) =>
    (n >= 0 ? '' : '−') + Math.abs(n).toLocaleString('de-DE')

  // ── Render ──
  const mono: React.CSSProperties = {
    fontFamily: "'Courier Prime', 'Courier New', monospace",
  }

  if (loading) {
    return (
      <div style={{ ...mono, color: C.dim, fontSize: 11, padding: '12px 0' }}>
        … Marktbewertung läuft
      </div>
    )
  }

  if (done) {
    return (
      <div style={{
        ...mono, fontSize: 12, padding: '10px 12px',
        border: `1px solid ${C.line}`, color: C.gold, background: C.panel,
      }}>
        ✓ {done}
      </div>
    )
  }

  if (error && !quote) {
    return (
      <div style={{ ...mono, color: C.red, fontSize: 11, padding: '12px 0' }}>
        {error}
      </div>
    )
  }

  if (!quote) return null

  const negative = quote.valueNormal < 0

  return (
    <div style={{
      ...mono, marginTop: 14, paddingTop: 12,
      borderTop: `1px solid ${C.line}`,
    }}>
      {/* Kopfzeile */}
      <div style={{
        fontSize: 10, letterSpacing: '0.15em', color: C.dim,
        textTransform: 'uppercase', marginBottom: 8,
      }}>
        Marktbewertung · {entityName}
      </div>

      {/* Bewertungsaufstellung – der Spieler SIEHT die Logik */}
      <table style={{ width: '100%', fontSize: 11, color: C.text, borderSpacing: 0 }}>
        <tbody>
          <tr>
            <td style={{ padding: '2px 0', color: C.dim }}>Ertragswert</td>
            <td style={{ textAlign: 'right' }}>{fmt(quote.ertragswert)} Cr</td>
          </tr>
          <tr>
            <td style={{ padding: '2px 0', color: C.dim }}>Rückbau</td>
            <td style={{ textAlign: 'right', color: C.red }}>
              −{fmt(quote.rueckbau)} Cr
            </td>
          </tr>
          {quote.verdraengte > 0 && (
            <tr>
              <td style={{ padding: '2px 0 2px 10px', color: C.dim, fontSize: 10 }}>
                davon Umsiedlung ({quote.verdraengte} Pers.)
              </td>
              <td style={{ textAlign: 'right', color: C.dim, fontSize: 10 }}>
                −{fmt(quote.umsiedlung)} Cr
              </td>
            </tr>
          )}
          <tr>
            <td colSpan={2} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 4 }} />
          </tr>
          <tr style={{ fontSize: 13 }}>
            <td style={{ color: negative ? C.red : C.gold, fontWeight: 700 }}>
              {negative ? 'Entsorgungskosten' : 'Verkaufswert'}
            </td>
            <td style={{
              textAlign: 'right', fontWeight: 700,
              color: negative ? C.red : C.gold,
            }}>
              {fmt(quote.valueNormal)} Cr
            </td>
          </tr>
        </tbody>
      </table>

      {/* Stranded-Asset-Hinweis */}
      {negative && (
        <div style={{ fontSize: 10, color: C.dim, marginTop: 6, lineHeight: 1.5 }}>
          Der Markt zahlt für diese Anlage nichts mehr —
          der Rückbau bleibt trotzdem fällig.
        </div>
      )}

      {/* Aktionen */}
      {!confirm ? (
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <button
            onClick={() => setConfirm('normal')}
            style={btnStyle(negative ? C.red : C.gold)}
          >
            {negative ? 'Entsorgen' : `Verkaufen · ${durationTicks} Ticks`}
          </button>
          {!negative && quote.valueInstant !== quote.valueNormal && (
            <button onClick={() => setConfirm('instant')} style={btnStyle(C.blue)}>
              Sofort · {fmt(quote.valueInstant)} Cr
            </button>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: C.text, marginBottom: 8 }}>
            {confirm === 'normal'
              ? negative
                ? `Entsorgung für ${fmt(quote.valueNormal)} Cr bestätigen? Das Gebäude ist danach weg.`
                : `Verkauf starten? ${fmt(quote.valueNormal)} Cr nach ${durationTicks} Ticks. Produktion stoppt sofort.`
              : `Sofortverkauf? ${fmt(quote.valueInstant)} Cr jetzt — das sind ${fmt(quote.valueNormal - quote.valueInstant)} Cr weniger als beim regulären Verkauf.`}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => executeSell(confirm)}
              disabled={selling}
              style={btnStyle(C.gold)}
            >
              {selling ? '…' : 'Bestätigen'}
            </button>
            <button onClick={() => setConfirm(null)} style={btnStyle(C.dim)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 10, color: C.red, marginTop: 8 }}>{error}</div>
      )}
    </div>
  )
}

function btnStyle(color: string): React.CSSProperties {
  return {
    fontFamily: "'Courier Prime', 'Courier New', monospace",
    fontSize: 11,
    padding: '7px 10px',
    background: 'transparent',
    border: `1px solid ${color}`,
    color,
    cursor: 'pointer',
    letterSpacing: '0.05em',
    flex: 1,
  }
}
