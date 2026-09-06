'use client'

import React, { useEffect, useState } from 'react'

type FeedLine = { icon: string; text: string }

function readFeedLines(source: HTMLElement | null): FeedLine[] {
  if (!source) return []

  const lines: FeedLine[] = []
  for (const node of Array.from(source.querySelectorAll<HTMLElement>('div'))) {
    const directSpans = Array.from(node.children).filter((child): child is HTMLSpanElement => child instanceof HTMLSpanElement)
    if (directSpans.length < 2) continue

    const icon = (directSpans[0].textContent ?? '').trim()
    const text = (directSpans[1].textContent ?? '').replace(/\s+/g, ' ').trim()
    if (!text || text.toLocaleLowerCase('de-DE') === 'feed') continue
    if (lines.some(line => line.text === text)) continue
    lines.push({ icon, text })
  }

  if (lines.length === 0 && (source.textContent ?? '').includes('Die Kolonie ist ruhig.')) {
    lines.push({ icon: '', text: 'Die Kolonie ist ruhig.' })
  }

  return lines.slice(0, 6)
}

export default function DashboardFeedOverlay() {
  const [visible, setVisible] = useState(false)
  const [lines, setLines] = useState<FeedLine[]>([])

  useEffect(() => {
    let lastSource: HTMLElement | null = null

    const sync = () => {
      const source = document.querySelector<HTMLElement>('[data-hud-window="feed"]')
      if (lastSource && lastSource !== source) lastSource.classList.remove('noxia-feed-source-suppressed')
      lastSource = source

      if (!source) {
        setVisible(false)
        setLines(current => current.length === 0 ? current : [])
        return
      }

      if (!source.classList.contains('noxia-feed-source-suppressed')) {
        source.classList.add('noxia-feed-source-suppressed')
      }

      const nextVisible = source.classList.contains('noxia-feed-overlay-active')
      setVisible(current => current === nextVisible ? current : nextVisible)

      const nextLines = readFeedLines(source)
      setLines(current => JSON.stringify(current) === JSON.stringify(nextLines) ? current : nextLines)
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      characterData: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
      lastSource?.classList.remove('noxia-feed-source-suppressed')
    }
  }, [])

  return <>
    <style>{styles}</style>
    {visible && lines.length > 0 && (
      <aside className="noxia-passive-feed" aria-label="NOXIA Feed" aria-live="polite">
        {lines.map((line, index) => (
          <div className="noxia-passive-feed-line" key={`${line.text}-${index}`}>
            {line.icon && <span className="noxia-passive-feed-icon" aria-hidden="true">{line.icon}</span>}
            <span>{line.text}</span>
          </div>
        ))}
      </aside>
    )}
  </>
}

const styles = `
  /* The legacy feed card remains mounted only as a live data source for the
     cockpit toggle. It must never be visible in the map-first dashboard. */
  .noxia-dashboard-active .noxia-feed-overlay.noxia-feed-source-suppressed,
  .noxia-dashboard-active [data-hud-window="feed"].noxia-feed-source-suppressed {
    display: none !important;
  }

  .noxia-passive-feed {
    position: fixed;
    z-index: 2190;
    top: 62px;
    right: 16px;
    width: min(370px, 32vw);
    max-height: 42vh;
    box-sizing: border-box;
    padding: 9px 11px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: hidden;
    border: 0;
    border-radius: 5px;
    background: rgba(7, 17, 27, .34);
    box-shadow: none;
    backdrop-filter: blur(12px) saturate(106%);
    -webkit-backdrop-filter: blur(12px) saturate(106%);
    pointer-events: none;
    color: rgba(238, 247, 249, .92);
    font: 500 12px/1.38 system-ui, sans-serif;
    text-shadow: 0 1px 2px rgba(0, 0, 0, .45);
  }

  .noxia-passive-feed-line {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
  }

  .noxia-passive-feed-icon {
    width: 15px;
    flex: 0 0 15px;
    text-align: center;
    line-height: 1.35;
  }

  @media (max-width: 760px) {
    .noxia-passive-feed {
      top: 52px;
      right: 8px;
      width: min(330px, calc(100vw - 16px));
      padding: 8px 9px;
      font-size: 11px;
    }
  }
`
