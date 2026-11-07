/** Literary journey checks remain separate from historical fact and simulation persistence. */
export type LiteraryCheckpoint = {
  id: string
  work: string
  sceneId?: string
  sourceDocument: string
  narrativeOrder: number
  actorIds: string[]
  setting: 'historical' | 'fictional'
  exactDate?: string
  notes: string
}
export type ContinuityFinding = {
  checkpointId: string
  type: 'missing_scene' | 'date_order' | 'missing_source'
  detail: string
}
export function auditJourney(
  checkpoints: readonly LiteraryCheckpoint[],
  knownSceneIds: readonly string[],
): ContinuityFinding[] {
  const findings: ContinuityFinding[] = []
  for (const point of checkpoints) {
    if (!point.sourceDocument.trim()) findings.push({checkpointId:point.id,type:'missing_source',detail:'Textbeleg fehlt'})
    if (point.sceneId && !knownSceneIds.includes(point.sceneId)) findings.push({checkpointId:point.id,type:'missing_scene',detail:'Szenenreferenz nicht im Katalog'})
  }
  const ordered=[...checkpoints].sort((a,b)=>a.narrativeOrder-b.narrativeOrder)
  for(let i=1;i<ordered.length;i++) {
    const prev=ordered[i-1],current=ordered[i]
    if(prev.exactDate && current.exactDate && current.exactDate < prev.exactDate)
      findings.push({checkpointId:current.id,type:'date_order',detail:'Erzählreihenfolge ist nicht chronologisch – Rückblende oder Fehler prüfen'})
  }
  return findings
}
export const MIRIAM_ISTANBUL_CHECKPOINTS: LiteraryCheckpoint[] = [
  {
    id:'miriam-ch2-hagia-sophia',
    work:'Die Miriam-Chroniken',
    sourceDocument:'Drive:1i6IuedvPGFoK3iL-U2Q3EerHjBGZ20IV',
    narrativeOrder:2,
    actorIds:['miriam-rachael','mehmet-oezkan'],
    setting:'fictional',
    notes:'Narrativer Ort: Hagia Sophia; die Handlungszeit und passende 3D-Szene sind erst anhand des Romantexts zu klären.',
  },
]
