// app/dashboard/TransitPanel.tsx
// Erstellt: 30.05.2026
// Aktualisiert: 31.05.2026
//
// Fullscreen-Overlay während einer Reise (inTransit === true).
// Zeigt: Start-Station links · Schiff animiert in der Mitte · Ziel-Station rechts
//
// Schiffsbild: public/images/ships/freighter_side.png
// Bei fehlendem Bild: automatischer Fallback auf 🚀-Emoji
// shipTypeId kommt aus gameStore (wird mit loadFromServer befüllt)

'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/lib/store/gameStore'

const LOC_NAME:  Record<string, string> = { moon: 'Mond',       mars: 'Mars',  phobos: 'Phobos'  }
const LOC_SUB:   Record<string, string> = { moon: 'Shackleton', mars: 'Tharsis Hub', phobos: 'Freihafen' }
const LOC_ICON:  Record<string, string> = { moon: '⬡',          mars: '●',     phobos: '□'        }
const LOC_COLOR: Record<string, string> = { moon: '#b8b0a2',    mars: '#d0784a', phobos: '#8a8278' }
const LOC_GLOW:  Record<string, string> = {
  moon:   'radial-gradient(circle at 35% 35%, #d0c8bc 0%, #8a8278 55%, transparent 75%)',
  mars:   'radial-gradient(circle at 35% 35%, #e08858 0%, #a04828 55%, transparent 75%)',
  phobos: 'radial-gradient(circle at 35% 35%, #8a8278 0%, #4a4238 55%, transparent 75%)',
}

const SHIP_IMG: Record<string, string> = {
  freighter_mk1: '/images/ships/freighter_side.png',
  fast_courier:  '/images/ships/courier_side.png',
  heavy_hauler:  '/images/ships/hauler_side.png',
}

const STATUS_MSG = (p: number) => {
  if (p < 20)  return 'Triebwerke auf voller Leistung...'
  if (p < 50)  return 'Reisegeschwindigkeit erreicht.'
  if (p < 80)  return 'Bremsmanöver einleiten...'
  if (p < 95)  return 'Landeanflug läuft...'
  return 'Andocken...'
}

// ── Sternfeld ────────────────────────────────────────────────────────────────
const STARS = Array.from({ length: 28 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  y: (i * 53 + 7)  % 100,
  s: i % 4 === 0 ? 1.5 : 1,
  o: 0.25 + (i % 4) * 0.15,
}))

