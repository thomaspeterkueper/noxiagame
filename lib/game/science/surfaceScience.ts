import { deriveScientificInterpretations, observablesForResource, type ScientificInterpretation } from './scientificInterpretation'

export type SurfaceScienceEvidenceStage =
  | 'prospect'
  | 'reference_sample'
  | 'reference_analysis'
  | 'drilling'
  | 'drill_core'
  | 'core_analysis'
  | 'pilot_extraction'

export type SurfaceScienceObject = {
  id: string
  label: string
  xM: number
  yM: number
  resourceType: string
  provenance: string
  confidence: string
  tier: string
  evidenceStage: SurfaceScienceEvidenceStage
  evidenceLabel: string
  evidenceClass: 'modeled' | 'sampled' | 'direct' | 'engineering'
  sampleStatus: string
  coreStatus: string
  missionStatus: string
  developmentStatus: string
  finding: string | null
  qualityScore: number | null
  observationNeeds: string[]
  interpretations: ScientificInterpretation[]
}

type Prospect = {
  id:string
  resourceType:string
  xM:number
  yM:number
  tier?:string|null
  confidence?:string|null
  provenance?:string|null
  discoveredAt?:string|null
  sampledAt?:string|null
}
type Analysis = { finding?:string|null;qualityScore?:number|null;developmentStatus?:string|null }
type Sample = { prospectId:string;sampleKind:string;status:string;analysis?:Analysis|null }
type DrillJob = { region_resource_id?:string|null;status:string }
type PilotJob = { prospect_id:string;status:string }

const STAGE_LABEL:Record<SurfaceScienceEvidenceStage,string>={
  prospect:'modellierter Prospekt',
  reference_sample:'Referenzprobe',
  reference_analysis:'analysierte Referenzprobe',
  drilling:'Bohrmission',
  drill_core:'direkter Bohrkern',
  core_analysis:'analysierter Bohrkern',
  pilot_extraction:'robotischer Pilotabbau',
}

export function deriveSurfaceScienceObjects(args:{prospects:Prospect[];samples:Sample[];drillJobs:DrillJob[];pilotJobs:PilotJob[]}):SurfaceScienceObject[]{
  const {prospects,samples,drillJobs,pilotJobs}=args
  return prospects.filter(p=>p.discoveredAt&&Number.isFinite(Number(p.xM))&&Number.isFinite(Number(p.yM))).map(prospect=>{
    const reference=samples.find(s=>s.prospectId===prospect.id&&s.sampleKind!=='drill_core')
    const core=samples.find(s=>s.prospectId===prospect.id&&s.sampleKind==='drill_core')
    const drill=drillJobs.find(j=>String(j.region_resource_id??'')===prospect.id)
    const pilot=pilotJobs.find(j=>j.prospect_id===prospect.id)
    let evidenceStage:SurfaceScienceEvidenceStage='prospect'
    let evidenceClass:SurfaceScienceObject['evidenceClass']='modeled'
    if(reference)evidenceStage='reference_sample',evidenceClass='sampled'
    if(reference?.analysis)evidenceStage='reference_analysis',evidenceClass='sampled'
    if(drill?.status==='running')evidenceStage='drilling',evidenceClass='sampled'
    if(core)evidenceStage='drill_core',evidenceClass='direct'
    if(core?.analysis)evidenceStage='core_analysis',evidenceClass='direct'
    if(pilot?.status==='running'||pilot?.status==='completed')evidenceStage='pilot_extraction',evidenceClass='engineering'
    const analysis=core?.analysis??reference?.analysis??null
    const finding=analysis?.finding??null
    return {
      id:prospect.id,
      label:`Prospekt ${String(prospect.resourceType).replaceAll('_',' ')}`,
      xM:Number(prospect.xM),yM:Number(prospect.yM),resourceType:prospect.resourceType,
      provenance:prospect.provenance??'derived-gameplay-model',confidence:prospect.confidence??'n/a',tier:prospect.tier??'unbekannt',
      evidenceStage,evidenceLabel:STAGE_LABEL[evidenceStage],evidenceClass,
      sampleStatus:reference?.status??(prospect.sampledAt?'collected':'none'),
      coreStatus:core?.status??'none',missionStatus:pilot?.status??drill?.status??'idle',
      developmentStatus:analysis?.developmentStatus??'blocked',finding,
      qualityScore:Number.isFinite(Number(analysis?.qualityScore))?Number(analysis?.qualityScore):null,
      observationNeeds:observablesForResource(prospect.resourceType),
      interpretations:deriveScientificInterpretations({resourceType:prospect.resourceType,evidenceClass,finding}),
    }
  })
}
