'use client'

import type { ReactNode } from 'react'

type Props = {
  eyebrow: string
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}

export default function BuildingOverlayShell({ eyebrow, title, subtitle, onClose, children, footer, width = 920 }: Props) {
  return <div className="building-overlay" onClick={event => event.target === event.currentTarget && onClose()}>
    <section className="building-panel" style={{ maxWidth: width }}>
      <header>
        <div><small>{eyebrow}</small><h2>{title}</h2>{subtitle && <span>{subtitle}</span>}</div>
        <button type="button" onClick={onClose} aria-label={`${title} schließen`}>×</button>
      </header>
      <div className="building-content">{children}</div>
      {footer && <footer>{footer}</footer>}
    </section>
    <style jsx>{`
      .building-overlay{position:fixed;inset:0;z-index:2450;display:grid;place-items:center;padding:1rem;background:rgba(2,7,12,.86);backdrop-filter:blur(6px)}
      .building-panel{width:min(96vw,100%);max-height:94vh;overflow:auto;border:1px solid #526b74;border-radius:14px;background:#f2f1e9;color:#1e3540;box-shadow:0 22px 70px rgba(0,0,0,.5)}
      header{position:sticky;top:0;z-index:4;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:16px 18px;background:#0d2935;color:#eef3ef;border-bottom:1px solid #34515c}
      header small{display:block;color:#d5b65d;font:800 9px/1.2 ui-monospace,monospace;letter-spacing:.13em}h2{margin:3px 0 0;font:400 24px/1.2 Georgia,serif}header span{display:block;margin-top:4px;color:#9fb3bb;font-size:10px}header button{border:0;background:transparent;color:#e5ecec;font-size:25px;cursor:pointer}
      .building-content{padding:16px 18px 18px}footer{padding:9px 18px;border-top:1px solid #d2d0c4;color:#788487;font-size:9px;text-align:center}
      @media(max-width:700px){.building-overlay{padding:.35rem}.building-panel{width:99vw;max-height:98vh}.building-content{padding:12px}}
    `}</style>
  </div>
}
