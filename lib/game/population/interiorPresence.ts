import { getInteriorTemplateForBuildingType } from '@/lib/game/buildings/interiors/registry'
import { findInteriorRoute } from '@/lib/game/buildings/interiors/navigation'
import type { InteriorInstance, InteriorTemplate, RoomId } from '@/lib/game/buildings/interiors/types'
import type { PersonActivityState } from './types'

type SupabaseLike = any

type AssignmentRow = {
  id:string
  person_id:string
  assignment_type:'home'|'work'|'temporary'
  tile_entity_id:string|null
  role_code:string|null
  is_active:boolean
}

type PersonRow = {
  id:string
  activity_state:PersonActivityState
}

type TileEntityRow = {
  id:string
  entity_id:string
}

export type InteriorPresenceProjectionResult = {
  projected:number
  moved:number
  entered:number
  cleared:number
}

function defaultInstance(template:InteriorTemplate, tileEntityId:string):InteriorInstance {
  return {
    id:'derived:'+tileEntityId,
    templateId:template.id,
    host:{kind:'building',id:tileEntityId},
    roomStates:Object.fromEntries(template.rooms.map(room=>[room.id,{roomId:room.id,operationalState:'operational' as const}])),
    portalStates:Object.fromEntries(template.portals.map(portal=>[portal.id,{portalId:portal.id,state:portal.normallyOpen===false?'closed' as const:'open' as const}])),
  }
}

function hasCapability(template:InteriorTemplate, roomId:string, capabilities:string[]){
  const room=template.rooms.find(item=>item.id===roomId)
  return Boolean(room?.capabilities?.some(cap=>capabilities.includes(cap)))
}

function firstRoom(template:InteriorTemplate, preferredIds:string[], capabilities:string[], kinds:string[]):RoomId {
  for(const id of preferredIds)if(template.rooms.some(room=>room.id===id))return id
  const byCapability=template.rooms.find(room=>room.capabilities?.some(cap=>capabilities.includes(cap)))
  if(byCapability)return byCapability.id
  const byKind=template.rooms.find(room=>kinds.includes(room.kind))
  if(byKind)return byKind.id
  return template.rooms[0]?.id ?? 'entry'
}

export function targetInteriorRoom(input:{
  template:InteriorTemplate
  activity:PersonActivityState
  assignmentType:'home'|'work'|'temporary'
  roleCode:string|null
}):RoomId {
  const {template,activity,assignmentType}=input
  const role=(input.roleCode??'').toLowerCase()

  if(activity==='travelling') return firstRoom(template,['entry','airlock','reception'],['arrival','exit'],['entrance','airlock'])
  if(activity==='socialising') return firstRoom(template,['common','guest-room','meeting','crew','service'],['conversation','sit'],['hospitality','habitation','service','office'])
  if(activity==='resting' || assignmentType==='home') return firstRoom(template,['quarters','common','guest-room'],['sleep','rest','sit'],['habitation','hospitality'])
  if(activity==='inspecting') return firstRoom(template,['diagnostics','plant','workshop','support'],['diagnose','scan','maintenance','repair'],['medical','technical','utility','workshop'])

  if(activity==='working'){
    if(/scient|research|geo|lab/.test(role)) return firstRoom(template,['analysis','experiment','lab','diagnostics'],['research','scan','diagnose'],['laboratory','medical'])
    if(/tech|engineer|maintenance|operator/.test(role)) return firstRoom(template,['workshop','plant','support','control'],['repair','maintenance','control'],['workshop','technical','utility'])
    if(/admin|manager|command/.test(role)) return firstRoom(template,['operations','office','control'],['planning','records','control'],['office','technical'])
    if(/service|medical|care/.test(role)) return firstRoom(template,['reception','service','treatment'],['conversation','treatment','serve'],['service','medical','hospitality'])
    if(/logistic|trade|warehouse/.test(role)) return firstRoom(template,['receiving','storage','dispatch'],['storage','receive','dispatch'],['storage'])
    return firstRoom(template,['workshop','operations','service','office'],['work','control'],['workshop','office','service'])
  }

  return firstRoom(template,['common','entry','service','reception'],['sit','conversation'],['entrance','service','habitation','hospitality'])
}

function preferredAssignment(rows:AssignmentRow[], activity:PersonActivityState){
  const active=rows.filter(row=>row.is_active&&row.tile_entity_id)
  if(!active.length)return null
  if(activity==='working') return active.find(row=>row.assignment_type==='work') ?? active.find(row=>row.assignment_type==='temporary') ?? active[0]
  if(activity==='resting') return active.find(row=>row.assignment_type==='home') ?? active.find(row=>row.assignment_type==='temporary') ?? active[0]
  if(activity==='socialising'||activity==='inspecting') return active.find(row=>row.assignment_type==='temporary') ?? active.find(row=>row.assignment_type==='work') ?? active.find(row=>row.assignment_type==='home') ?? active[0]
  return active.find(row=>row.assignment_type==='temporary') ?? active.find(row=>row.assignment_type==='home') ?? active.find(row=>row.assignment_type==='work') ?? active[0]
}