export default function TransitPanel({ onArrival }: { onArrival: (dest: string) => void }) {
  const {
    inTransit, transitFrom, transitTo,
    transitTotal, transitLeft, tickTransit,
    shipTypeId,
  } = useGameStore()

  // Engine glow pulse
  const [glowScale, setGlowScale] = useState(1)

  // Tick-Interval: läuft jede Sekunde solange inTransit
  useEffect(() => {
    if (!inTransit) return
    const interval = setInterval(() => tickTransit(), 1000)
    return () => clearInterval(interval)
  }, [inTransit])

  // Engine glow pulse unabhängig vom Tick
  useEffect(() => {
    if (!inTransit) return
    const i = setInterval(() => setGlowScale(s => s === 1 ? 1.3 : 1), 350)
    return () => clearInterval(i)
  }, [inTransit])

  if (!inTransit) return null

  const from     = transitFrom ?? 'moon'
  const to       = transitTo   ?? 'mars'
  const progress = transitTotal > 0 ? ((transitTotal - transitLeft) / transitTotal) * 100 : 0
  const mins     = Math.floor(transitLeft / 60)
  const secs     = transitLeft % 60
  const timeStr  = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`
  const shipSrc  = SHIP_IMG[shipTypeId ?? 'freighter_mk1']

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(4,8,16,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(6px)',
      fontFamily: "'Courier Prime', 'Courier New', monospace",
    }}>

      {/* Sternfeld */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {STARS.map((st, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${st.x}%`, top: `${st.y}%`,
            width: st.s, height: st.s,
            borderRadius: '50%',
            background: `rgba(255,255,255,${st.o})`,
          }} />
        ))}
      </div>

      {/* Hauptkarte */}
      <div style={{
        position: 'relative',
        background: '#080e18',
        border: '1px solid rgba(42,78,122,0.4)',
        borderTop: '2px solid #2a4e7a',
        width: '100%',
        maxWidth: 640,
        margin: '0 1rem',
        overflow: 'hidden',
      }}>

        {/* Scanlines */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)',
        }} />

        {/* Header-Label */}
        <div style={{
          padding: '12px 20px 0',
          fontSize: 9,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(201,169,97,0.5)',
        }}>
          noχ¹ᐃ · Transitprotokoll
        </div>

        {/* ── ROUTE-BEREICH ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '140px 1fr 140px',
          alignItems: 'center',
          padding: '16px 20px 12px',
          gap: 12,
        }}>

          {/* START-STATION links */}
          <StationCard slug={from} dim />

          {/* SCHIFF + FLUGBAHN Mitte */}
          <div style={{ position: 'relative' }}>

            {/* Flugbahn-Linie */}
            <div style={{
              position: 'absolute',
              top: '50%', left: 0, right: 0,
              height: 1,
              background: 'rgba(42,78,122,0.3)',
              transform: 'translateY(-50%)',
            }} />

            {/* Fortschritt auf Linie */}
            <div style={{
              position: 'absolute',
              top: '50%', left: 0,
              height: 1,
              width: `${progress}%`,
              background: 'linear-gradient(to right, #2a4e7a, #c9a961)',
              transform: 'translateY(-50%)',
              transition: 'width 0.9s linear',
            }} />

            {/* Schiff auf der Linie */}
            <div style={{
              position: 'relative',
              height: 80,
              display: 'flex',
              alignItems: 'center',
            }}>
              <div style={{
                position: 'absolute',
                left: `${progress}%`,
                transform: 'translateX(-50%)',
                transition: 'left 0.9s linear',
                width: 100,
                height: 50,
                marginLeft: -50, // zentriert auf progress-punkt
              }}>
                {/* Schiffsbild */}
                <img
                  src={shipSrc}
                  alt="Frachter"
                  style={{
                    width: 100, height: 50,
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 0 10px rgba(42,78,122,0.7))',
                    display: 'block',
                  }}
                  onError={(e) => {
                    // Fallback: Emoji wenn Bild fehlt
                    const el = e.target as HTMLImageElement
                    el.style.display = 'none'
                    const fb = el.nextSibling as HTMLElement
                    if (fb) fb.style.display = 'block'
                  }}
                />
                {/* Emoji-Fallback – versteckt wenn Bild lädt */}
                <div style={{
                  display: 'none',
                  fontSize: 28,
                  textAlign: 'center',
                  lineHeight: '50px',
                }}>
                  🚀
                </div>

                {/* Exhaust-Trail hinter dem Schiff */}
                <div style={{
                  position: 'absolute',
                  right: -2, top: '50%',
                  transform: 'translateY(-50%)',
                  width: 40, height: 5,
                  background: 'linear-gradient(to left, transparent, rgba(255,150,30,0.15))',
                  borderRadius: 3,
                  filter: 'blur(3px)',
                }} />

                {/* Engine Glow */}
                <div style={{
                  position: 'absolute',
                  right: -4, top: '50%',
                  transform: `translateY(-50%) scale(${glowScale})`,
                  width: 14, height: 14,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255,190,60,1) 0%, rgba(255,90,10,0.5) 50%, transparent 70%)',
                  filter: 'blur(2px)',
                  transition: 'transform 0.35s ease-in-out',
                }} />
              </div>
            </div>

            {/* Statusmeldung unter Linie */}
            <div style={{
              textAlign: 'center',
              fontSize: 9,
              color: 'rgba(90,122,154,0.8)',
              fontStyle: 'italic',
              marginTop: 4,
              letterSpacing: '0.04em',
            }}>
              {STATUS_MSG(progress)}
            </div>
          </div>

          {/* ZIEL-STATION rechts */}
          <StationCard slug={to} />
        </div>

        {/* ── COUNTDOWN + FORTSCHRITT ───────────────────────────────────────── */}
        <div style={{
          padding: '0 20px 20px',
          textAlign: 'center',
          borderTop: '1px solid rgba(42,78,122,0.15)',
          paddingTop: 16,
        }}>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: 44,
            fontWeight: 300,
            color: '#c9a961',
            letterSpacing: '0.05em',
            lineHeight: 1,
            marginBottom: 4,
          }}>
            {timeStr}
          </div>
          <div style={{
            fontSize: 9,
            color: 'rgba(90,122,154,0.7)',
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            marginBottom: 16,
          }}>
            Ankunft in
          </div>

          {/* Fortschrittsbalken */}
          <div style={{
            background: 'rgba(26,58,90,0.4)',
            height: 3,
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #2a4e7a, #c9a961)',
              transition: 'width 0.9s linear',
              borderRadius: 2,
            }} />
          </div>

          {/* Prozent-Label */}
          <div style={{
            marginTop: 6,
            fontSize: 9,
            color: 'rgba(201,169,97,0.4)',
            letterSpacing: '0.1em',
          }}>
            {Math.round(progress)}% der Strecke
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Stationskarte (links = Start, rechts = Ziel) ──────────────────────────────
// Bild-Pfad: public/images/locations/<slug>.png
// Fallback: CSS-Gradient-Kugel wenn Bild fehlt (z.B. spätere Raumstationen
// können einfach durch Ablegen von public/images/locations/<slug>.png eingebunden werden)
function StationCard({ slug, dim = false }: { slug: string; dim?: boolean }) {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <div style={{
      textAlign: 'center',
      opacity: dim ? 0.45 : 1,
      transition: 'opacity 0.5s',
    }}>
      {/* Location-Bild – rund maskiert */}
      <div style={{
        width: 72, height: 72,
        borderRadius: '50%',
        margin: '0 auto 8px',
        overflow: 'hidden',
        border: `1px solid ${LOC_COLOR[slug]}40`,
        boxShadow: `0 0 18px ${LOC_COLOR[slug]}25`,
        background: LOC_GLOW[slug], // sichtbar als Fallback
        position: 'relative',
      }}>
        {!imgFailed && (
          <img
            src={`/images/locations/${slug}.png`}
            alt={LOC_NAME[slug]}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
              // Leichte Vignette über dem Bild für den dunklen Weltraum-Look
              filter: 'brightness(0.85) contrast(1.1)',
            }}
            onError={() => setImgFailed(true)}
          />
        )}
      </div>

      {/* Icon + Name */}
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: dim ? 'rgba(200,212,224,0.45)' : '#e8eff6',
        letterSpacing: '0.06em',
        marginBottom: 2,
      }}>
        {LOC_ICON[slug]} {LOC_NAME[slug]}
      </div>

      {/* Sub-Name */}
      <div style={{
        fontSize: 9,
        color: 'rgba(90,122,154,0.7)',
        letterSpacing: '0.04em',
        fontStyle: 'italic',
      }}>
        {LOC_SUB[slug]}
      </div>

      {/* Status-Badge */}
      <div style={{
        marginTop: 6,
        display: 'inline-block',
        fontSize: 8,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '2px 7px',
        border: `1px solid ${LOC_COLOR[slug]}40`,
        color: dim ? 'rgba(90,122,154,0.5)' : LOC_COLOR[slug],
      }}>
        {dim ? 'Abflug' : 'Ziel'}
      </div>
    </div>
  )
}