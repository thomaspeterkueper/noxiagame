import { NextRequest, NextResponse } from 'next/server'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }

/**
 * Test-mode review of NPC transcripts.
 * No player opt-in, but NO retrieval before a configured notice-effective date.
 * A documented lawful basis and visible notice are prerequisites for enabling
 * NOXIA_TEST_TRANSCRIPT_REVIEW_SINCE in the production environment.
 */
export async function GET(req: NextRequest) {
  const actor = await verifiedBearerUserId(req)
  if (!actor) return NextResponse.json({error:'Anmeldung erforderlich'}, {status:401})
  const db = createServiceClient()
  const {data:admin,error:adminError}=await db.from('admin_profiles')
    .select('profile_id').eq('profile_id',actor).maybeSingle()
  if(adminError || !admin) return NextResponse.json({error:'Keine Adminberechtigung'},{status:403})

  const start = process.env.NOXIA_TEST_TRANSCRIPT_REVIEW_SINCE
  if(!start || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(start)
    || !Number.isFinite(Date.parse(start))) {
    return NextResponse.json({
      rows:[],
      enabled:false,
      note:'Testdiagnostik noch nicht freigeschaltet: Datenschutzhinweis, Interessenabwägung und Stichtag fehlen.',
    },{headers})
  }

  const npcId=req.nextUrl.searchParams.get('npcId')
  const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
  if(npcId && !uuid.test(npcId)) return NextResponse.json({error:'Ungültige NPC-ID'},{status:400})
  const cursor=req.nextUrl.searchParams.get('before')
  if(cursor && (Number.isNaN(Date.parse(cursor)) || cursor.length>40))
    return NextResponse.json({error:'Ungültiger Zeitpunkt'},{status:400})

  let query=db.from('npc_conversation_log')
    .select('id,created_at,player_profile_id,npc_person_id,npc_name,npc_role,location_name,player_text,npc_reply,topic,outcome,world_action,wish_kind,wish_object,wish_npc_denied,headline,turn_index,opening')
    .gte('created_at',start).order('created_at',{ascending:false}).limit(50)
  if(npcId)query=query.eq('npc_person_id',npcId)
  if(cursor)query=query.lt('created_at',cursor)
  const {data:raw,error}=await query
  if(error)return NextResponse.json({error:'Gespräche nicht verfügbar'},{status:503})
  const rows=(raw??[]).filter(row=>row.player_profile_id)
  if(rows.length>0){
    const {error:auditError}=await db.from('admin_conversation_read_audit').insert(rows.map(row=>({
      admin_profile_id:actor,profile_id:row.player_profile_id,conversation_log_id:row.id,
    })))
    if(auditError) return NextResponse.json({error:'Zugriffsprotokoll konnte nicht geschrieben werden'},{status:503})
  }
  return NextResponse.json({
    rows,
    enabled:true,
    note:'Offen angekündigte Testdiagnostik, nur ab dem Freischaltungsstichtag; Weltaktion ist noch kein nachgewiesener persistierter Effekt.',
  },{headers})
}
