'use client'

// lib/grid/RobotVisual.tsx
// Roboter als Gesprächspartner im Innenraum (Agentur für Arbeit, 29.10.2026):
// eine eigene Figur und ein eigenes Bild, damit niemand einen Roboter für einen
// Menschen hält. Kennung beginnt mit „robot:“ (isRobotId).

export const isRobotId = (id: string | null | undefined) => typeof id === 'string' && id.startsWith('robot:')

export function RobotFigure({ name, selected = false, showLabel = false, onClick }: { name: string; selected?: boolean; showLabel?: boolean; onClick?: () => void }) {
  return <button className={'robot-figure' + (selected ? ' selected' : '')} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onClick?.() }} title={name} aria-label={name}>
    <i className="ant" /><i className="head"><b /><b /></i><i className="body" /><i className="base" />
    {showLabel && <span>{name}</span>}
    <style jsx>{`
      .robot-figure{position:relative;width:24px;height:34px;padding:0;border:0;background:none;cursor:pointer}
      .robot-figure i{position:absolute;display:block}
      .ant{left:11px;top:0;width:2px;height:5px;background:#9fb5b0}
      .ant:after{content:'';position:absolute;left:-2px;top:-3px;width:6px;height:6px;border-radius:50%;background:#4fd8c5;box-shadow:0 0 6px #4fd8c5}
      .head{left:4px;top:5px;width:16px;height:11px;border-radius:5px;background:linear-gradient(#e9f1ef,#b9c9c5);border:1px solid #4f6a63;display:flex;gap:3px;align-items:center;justify-content:center}
      .head b{width:3px;height:3px;border-radius:50%;background:#2fa89a;box-shadow:0 0 3px #4fd8c5}
      .body{left:5px;top:17px;width:14px;height:10px;border-radius:3px;background:linear-gradient(#3b8f84,#2a6a62);border:1px solid #1f4d47}
      .base{left:3px;top:27px;width:18px;height:5px;border-radius:3px;background:#4f6a63}
      .selected .head{box-shadow:0 0 0 2px #f1d57a}
      span{position:absolute;left:50%;top:-16px;transform:translateX(-50%);white-space:nowrap;padding:1px 4px;border-radius:3px;background:#13262bdd;border:1px solid #4fd8c5;color:#e8fbf7;font:700 8px monospace}
    `}</style>
  </button>
}

export function RobotPortrait({ size = 64, title }: { size?: number; title?: string }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title ?? 'Roboter'}>
    {title && <title>{title}</title>}
    <circle cx="32" cy="32" r="31" fill="#0f2a26" stroke="#4fd8c5" strokeWidth="2" />
    <line x1="32" y1="8" x2="32" y2="15" stroke="#9fb5b0" strokeWidth="2" />
    <circle cx="32" cy="7" r="3" fill="#4fd8c5" />
    <rect x="16" y="15" width="32" height="22" rx="8" fill="#e9f1ef" stroke="#4f6a63" strokeWidth="1.5" />
    <rect x="20" y="20" width="24" height="11" rx="4" fill="#163a35" />
    <circle cx="27" cy="25.5" r="2.4" fill="#4fd8c5" /><circle cx="37" cy="25.5" r="2.4" fill="#4fd8c5" />
    <path d="M27 33q5 3 10 0" fill="none" stroke="#2fa89a" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="20" y="39" width="24" height="16" rx="4" fill="#3b8f84" stroke="#1f4d47" strokeWidth="1.5" />
    <rect x="27" y="43" width="10" height="4" rx="1.5" fill="#f1d57a" />
  </svg>
}
