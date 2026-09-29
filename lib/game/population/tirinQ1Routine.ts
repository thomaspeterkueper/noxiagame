export type TirinRoutineKind = 'home'|'archive'|'cafe'|'observation'|'heritage_corridor'|'harbour'

export interface TirinRoutineStop {
  kind:TirinRoutineKind
  entityId:string
  reason:'rest'|'work'|'social'|'observation'|'research'
}

// Planning only: background simulation can retain intent without fabricating presence.
// Active LOD may resolve the entityId to a tile entity and call startLocalVisit().
export function planTirinQ1Routine(tick:number):TirinRoutineStop {
  const phase=((tick%24)+24)%24
  if(phase<7 || phase>=22) return {kind:'home',entityId:'habitat',reason:'rest'}
  if(phase<12) return {kind:'archive',entityId:'archive_library',reason:'work'}
  if(phase<14) return {kind:'cafe',entityId:'cafe',reason:'social'}
  if(phase<17) return {kind:'archive',entityId:'archive_library',reason:'research'}
  // Rotate optional public places deterministically across days.
  const day=Math.floor(tick/24)
  switch(((day%3)+3)%3){
    case 0:return {kind:'observation',entityId:'observation_gallery',reason:'observation'}
    case 1:return {kind:'heritage_corridor',entityId:'heritage_corridor',reason:'observation'}
    default:return {kind:'harbour',entityId:'station_harbour',reason:'observation'}
  }
}
