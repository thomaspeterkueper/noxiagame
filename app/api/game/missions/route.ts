// app/api/game/missions/route.ts
// Start missions backed by real game state.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

type Step = { id:string; title:string; description:string; action:'shipyard'|'warehouse'|'travel'|'grid'|'academy'|'none' }
type Mission = { id:string; title:string; theme:string; summary:string; reward:string; steps:Step[] }

const MISSIONS: Mission[] = [
  { id:'m_start_ship',title:'Startklar',theme:'Raumfahrt',summary:'Besorgen Sie sich ein einsatzfähiges Schiff. Ohne Schiff bleiben Handel, Expansion und Mondprogramm Theorie.',reward:'+ Orientierung',steps:[{id:'ship_owned',title:'Ein Schiff besitzen',description:'Öffnen Sie die Werft und kaufen oder aktivieren Sie ein geeignetes Schiff.',action:'shipyard'}]},
  { id:'m_first_trade',title:'Der erste Handel',theme:'Handel',summary:'Kaufen Sie Ware an einem Standort und verkaufen oder liefern Sie sie an anderer Stelle.',reward:'+ Handelsverständnis',steps:[{id:'cargo_ready',title:'Laderaum nutzen',description:'Öffnen Sie das Warenhaus und kaufen Sie Wasser, Energie oder Metall.',action:'warehouse'},{id:'trade_done',title:'Ersten Handel abschließen',description:'Verkaufen Sie Ware oder erfüllen Sie einen Auftrag.',action:'warehouse'}]},
  { id:'m_first_flight',title:'Der erste Flug',theme:'Navigation',summary:'Reisen Sie zu einem anderen Standort. Dadurch wird klar, dass Noxia nicht an einem Ort stattfindet.',reward:'+ Raumgefühl',steps:[{id:'flight_done',title:'Standort wechseln',description:'Öffnen Sie die Standort-/Reiseansicht und fliegen Sie zu einem erreichbaren Ziel.',action:'travel'}]},
  { id:'m_first_industry',title:'Erste Produktion',theme:'Industrie',summary:'Errichten Sie ein Produktionsgebäude. Energie, Wasser und Metall sind die Grundlage späterer Kolonien.',reward:'+ Produktionsverständnis',steps:[{id:'production_built',title:'Produktionsgebäude bauen',description:'Klicken Sie auf eine freie Kachel und bauen Sie z. B. Solarfeld, Mine oder Eisbohrer.',action:'grid'}]},
  { id:'m_first_knowledge',title:'Wissen freischalten',theme:'Forschung',summary:'Wissenschaft ist ein Kernmotor von Noxia. Sammeln Sie erste Wissenspunkte.',reward:'+ Forschungsverständnis',steps:[{id:'knowledge_gained',title:'Erste Wissenspunkte sammeln',description:'Suchen Sie eine Akademie und nutzen Sie Aufgaben oder Handbuch.',action:'academy'}]},
  { id:'m_moon_basis',title:'Die erste Mondbasis',theme:'Kolonisation',summary:'Verbinden Sie Raumfahrt, Versorgung und Bau zu einer dauerhaften Präsenz auf dem Mond.',reward:'+ Mondprogramm',steps:[{id:'moon_reached',title:'Mond erreichen',description:'Fliegen Sie zum Mond oder besitzen Sie dort ein erstes Gebäude.',action:'travel'},{id:'moon_power',title:'Energie auf dem Mond sichern',description:'Bauen Sie ein Solarfeld oder eine andere Energiequelle auf dem Mond.',action:'grid'},{id:'moon_water',title:'Wasser oder Eis sichern',description:'Bauen Sie einen Eisbohrer oder Wasserextraktor auf dem Mond.',action:'grid'}]},
  {
    id:'m_phobos_stickney',title:'Stickney-Einsatz',theme:'Phobos · Mikrogravitation',
    summary:'Nehmen Sie Base Alpha wissenschaftlich in Betrieb: Tether-Versorgung, Prospektion, Referenzprobe, Rücktransport und Feldlabor-Auswertung.',
    reward:'+ Stickney-Operationen',
    steps:[
      {id:'phobos_reached',title:'Phobos erreichen',description:'Bringen Sie Ihr aktives Schiff nach Phobos und übernehmen Sie Base Alpha.',action:'travel'},
      {id:'phobos_supply',title:'Tether-Versorgung fahren',description:'Führen Sie einen Oberflächentransport vom Stickney Anchor Field zum Base-Alpha-Depot durch.',action:'grid'},
      {id:'phobos_prospect',title:'Stickney prospektieren',description:'Erfassen Sie mindestens ein modelliertes Vorkommen.',action:'grid'},
      {id:'phobos_sample_return',title:'Referenzprobe zurückbringen',description:'Entnehmen Sie eine Referenzprobe und bringen Sie sie mit Tether Rover 01 zum Base-Alpha-Depot.',action:'grid'},
      {id:'phobos_sample_analysis',title:'Probe wissenschaftlich auswerten',description:'Analysieren Sie die zurückgebrachte Probe im Base-Alpha-Feldlabor und erhalten Sie eine bestätigte, unklare oder verworfene Ressourcenaussage.',action:'grid'},
    ],
  },
]

