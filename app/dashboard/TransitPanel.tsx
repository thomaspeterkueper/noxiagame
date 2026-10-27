'use client'

// TransitPanel.tsx
// Aktualisiert: 27.10.2026 — liegt per Portal über allen Kartenansichten (auch 2,5D-Oberflächen);
//               kurze Startszene vom Landeplatz vor dem Flug-Overlay; Orte ohne festen
//               Eintrag (z. B. Mishkan Avi) mit Namen und Farbe ihres Himmelskörpers
// Vorher:       31.05.2026 — Transit-Panel
// Version:      0.3.0
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

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '@/lib/store/gameStore'
import { useColonyStateStore } from '@/lib/store/colonyStateStore'
import { resolveLocationBody } from '@/lib/game/locationBody'
import { ShipSVG, ShipSpriteStyles } from '@/lib/ships/ShipSVG'

const LOC_NAME:  Record<string, string> = { earth: 'Erde', moon: 'Mond', mars: 'Mars', phobos: 'Phobos', prometheus: 'Prometheus' }
const LOC_SUB:   Record<string, string> = { earth: 'LEO-Terminal', moon: 'Shackleton', mars: 'Tharsis Hub', phobos: 'Freihafen', prometheus: 'L5-Lagrange' }
const LOC_ICON:  Record<string, string> = { earth: '🌍', moon: '⬡', mars: '●', phobos: '□', prometheus: '🛸' }
const LOC_COLOR: Record<string, string> = { earth: '#3a7abf', moon: '#b8b0a2', mars: '#d0784a', phobos: '#8a8278', prometheus: '#c9a961' }
const LOC_GLOW:  Record<string, string> = {
  earth:      'radial-gradient(circle at 35% 35%, #5a9adf 0%, #2a5a9f 55%, transparent 75%)',
  moon:       'radial-gradient(circle at 35% 35%, #d0c8bc 0%, #8a8278 55%, transparent 75%)',
  mars:       'radial-gradient(circle at 35% 35%, #e08858 0%, #a04828 55%, transparent 75%)',
  phobos:     'radial-gradient(circle at 35% 35%, #8a8278 0%, #4a4238 55%, transparent 75%)',
  prometheus: 'radial-gradient(circle at 35% 35%, #e0c070 0%, #a07830 55%, transparent 75%)',
}

// Orte ohne eigenen Eintrag (neue Mars-Orte, gegründete Orte) nehmen Farbe und
// Symbol ihres Himmelskörpers; Name und Unterzeile kommen aus den Ortsdaten.
function useLocationLook(slug: string): { key: string; name: string; sub: string } {
  const location = useColonyStateStore(state => state.locations.find(item => item.slug === slug) ?? null)
  const body = LOC_COLOR[slug] ? slug : (resolveLocationBody(location) ?? 'mars')
  const key = LOC_COLOR[body] ? body : 'mars'
  const name = LOC_NAME[slug] ?? location?.name ?? slug
  const sub = LOC_SUB[slug] ?? (LOC_NAME[body] ? LOC_NAME[body] : '')
  return { key, name, sub }
}

