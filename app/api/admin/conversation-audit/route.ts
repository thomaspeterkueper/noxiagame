import { NextRequest, NextResponse } from 'next/server'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }

/**
 * Review only post-consent player transcripts. No historical backfill.
 * GET response is limited to 50 rows, and every returned text row gets a
 * corresponding mandatory audit record before the response is sent.
 */
export async function GET(req: NextRequest) {
  const actor = await verifiedBearerUserId(req)
  if (!actor) return NextResponse.json({error:'Anmeldung erforderlich'}, {status:401})
  const db = createServiceClient()
  const {data:admin,error:adminError} = await db.from('admin_profiles')
    .select('profile_id').eq('profile_id',actor).maybeSingle()
  if (adminError || !admin) return NextResponse.json({error:'Keine Adminberechtigung'}, {status:403})

  const {data:consents,error:consentError} = await db.from('player_conversation_diagnostic_consent')
    .select('profile_id,granted_at').eq('enabled',true).not('granted_at','is',null).limit(1000)
  if (consentError) return NextResponse.json({error:'Freigaben nicht abrufbar'}, {status:503})
  const permitted = new Map((consents??[]).map(c => [c.profile_id,c.granted_at as string]))
  // Metadata counts must not be mistaken for visible user transcripts.
  if (permitted.size===0) return NextResponse.json({rows:[],consenting_players:0,note:'Keine aktiven Einwilligungen. Historische Gespräche bleiben gesperrt.'},{headers})

  const npcId = req.nextUrl.searchParams.get('npcId')
  const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
  if (npcId && !uuid.test(npcId)) return NextResponse.json({error:'Ungültige NPC-ID'}, {status:400})
  const cursor = req.nextUrl.searchParams.get('before')
  if (cursor && (Number.isNaN(Date.parse(cursor)) || cursor.length>40)) return NextResponse.json({error:'Ungültiger Zeitpunkt'}, {status:400})

  let query = db.from('npc_conversation_log')
    .select('id,created_at,player_profile_id,npc_person_id,npc_name,npc_role,location_name,player_text,npc_reply,topic,outcome,world_action,wish_kind,wish_object,wish_npc_denied,headline,turn_index,opening')
    .in('player_profile_id',[...permitted.keys()])
    .order('created_at',{ascending:false}).limit(200)
  if(npcId)query=query.eq('npc_person_id',npcId)
  if(cursor)query=query.lt('created_at',cursor)
  const {data:raw,error}=await query
  if(error) return NextResponse.json({error:'Gespräche nicht verfügbar'},{status:503})

  const rows=(raw??[])
    .filter(row=>row.player_profile_id && permitted.has(row.player_profile_id)
      && new Date(row.created_at).getTime() >= Date.parse(permitted.get(row.player_profile_id)!))
    .slice(0,50)
  if(rows.length>0){
    const {error:auditError}=await db.from('admin_conversation_read_audit').insert(rows.map(row=>({
      admin_profile_id:actor,
      profile_id:row.player_profile_id,
      conversation_log_id:row.id,
    })))
    if(auditError) return NextResponse.json({error:'Abrufprotokoll konnte nicht geschrieben werden'},{status:503})
  }
  // Identifiers are retained for audit correlation, but not emails or profile details.
  return NextResponse.json({
    rows:rows.map(row=>({
      id:row.id,created_at:row.created_at,player_profile_id:row.player_profile_id,
      npc_person_id:row.npc_person_id,npc_name:row.npc_name,npc_role:row.npc_role,
      location_name:row.location_name,player_text:row.player_text,npc_reply:row.npc_reply,
      topic:row.topic,outcome:row.outcome,world_action:row.world_action,
      wish_kind:row.wish_kind,wish_object:row.wish_object,
      wish_npc_denied:row.wish_npc_denied,headline:row.headline,
      turn_index:row.turn_index,opening:row.opening,
    })),
    consenting_players:permitted.size,
    note:'Nur nach aktiver Einwilligung protokollierte Dialoge. world_action ist ein Protokollsignal und noch kein garantierter Nachweis eines persistierten Welt-Effekts.',
    truncated:raw?.length===200,
  },{headers})
}
