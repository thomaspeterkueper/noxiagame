export interface PendingConstruction {
  buildable_id: string
  tile_row: number
  tile_col: number
  status: string
  created_at?: string | null
  started_at?: string | null
  build_started_at?: string | null
  completes_at?: string | null
  completed_at?: string | null
  progress?: number | null
  progress_pct?: number | null
  duration_seconds?: number | null
  build_time_seconds?: number | null
}

export type ConstructionPhase='foundation'|'structure'|'systems'|'commissioning'

export interface ConstructionState {
  progress:number
  phase:ConstructionPhase
  phaseLabel:string
  remainingSeconds:number|null
  timed:boolean
}

const phases:Array<{until:number;phase:ConstructionPhase;label:string}>=[
  {until:.18,phase:'foundation',label:'Fundament'},
  {until:.52,phase:'structure',label:'Rohbau'},
  {until:.82,phase:'systems',label:'Technik / Montage'},
  {until:1,phase:'commissioning',label:'Inbetriebnahme'},
]

function asTime(value?:string|null):number|null{
  if(!value)return null
  const t=Date.parse(value)
  return Number.isFinite(t)?t:null
}

/**
 * Presentation adapter for the existing pending-build source of truth.
 * It never invents a persistent timer. If the backend exposes explicit
 * progress, timestamps or a duration we render those; otherwise the site is
 * shown as an indeterminate active construction.
 */
export function constructionState(p:PendingConstruction,now=Date.now()):ConstructionState{
  let progress:number|null=null,remainingSeconds:number|null=null,timed=false
  if(typeof p.progress==='number') progress=p.progress>1?p.progress/100:p.progress
  else if(typeof p.progress_pct==='number') progress=p.progress_pct/100

  const start=asTime(p.started_at)??asTime(p.build_started_at)??asTime(p.created_at)
  const end=asTime(p.completes_at)??asTime(p.completed_at)
  const duration=(p.duration_seconds??p.build_time_seconds??0)*1000
  const calculatedEnd=end??(start&&duration>0?start+duration:null)
  if(progress===null&&start&&calculatedEnd&&calculatedEnd>start){
    progress=(now-start)/(calculatedEnd-start)
    remainingSeconds=Math.max(0,Math.ceil((calculatedEnd-now)/1000))
    timed=true
  }else if(calculatedEnd){
    remainingSeconds=Math.max(0,Math.ceil((calculatedEnd-now)/1000))
    timed=true
  }
  if(progress===null)progress=.08
  progress=Math.max(0,Math.min(1,progress))
  const phase=phases.find(x=>progress<=x.until)??phases[phases.length-1]
  return{progress,phase:phase.phase,phaseLabel:phase.label,remainingSeconds,timed}
}