// Startszene: Boden und Himmel nach Himmelskörper des Abflugorts.
const LAUNCH_SCENE: Record<string, { sky: string; ground: string; pad: string; dust: string }> = {
  earth:      { sky: 'linear-gradient(180deg,#0b1a33 0%,#3c6ea8 70%,#8db7da 100%)', ground: '#5d6b5a', pad: '#8d969b', dust: 'rgba(220,214,200,.75)' },
  moon:       { sky: 'linear-gradient(180deg,#000 0%,#05070b 100%)',                 ground: '#77736c', pad: '#a8a39a', dust: 'rgba(200,196,188,.7)' },
  mars:       { sky: 'linear-gradient(180deg,#2a1610 0%,#a8653f 72%,#d79a6b 100%)', ground: '#8a4a2c', pad: '#b38a72', dust: 'rgba(214,140,96,.75)' },
  phobos:     { sky: 'linear-gradient(180deg,#000 0%,#120c0a 100%)',                 ground: '#4f4740', pad: '#837a70', dust: 'rgba(150,140,128,.7)' },
  prometheus: { sky: 'linear-gradient(180deg,#000 0%,#0a0d16 100%)',                 ground: '#2a3240', pad: '#5c6a7c', dust: 'rgba(160,180,210,.55)' },
}
const LAUNCH_MS = 2800

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

  // Portal erst im Browser (document gibt es beim Server-Rendern nicht).
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Startszene nur, wenn die Reise gerade jetzt beginnt – nicht beim Neuladen
  // mitten im Flug und nicht bei „reduzierter Bewegung“.
  const [launching, setLaunching] = useState(false)
  const wasInTransit = useRef(inTransit)
  useEffect(() => {
    const started = inTransit && !wasInTransit.current
    wasInTransit.current = inTransit
    if (!started) { if (!inTransit) setLaunching(false); return }
    const fresh = transitTotal > 0 && transitLeft >= transitTotal - 1
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!fresh || reduce) return
    setLaunching(true)
    const timer = setTimeout(() => setLaunching(false), LAUNCH_MS)
    return () => clearTimeout(timer)
  }, [inTransit])

  const fromLook = useLocationLook(transitFrom ?? 'moon')
  const toLook = useLocationLook(transitTo ?? 'mars')

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

  if (!inTransit || !mounted) return null

  const from     = transitFrom ?? 'moon'
  const to       = transitTo   ?? 'mars'
  const progress = transitTotal > 0 ? ((transitTotal - transitLeft) / transitTotal) * 100 : 0
  const mins     = Math.floor(transitLeft / 60)
  const secs     = transitLeft % 60
  const timeStr  = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`
  const shipSrc  = SHIP_IMG[shipTypeId ?? 'freighter_mk1']

  if (launching) return createPortal(
    <LaunchScene fromKey={fromLook.key} fromName={fromLook.name} toName={toLook.name} shipTypeId={shipTypeId} onSkip={() => setLaunching(false)} />,
    document.body,
  )

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 5000,
      animation: 'noxia-transit-fade .45s ease-out',
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
                <ShipSpriteStyles />
                <div style={{
                  filter: 'drop-shadow(0 0 10px rgba(42,78,122,0.7))',
                  display: 'block',
                }}>
                  <ShipSVG
                    frame={(shipTypeId ?? 'freighter_mk1') as 'freighter_mk1' | 'fast_courier' | 'heavy_hauler'}
                    flying
                    size={50}
                  />
                </div>
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
      <style>{`@keyframes noxia-transit-fade{from{opacity:0}to{opacity:1}}`}</style>
    </div>,
    document.body,
  )
}

// ── Startszene: Abheben vom Landeplatz (2,8 s, Klick überspringt) ─────────────
function LaunchScene({ fromKey, fromName, toName, shipTypeId, onSkip }: { fromKey: string; fromName: string; toName: string; shipTypeId: string | null; onSkip: () => void }) {
  const scene = LAUNCH_SCENE[fromKey] ?? LAUNCH_SCENE.mars
  return (
    <div role="dialog" aria-label={`Start von ${fromName}`} onClick={onSkip} style={{
      position: 'fixed', inset: 0, zIndex: 5000, overflow: 'hidden', cursor: 'pointer',
      background: scene.sky, fontFamily: "'Courier Prime', 'Courier New', monospace",
    }}>
      <ShipSpriteStyles />
      {/* Boden in Schrägsicht */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '34%', background: `linear-gradient(180deg, ${scene.ground} 0%, #000 160%)` }} />
      {/* Landeplatz: Ellipse mit Ringen und Markierung */}
      <div style={{ position: 'absolute', left: '50%', bottom: '14%', width: 300, height: 92, marginLeft: -150, borderRadius: '50%', background: scene.pad, boxShadow: 'inset 0 0 0 6px rgba(0,0,0,.18), inset 0 0 0 22px rgba(255,255,255,.08)' }}>
        <div style={{ position: 'absolute', inset: '28% 40%', border: '3px solid rgba(255,214,120,.75)', borderRadius: '50%' }} />
        {/* Schatten des Schiffs, schrumpft beim Abheben */}
        <div className="nl-shadow" style={{ position: 'absolute', left: '50%', top: '50%', width: 120, height: 30, marginLeft: -60, marginTop: -15, borderRadius: '50%', background: 'rgba(0,0,0,.45)', filter: 'blur(3px)' }} />
      </div>
      {/* Staubwolke */}
      <div className="nl-dust" style={{ position: 'absolute', left: '50%', bottom: 'calc(14% + 20px)', width: 120, height: 40, marginLeft: -60, borderRadius: '50%', background: scene.dust, filter: 'blur(10px)', opacity: 0 }} />
      {/* Schiff: Seitenansicht, Bug nach oben */}
      <div className="nl-ship" style={{ position: 'absolute', left: '50%', bottom: 'calc(14% + 44px)', width: 0, height: 0 }}>
        <div style={{ transform: 'translate(-50%, -50%) rotate(-90deg)', filter: 'drop-shadow(0 0 12px rgba(255,200,120,.35))' }}>
          <ShipSVG frame={(shipTypeId ?? 'freighter_mk1') as 'freighter_mk1' | 'fast_courier' | 'heavy_hauler'} flying size={96} />
        </div>
      </div>
      {/* Beschriftung */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '12%', textAlign: 'center', color: '#f2e6c8', textShadow: '0 1px 6px rgba(0,0,0,.6)' }}>
        <div style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .75 }}>noχ¹ᐃ · Start</div>
        <div style={{ fontSize: 22, marginTop: 6 }}>{fromName} → {toName}</div>
        <div className="nl-status" style={{ fontSize: 11, marginTop: 8, opacity: .8 }}>Landeplatz frei · Triebwerke zünden</div>
      </div>
      <div style={{ position: 'absolute', right: 16, bottom: 14, fontSize: 9, letterSpacing: '.1em', color: 'rgba(242,230,200,.55)' }}>Klicken zum Überspringen</div>
      <style>{`
        .nl-ship{animation:nl-lift ${LAUNCH_MS}ms cubic-bezier(.55,0,.85,.4) forwards}
        @keyframes nl-lift{0%{transform:translate(0,0)}12%{transform:translate(-1px,0)}16%{transform:translate(1px,0)}22%{transform:translate(0,-2px)}100%{transform:translate(0,-120vh)}}
        .nl-shadow{animation:nl-shadow ${LAUNCH_MS}ms ease-in forwards}
        @keyframes nl-shadow{0%,20%{transform:scale(1);opacity:1}100%{transform:scale(.25);opacity:0}}
        .nl-dust{animation:nl-dust ${LAUNCH_MS}ms ease-out forwards}
        @keyframes nl-dust{0%{opacity:0;transform:scale(.4)}20%{opacity:.9;transform:scale(1.4)}60%{opacity:.6;transform:scale(3.2)}100%{opacity:0;transform:scale(4.5)}}
        .nl-status{animation:nl-blink .5s steps(2) infinite}
        @keyframes nl-blink{50%{opacity:.4}}
      `}</style>
    </div>
  )
}