async function getUserFromRequest(req: NextRequest){const h=req.headers.get('authorization');if(!h?.startsWith('Bearer '))return null;const s=createServiceClient();const {data:{user}}=await s.auth.getUser(h.split(' ')[1]);return user}
function isProductionEntity(id:string){return ['solar','solar_field','mine','ice_drill','water_extractor','power_plant'].includes(id)}
type MissionContext={ships:any[];entities:any[];trades:any[];profile:any;knowledge:number;cargoUsed:number;phobosJobs:any[];phobosScanCount:number;phobosAnalysisCount:number}
function completedStepIds(stepId:string,ctx:MissionContext){switch(stepId){
 case'ship_owned':return ctx.ships.length>0;case'cargo_ready':return ctx.cargoUsed>0||(ctx.trades?.length??0)>0;case'trade_done':return(ctx.trades?.length??0)>0;case'flight_done':return(ctx.profile?.flight_count??0)>0||ctx.profile?.current_location!=='earth';case'production_built':return ctx.entities.some(e=>isProductionEntity(e.entity_id));case'knowledge_gained':return ctx.knowledge>0;case'moon_reached':return ctx.profile?.current_location==='moon'||ctx.entities.some(e=>e.locations?.slug==='moon');case'moon_power':return ctx.entities.some(e=>e.locations?.slug==='moon'&&['solar','solar_field','power_plant'].includes(e.entity_id));case'moon_water':return ctx.entities.some(e=>e.locations?.slug==='moon'&&['ice_drill','water_extractor'].includes(e.entity_id));case'phobos_reached':return ctx.profile?.current_location==='phobos';case'phobos_supply':return ctx.phobosJobs.some(j=>j.domain==='surface'&&j.status==='completed'&&j.vehicle_role==='Tether Rover 01'&&j.resource!=='research_sample');case'phobos_prospect':return ctx.phobosScanCount>0;case'phobos_sample_return':return ctx.phobosJobs.some(j=>j.domain==='surface'&&j.status==='completed'&&j.vehicle_role==='Tether Rover 01'&&j.resource==='research_sample');case'phobos_sample_analysis':return ctx.phobosAnalysisCount>0;default:return false}}

export async function GET(req:NextRequest){
 const user=await getUserFromRequest(req);if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});const s=createServiceClient()
 const [shipsR,entitiesR,tradesR,profileR,knowledgeR,phobosLocationR]=await Promise.all([
  s.from('ships').select('*').eq('profile_id',user.id),s.from('tile_entities').select('*, locations(slug)').eq('profile_id',user.id),s.from('trade_transactions').select('id').eq('profile_id',user.id).limit(50),s.from('profiles').select('current_location, flight_count').eq('id',user.id).single(),s.from('player_knowledge').select('knowledge_points').eq('profile_id',user.id).single(),s.from('locations').select('id').eq('slug','phobos').maybeSingle(),
 ])
 const ships=shipsR.data??[],entities=entitiesR.data??[],trades=tradesR.data??[],profile=profileR.data??{},knowledge=knowledgeR.data?.knowledge_points??0,activeShip=ships.find((x:any)=>x.is_active)??ships[0]
 const {data:cargoRows}=activeShip?.id?await s.from('ship_cargo').select('amount').eq('ship_id',activeShip.id):{data:[]};const cargoUsed=(cargoRows??[]).reduce((sum:number,row:any)=>sum+Number(row.amount??0),0),phobosId=phobosLocationR.data?.id??null
 const [jobsR,scansR,analysisR]=await Promise.all([
  phobosId?s.from('transport_jobs').select('id,domain,status,vehicle_role,resource').eq('actor_profile_id',user.id).eq('location_id',phobosId).limit(100):Promise.resolve({data:[] as any[]}),
  s.from('region_resources').select('id').contains('properties',{body:'phobos',discovered_by:user.id}).not('discovered_at','is',null).limit(10),
  s.from('sample_analyses').select('id').eq('analyst_profile_id',user.id).limit(10),
 ])
 const ctx:MissionContext={ships,entities,trades,profile,knowledge,cargoUsed,phobosJobs:jobsR.data??[],phobosScanCount:(scansR.data??[]).length,phobosAnalysisCount:(analysisR.data??[]).length}
 const missions=MISSIONS.map(m=>{const steps=m.steps.map(step=>({...step,completed:completedStepIds(step.id,ctx)})),completed=steps.filter(x=>x.completed).length,total=steps.length;return{...m,steps,completed,total,progress_percent:Math.round(completed/Math.max(1,total)*100),status:completed>=total?'completed':'active',nextStep:steps.find(x=>!x.completed)??null}})
 return NextResponse.json({missions})
}
