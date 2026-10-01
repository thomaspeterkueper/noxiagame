'use client'

type Props = {
  title: string
  detail: string
}

/**
 * Shared NOXIA surface chrome. World-specific information belongs in the
 * content, never in a world-specific dashboard skin.
 */
export default function SurfaceContextBadge({ title, detail }: Props) {
  return <div className="surface-context-badge" aria-label={`${title} · ${detail}`}>
    <strong>{title}</strong>
    <span>{detail}</span>
    <style jsx>{`
      .surface-context-badge{position:fixed;z-index:2;left:18px;top:calc(var(--noxia-topbar-h,44px) + 58px);display:flex;flex-direction:column;gap:2px;max-width:min(620px,calc(100vw - 36px));padding:7px 10px;border:1px solid rgba(116,164,181,.28);border-radius:8px;background:rgba(8,20,28,.78);backdrop-filter:blur(8px);color:#dce8eb;font:10px/1.25 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;pointer-events:none;box-shadow:0 5px 20px rgba(0,0,0,.16)}
      strong{color:#d6b45e;letter-spacing:.08em}
      span{color:#93a7ae}
    `}</style>
  </div>
}
