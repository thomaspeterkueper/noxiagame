'use client'

// lib/figures/FigureEditor.tsx
// Eigene Figur gestalten (05.11.2026, Second-Life-Mechanik): Regler statt neuer
// Zeichnung, Vorschau in vier Richtungen. Gespeichert über useMyLook → player_appearance;
// andere Spieler sehen die Figur über die Anwesenheit im Raum.

import { useState } from 'react'
import { KieselFigure, useMyLook } from './KieselFigure'
import { PLAYER_LOOK_OPTIONS as O } from './playerLook'
import { KIESEL_POSES, kieselSVG, type KieselLook, type KieselPose } from './kiesel'

type Props = {
  onClose: (text?: string) => void
  /** Startwerte (Onboarding: die Figur zum Dienstfoto). */
  initialLook?: KieselLook
  /** Überschrift (Onboarding: „Deine Figur – passend zu deinem Foto“). */
  title?: string
  /** Text des zweiten Knopfs (Onboarding: „So übernehmen“). */
  cancelLabel?: string
  /** Über dem ganzen Bildschirm statt im Innenraum (Profil, Onboarding). */
  fixed?: boolean
}

// Bewegungen aus der Figurenwerkstatt (06.11.2026: „wir hatten auch schon einen Figureneditor,
// den sollten wir auch integrieren“): alle Posen nach Stufen, zum Ansehen an der eigenen Figur.
const STUFEN: Array<[string, string]> = [['grund', 'Grundbewegungen'], ['geste', 'Gesten'], ['gemeinsam', 'Zu zweit'], ['tanz', 'Tanz'], ['arbeit', 'Arbeit'], ['rangelei', 'Rangelei'], ['kampf', 'Kampf']]
const STUFE_HINT: Record<string, string> = {
  geste: 'Im Raum mit den Tasten 1–6 oder im Chat („/winken“).',
  gemeinsam: 'Im Raum eine Person anklicken und einladen – sie entscheidet selbst.',
  arbeit: 'Kommt von selbst, wenn du eine Schicht hast.',
  rangelei: 'Nur wenn es im Lokal wirklich Streit gibt.',
  kampf: 'Nur wenn es im Lokal wirklich Streit gibt.',
}

