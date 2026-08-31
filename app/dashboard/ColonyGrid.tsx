'use client'

// app/dashboard/ColonyGrid.tsx
// Discovery-aware facade. The existing ColonyGrid implementation remains
// unchanged in LegacyColonyGrid; this wrapper owns only scanner client state.

import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import LegacyColonyGrid from './LegacyColonyGrid'
import { loadScanState, SCANNER_SESSION_CLOSED_EVENT } from '@/lib/game/scanning'

type Props = ComponentProps<typeof LegacyColonyGrid>

export default function ColonyGrid(props: Props) {
  const [discoveryRevision, setDiscoveryRevision] = useState(0)

  // Hydrate the runtime discovery cache synchronously during render, before
  // the keyed LegacyColonyGrid's first generateGrid pass runs. A post-render
  // effect would populate the cache only after the first grid was generated,
  // so already-persisted discoveries would not surface on the first paint.
  useMemo(() => loadScanState(props.slug), [props.slug])

  useEffect(() => {
    const onScannerClosed = (event: Event) => {
      const detail = (event as CustomEvent<{ locationSlug?: string }>).detail
      if (detail?.locationSlug !== props.slug) return
      loadScanState(props.slug)
      setDiscoveryRevision(value => value + 1)
    }

    window.addEventListener(SCANNER_SESSION_CLOSED_EVENT, onScannerClosed)
    return () => window.removeEventListener(SCANNER_SESSION_CLOSED_EVENT, onScannerClosed)
  }, [props.slug])

  return <LegacyColonyGrid key={`${props.slug}:${discoveryRevision}`} {...props} />
}
