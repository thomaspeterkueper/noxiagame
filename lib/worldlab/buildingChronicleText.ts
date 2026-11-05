// lib/worldlab/buildingChronicleText.ts
// Deutsche Zeilen für die Gebäudechronik (Infofenster). Rein, getestet.
import type { ChronicleEntry, ChronicleGap } from './buildingChronicle'

export function chronicleLine(entry: ChronicleEntry): string {
  const mine = entry.own === true ? ' (von dir)' : ''
  switch (entry.kind) {
    case 'built': return 'Gebaut' + mine
    case 'owner_changed': return 'Eigentümer gewechselt' + mine
    case 'changed': return 'Verändert' + mine
    case 'demolished':
      return (entry.authorized ? 'Abgerissen' : 'Entfernt, ohne Abrissbeleg') + mine
  }
}

export function chronicleGapLine(gap: ChronicleGap): string {
  return gap.code === 'deleted_without_receipt'
    ? 'Das Gebäude ist verschwunden, ein Beleg dafür fehlt im Verlauf.'
    : 'Ein Abriss ist verzeichnet, lässt sich aber noch nicht sicher einem Gebäude zuordnen.'
}
