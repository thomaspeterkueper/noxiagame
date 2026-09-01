import type { OverlayDef, BuildingContext } from '../types'

export function buildScannerOverlay(ctx: BuildingContext): OverlayDef {
  return {
    id: 'scanner',
    title: 'Scanner',
    subtitle: `${ctx.locationName} · Prospektion`,
    metrics: [
      { id: 'mode', label: 'Messmodus', value: 'Nahfeld', trend: 'stable', hint: 'Ground Truth → Messung → Interpretation → Discovery' },
      { id: 'state', label: 'Datenquelle', value: 'Weltzustand', trend: 'stable', hint: 'Keine separate Scanner-Simulation' },
    ],
    alerts: [
      { id: 'ready', severity: 'info', text: ctx.isOwn ? 'Scanner bereit. Messungen werden serverseitig gegen den kanonischen Weltzustand ausgewertet.' : 'Nur der Eigentümer kann neue Messungen ausführen.' },
    ],
    actions: ctx.isOwn ? [
      { id: 'open_scanner', label: 'Scannerraum betreten', primary: true, href: `/scanner?location=${encodeURIComponent(ctx.locationSlug)}` },
      { id: 'sell_building', label: 'Gebäude bewerten & verkaufen' },
    ] : [],
    insight: 'Der Scanner erzeugt keine versteckten Kartenobjekte. Er misst Eigenschaften, die bereits im NOXIA-Weltzustand vorhanden sind. Erst ausreichende Evidenz wird als persistente Discovery gespeichert.',
  }
}