export async function projectInteriorPresence(
  supabase:SupabaseLike,
  tick:number,
  people:PersonRow[],
  assignments:AssignmentRow[],
):Promise<InteriorPresenceProjectionResult>{
  const result:InteriorPresenceProjectionResult={projected:0,moved:0,entered:0,cleared:0}
  if(!people.length)return result

  const byPerson=new Map<string,AssignmentRow[]>()
  for(const row of assignments){
    const list=byPerson.get(row.person_id)??[]
    list.push(row)
    byPerson.set(row.person_id,list)
  }

  const assignmentByPerson=new Map<string,AssignmentRow>()
  const tileIds=new Set<string>()
  for(const person of people){
    const assignment=preferredAssignment(byPerson.get(person.id)??[],person.activity_state)
    if(!assignment?.tile_entity_id)continue
    assignmentByPerson.set(person.id,assignment)
    tileIds.add(assignment.tile_entity_id)
  }

  let tiles:TileEntityRow[]=[]
  if(tileIds.size){
    const {data,error}=await supabase.from('tile_entities').select('id, entity_id').in('id',[...tileIds])
    if(error)throw error
    tiles=data??[]
  }
  const tileById=new Map(tiles.map(row=>[row.id,row]))

  const {data:existingRows,error:presenceError}=await supabase
    .from('person_interior_presence')
    .select('*')
    .in('person_id',people.map(person=>person.id))
  if(presenceError)throw presenceError
  const existingByPerson=new Map((existingRows??[]).map((row:any)=>[row.person_id,row]))

  const keep=new Set<string>()
  const upserts:any[]=[]

  for(const person of people){
    const assignment=assignmentByPerson.get(person.id)
    if(!assignment?.tile_entity_id)continue
    const tile=tileById.get(assignment.tile_entity_id)
    if(!tile)continue
    const template=getInteriorTemplateForBuildingType(tile.entity_id)
    if(!template?.rooms.length)continue

    keep.add(person.id)
    const target=targetInteriorRoom({
      template,
      activity:person.activity_state,
      assignmentType:assignment.assignment_type,
      roleCode:assignment.role_code,
    })
    const existing:any=existingByPerson.get(person.id)
    const sameHost=existing?.tile_entity_id===tile.id && existing?.template_id===template.id
    let roomId:RoomId = sameHost && template.rooms.some(room=>room.id===existing.room_id)
      ? existing.room_id
      : firstRoom(template,['entry','airlock','reception'],['arrival'],['entrance','airlock'])
    let enteredTick = sameHost ? existing.entered_tick ?? tick : tick

    if(roomId!==target){
      const instance=defaultInstance(template,tile.id)
      const isWorker=assignment.assignment_type==='work'
      const route=findInteriorRoute(template,instance,roomId,target,{
        canUsePortal:portalId=>{
          const portal=template.portals.find(item=>item.id===portalId)
          if(!portal?.accessTags?.length)return true
          if(portal.accessTags.includes('staff'))return isWorker
          return true
        },
      })
      const next=route?.steps[0]?.toRoomId
      if(next&&next!==roomId){
        roomId=next
        enteredTick=tick
        result.moved+=1
      }
    }

    if(!sameHost)result.entered+=1
    const presenceChanged =
      !sameHost
      || existing?.room_id !== roomId
      || existing?.target_room_id !== target
      || existing?.source_assignment_id !== assignment.id
      || existing?.source_kind !== (assignment.assignment_type==='temporary'?'visit':'assignment')
    if(!presenceChanged){
      result.projected+=1
      continue
    }
    upserts.push({
      person_id:person.id,
      tile_entity_id:tile.id,
      template_id:template.id,
      room_id:roomId,
      target_room_id:target,
      source_assignment_id:assignment.id,
      source_kind:assignment.assignment_type==='temporary'?'visit':'assignment',
      entered_tick:enteredTick,
      updated_tick:tick,
      updated_at:new Date().toISOString(),
    })
    result.projected+=1
  }

  const stale=(existingRows??[]).filter((row:any)=>!keep.has(row.person_id)).map((row:any)=>row.person_id)
  if(stale.length){
    const {error}=await supabase.from('person_interior_presence').delete().in('person_id',stale)
    if(error)throw error
    result.cleared=stale.length
  }
  if(upserts.length){
    const {error}=await supabase.from('person_interior_presence').upsert(upserts,{onConflict:'person_id'})
    if(error)throw error
  }
  return result
}
