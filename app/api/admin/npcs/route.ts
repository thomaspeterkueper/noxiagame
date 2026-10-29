import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'

export async function GET(req: NextRequest) {
  const userId = await verifiedBearerUserId(req)
  if (!userId) return NextResponse.json({error:'Kein Zugang'}, {status:403})
  const db = createServiceClient()
  const {data:admin,error:adminError} = await db.from('admin_profiles').select('profile_id').eq('profile_id',userId).maybeSingle()
  if (adminError || !admin) return NextResponse.json({error:'Kein Adminzugang'}, {status:403})
  const npcId = new URL(req.url).searchParams.get('id')
  if (npcId && !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(npcId)) return NextResponse.json({error:'Ungültige ID'}, {status:400})
  if (!npcId) {
    const {data,error} = await db.from('people')
      .select('id,person_key,display_name,public_role,bio_short,simulation_tier,activity_state,last_action,last_tick')
      .order('display_name').limit(100)
    if (error) return NextResponse.json({error:'Personenliste nicht verfügbar'}, {status:500})
    return NextResponse.json({people:data??[],limit:100},{headers:{'Cache-Control':'private, no-store'}})
  }
  const [{data:person,error:personError},{data:health},{data:needs},{data:events},{data:conversations}] = await Promise.all([
    db.from('people').select('id,person_key,display_name,public_role,bio_short,simulation_tier,activity_state,last_action,last_tick,birth_year,traits').eq('id',npcId).maybeSingle(),
    db.from('person_health').select('wellbeing,condition_code,severity,requires_medical_care,updated_tick,updated_at').eq('person_id',npcId).maybeSingle(),
    db.from('person_needs').select('need_code,satisfaction,updated_tick').eq('person_id',npcId).limit(30),
    db.from('population_events').select('id,event_type,occurred_at,payload').eq('actor_person_id',npcId).order('occurred_at',{ascending:false}).limit(40),
    db.from('npc_conversation_log').select('created_at,npc_name,npc_role,location_name,outcome,turn_index,topic,world_action').eq('npc_person_id',npcId).order('created_at',{ascending:false}).limit(40),
  ])
  if (personError || !person) return NextResponse.json({error:'NPC nicht gefunden'}, {status:404})
  return NextResponse.json({person,health:health??null,needs:needs??[],events:events??[],conversations:conversations??[],
    unavailable:['hormone_state','persistent_memory_details','relationship_graph'],
    note:'Gesprächsmetadaten statt privater Spielerwortlaute; nicht gespeicherte Zustände werden nicht geschätzt.'
  },{headers:{'Cache-Control':'private, no-store'}})
}