// ── Stationskarte (links = Start, rechts = Ziel) ──────────────────────────────
// Bild-Pfad: public/images/locations/<slug>.png
// Fallback: CSS-Gradient-Kugel wenn Bild fehlt (z.B. spätere Raumstationen
// können einfach durch Ablegen von public/images/locations/<slug>.png eingebunden werden)
function StationCard({ slug, dim = false }: { slug: string; dim?: boolean }) {
  const [imgFailed, setImgFailed] = useState(false)
  const look = useLocationLook(slug)

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
        border: `1px solid ${LOC_COLOR[look.key]}40`,
        boxShadow: `0 0 18px ${LOC_COLOR[look.key]}25`,
        background: LOC_GLOW[look.key], // sichtbar als Fallback
        position: 'relative',
      }}>
        {!imgFailed && (
          <img
            src={`/images/locations/${slug}.png`}
            alt={look.name}
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
        {LOC_ICON[look.key]} {look.name}
      </div>

      {/* Sub-Name */}
      <div style={{
        fontSize: 9,
        color: 'rgba(90,122,154,0.7)',
        letterSpacing: '0.04em',
        fontStyle: 'italic',
      }}>
        {look.sub}
      </div>

      {/* Status-Badge */}
      <div style={{
        marginTop: 6,
        display: 'inline-block',
        fontSize: 8,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '2px 7px',
        border: `1px solid ${LOC_COLOR[look.key]}40`,
        color: dim ? 'rgba(90,122,154,0.5)' : LOC_COLOR[look.key],
      }}>
        {dim ? 'Abflug' : 'Ziel'}
      </div>
    </div>
  )
}