export default function FigureEditor({ onClose, initialLook, title, cancelLabel, fixed }: Props) {
  const mine = useMyLook()
  const [look, setLook] = useState<KieselLook>(initialLook ?? mine.look)
  const [pose, setPose] = useState<KieselPose>('stehen')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof KieselLook>(k: K, v: KieselLook[K]) => setLook(l => ({ ...l, [k]: v }))

  const seg = <K extends keyof KieselLook>(label: string, k: K, opts: readonly (readonly [string, string])[]) => <div className="fe-row">
    <span>{label}</span>
    <div className="fe-seg" role="group" aria-label={label}>{opts.map(([v, l]) => <button key={v} type="button" aria-pressed={look[k] === v} onClick={() => set(k, v as KieselLook[K])}>{l}</button>)}</div>
  </div>
  const swatch = <K extends keyof KieselLook>(label: string, k: K, colors: readonly string[]) => <div className="fe-row">
    <span>{label}</span>
    <div className="fe-sw" role="group" aria-label={label}>{colors.map(c => <button key={c} type="button" aria-label={c} aria-pressed={look[k] === c} style={{ background: c }} onClick={() => set(k, c as KieselLook[K])} />)}</div>
  </div>

  const [dir, setDir] = useState<'se' | 'sw' | 'ne' | 'nw'>('se')
  const [showMoves, setShowMoves] = useState(false)
  function randomize() {
    const r = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]
    const hair = r(O.hair)[0]
    const feminine = Math.random() < .5
    setLook(l => ({
      ...l,
      age: r(O.age)[0], build: r(O.build)[0], skin: r(O.skin), hair,
      hairColor: r(O.hairColor.slice(0, 7)),
      beard: feminine ? 'ohne' : r(O.beard)[0],
      clothes: feminine && Math.random() < .6 ? 'kleid' : 'alltag',
      topColor: r(O.topColor), face: r(O.face)[0],
    }))
  }

  async function save() {
    setBusy(true); setError(null)
    const r = await mine.save(look)
    setBusy(false)
    if (!r.ok) { setError(r.error ?? 'Nicht gespeichert.'); return }
    onClose('Deine Figur ist gespeichert – so sehen dich jetzt alle.')
  }

  return <div className={'fig-editor' + (fixed ? ' fixed' : '')} role="dialog" aria-label="Deine Figur">
    <div className="fe-sheet">
      <div className="fe-head"><div><small>DEINE FIGUR</small><b>{title ?? 'So sehen dich alle im Spiel'}</b></div><button type="button" onClick={() => onClose()}>×</button></div>
      <div className="fe-body">
        <div className="fe-stage">
          <div className="fe-dirs">{(['se', 'sw', 'ne', 'nw'] as const).map(d => <KieselFigure key={d} look={look} dir={d} pose={pose} width={70} title={'Deine Figur ' + d} />)}</div>
          <div className="fe-seg" role="group" aria-label="Vorschau">{([['stehen', 'Stehen'], ['gehen', 'Gehen'], ['winken', 'Winken'], ['tanzen', 'Tanzen'], ['sitzen', 'Sitzen']] as [KieselPose, string][]).map(([p, l]) => <button key={p} type="button" aria-pressed={pose === p} onClick={() => setPose(p)}>{l}</button>)}<button type="button" aria-pressed={showMoves} onClick={() => setShowMoves(v => !v)}>Alle Bewegungen …</button></div>
          {showMoves && <div className="fe-moves">
            <div className="fe-seg" role="group" aria-label="Blickrichtung">{([['se', 'vorn rechts'], ['sw', 'vorn links'], ['ne', 'hinten rechts'], ['nw', 'hinten links']] as const).map(([d, l]) => <button key={d} type="button" aria-pressed={dir === d} onClick={() => setDir(d)}>{l}</button>)}</div>
            {STUFEN.map(([stufe, label]) => {
              const poses = (Object.keys(KIESEL_POSES) as KieselPose[]).filter(p => KIESEL_POSES[p].stufe === stufe && p !== 'handinhand_l')
              if (!poses.length) return null
              return <div key={stufe} className="fe-mgroup"><b>{label}</b>{STUFE_HINT[stufe] && <small>{STUFE_HINT[stufe]}</small>}
                <div className="fe-mcards">{poses.map(p => <button key={p} type="button" aria-pressed={pose === p} onClick={() => setPose(p)} title={KIESEL_POSES[p].label}>
                  <svg viewBox="0 0 64 96" width="40" height="60" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: kieselSVG(look, dir, p, 1, false) }} /><span>{KIESEL_POSES[p].label}</span>
                </button>)}</div></div>
            })}
          </div>}
          <p className="fe-hint">Bei einer Schicht ziehst du von selbst die Arbeitskleidung an – im Café die Schürze, an der Bar die Weste.</p>
        </div>
        <div className="fe-controls">
          {seg('Alter', 'age', O.age)}
          {seg('Statur', 'build', O.build)}
          {swatch('Haut', 'skin', O.skin)}
          {seg('Frisur', 'hair', O.hair)}
          {swatch('Haarfarbe', 'hairColor', O.hairColor)}
          {seg('Bart', 'beard', O.beard)}
          {seg('Ausdruck', 'face', O.face)}
          {seg('Kleidung', 'clothes', O.clothes)}
          {(look.clothes === 'alltag' || look.clothes === 'kleid') && swatch(look.clothes === 'kleid' ? 'Farbe' : 'Oberteil', 'topColor', O.topColor)}
        </div>
      </div>
      {error && <p className="fe-error">{error}</p>}
      <div className="fe-foot"><button type="button" disabled={busy} onClick={randomize} title="Zufällige Figur zum Ausprobieren">Zufällig</button><button type="button" disabled={busy} onClick={() => void save()}>{busy ? 'Speichert …' : 'Speichern'}</button><button type="button" disabled={busy} onClick={() => onClose()}>{cancelLabel ?? 'Abbrechen'}</button></div>
    </div>
    <style>{`
      .fig-editor{position:absolute;inset:54px 0 0;z-index:45;display:grid;place-items:center;padding:16px;background:#050c0dcc}
      .fe-sheet{width:min(860px,100%);max-height:100%;overflow:auto;background:#0f2224;border:1px solid #476263;border-radius:10px;color:#eef2ed;box-shadow:0 20px 60px #000a}
      .fe-head{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#10272a;border-bottom:1px solid #2d4445}
      .fe-head small{display:block;font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}.fe-head b{font-size:14px}
      .fe-head button{border:0;background:none;color:#9fb5b0;font-size:20px;cursor:pointer}
      .fe-body{display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:16px;padding:14px}
      .fig-editor.fixed{position:fixed;inset:0;z-index:2600}
      .fe-moves{display:grid;gap:8px;max-height:320px;overflow:auto;padding-right:4px}
      .fe-mgroup{display:grid;gap:4px}.fe-mgroup b{font-size:12px}.fe-mgroup small{font-size:10px;color:#6b5a48}
      .fe-mcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:4px}
      .fe-mcards button{display:grid;justify-items:center;gap:2px;padding:4px 2px;border:1px solid #b9ab95;border-radius:6px;background:#f4efe6;color:#2b2018;cursor:pointer;font-size:9px}
      .fe-mcards button[aria-pressed=true]{border-color:#2f5d58;box-shadow:0 0 0 2px #2f5d5855}
      .fe-stage{display:grid;gap:10px;align-content:start;background:#e9e2d2;border-radius:8px;padding:12px;color:#2b2018}
      .fe-dirs{display:grid;grid-template-columns:repeat(4,1fr);justify-items:center}
      .fe-hint{margin:0;font-size:11px;color:#5a4a3a}
      .fe-controls{display:grid;gap:8px;align-content:start}
      .fe-row{display:grid;grid-template-columns:78px minmax(0,1fr);gap:8px;align-items:center;font-size:12px}
      .fe-row>span{color:#9fb5b0}
      .fe-seg{display:flex;flex-wrap:wrap;gap:4px}
      .fe-seg button{padding:4px 8px;border:1px solid #40595a;border-radius:5px;background:#102526;color:#cbd6d2;font-size:11px;cursor:pointer}
      .fe-stage .fe-seg button{background:#f4efe6;border-color:#b9ab95;color:#2b2018}
      .fe-seg button[aria-pressed=true]{border-color:#f1d57a;background:#17383a;color:#f4e8c4}
      .fe-stage .fe-seg button[aria-pressed=true]{background:#2f5d58;color:#fff}
      .fe-sw{display:flex;flex-wrap:wrap;gap:5px}
      .fe-sw button{width:22px;height:22px;border-radius:50%;border:2px solid #0f2224;box-shadow:0 0 0 1px #40595a;cursor:pointer;padding:0}
      .fe-sw button[aria-pressed=true]{box-shadow:0 0 0 2px #f1d57a}
      .fe-foot{display:flex;gap:8px;padding:0 14px 14px}
      .fe-foot button{flex:1;padding:8px;border:1px solid #d0b66a;border-radius:6px;background:#17383a;color:#f4e8c4;cursor:pointer}
      .fe-foot button+button{border-color:#5d7b79;color:#cbd6d2}
      .fe-error{margin:0 14px 8px;color:#f1b07a;font-size:12px}
      @media(max-width:700px){.fe-body{grid-template-columns:1fr}.fe-dirs svg{width:56px}}
    `}</style>
  </div>
}
