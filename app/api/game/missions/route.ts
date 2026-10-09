// app/api/game/missions/route.ts
// Start missions backed by real game state.
// Aktualisiert: 09.10.2026 — „Eigenes Schiff" ist kein Pflicht-Einstieg mehr (schiffloser Start),
//               Mission ans Ende der Grundmissionen verschoben; Texte ohne „Kachel"
// Version:      1.0.1

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

type Step = { id:string; title:string; description:string; action:'shipyard'|'warehouse'|'travel'|'grid'|'academy'|'none' }
type Mission = { id:string; title:string; theme:string; summary:string; reward:string; steps:Step[] }

const MISSIONS: Mission[] = [
  { id:'m_first_trade',title:'Der erste Handel',theme:'Handel',summary:'Kaufen Sie Ware an einem Standort und verkaufen oder liefern Sie sie an anderer Stelle.',reward:'+ Handelsverständnis',steps:[{id:'cargo_ready',title:'Laderaum nutzen',description:'Öffnen Sie das Warenhaus und kaufen Sie Wasser, Energie oder Metall.',action:'warehouse'},{id:'trade_done',title:'Ersten Handel abschließen',description:'Verkaufen Sie Ware oder erfüllen Sie einen Auftrag.',action:'warehouse'}]},
  { id:'m_first_flight',title:'Der erste Flug',theme:'Navigation',summary:'Reisen Sie zu einem anderen Standort. Dadurch wird klar, dass Noxia nicht an einem Ort stattfindet.',reward:'+ Raumgefühl',steps:[{id:'flight_done',title:'Standort wechseln',description:'Öffnen Sie die Standort-/Reiseansicht und fliegen Sie zu einem erreichbaren Ziel.',action:'travel'}]},
  { id:'m_first_industry',title:'Erste Produktion',theme:'Industrie',summary:'Errichten Sie ein Produktionsgebäude. Energie, Wasser und Metall sind die Grundlage späterer Kolonien.',reward:'+ Produktionsverständnis',steps:[{id:'production_built',title:'Produktionsgebäude bauen',description:'Wählen Sie eine freie Stelle auf der Karte und bauen Sie z. B. Solarfeld, Mine oder Eisbohrer.',action:'grid'}]},
  { id:'m_first_knowledge',title:'Wissen freischalten',theme:'Forschung',summary:'Wissenschaft ist ein Kernmotor von Noxia. Sammeln Sie erste Wissenspunkte.',reward:'+ Forschungsverständnis',steps:[{id:'knowledge_gained',title:'Erste Wissenspunkte sammeln',description:'Suchen Sie eine Akademie und nutzen Sie Aufgaben oder Handbuch.',action:'academy'}]},
  { id:'m_moon_basis',title:'Die erste Mondbasis',theme:'Kolonisation',summary:'Verbinden Sie Raumfahrt, Versorgung und Bau zu einer dauerhaften Präsenz auf dem Mond.',reward:'+ Mondprogramm',steps:[{id:'moon_reached',title:'Mond erreichen',description:'Fliegen Sie zum Mond oder besitzen Sie dort ein erstes Gebäude.',action:'travel'},{id:'moon_power',title:'Energie auf dem Mond sichern',description:'Bauen Sie ein Solarfeld oder eine andere Energiequelle auf dem Mond.',action:'grid'},{id:'moon_water',title:'Wasser oder Eis sichern',description:'Bauen Sie einen Eisbohrer oder Wasserextraktor auf dem Mond.',action:'grid'}]},
  { id:'m_start_ship',title:'Eigenes Schiff',theme:'Raumfahrt',summary:'Linienflüge und Spediteure genügen für den Anfang. Ein eigenes Schiff bringt mehr Laderaum und Tempo.',reward:'+ Unabhängigkeit',steps:[{id:'ship_owned',title:'Ein Schiff besitzen',description:'Öffnen Sie die Werft und kaufen Sie ein Schiff, sobald Ihr Guthaben reicht.',action:'shipyard'}]},
  {
    id:'m_phobos_stickney',title:'Stickney-Einsatz',theme:'Phobos · Mikrogravitation',
    summary:'Nehmen Sie Base Alpha wissenschaftlich und technisch in Betrieb: Versorgung, Prospektion, direkte Bohrkern-Evidenz und robotischer Pilotabbau.',
    reward:'+ Stickney-Feldforschung & Robotik',
    steps:[
      {id:'phobos_reached',title:'Phobos erreichen',description:'Bringen Sie Ihr aktives Schiff nach Phobos und übernehmen Sie Base Alpha.',action:'travel'},
      {id:'phobos_supply',title:'Tether-Versorgung fahren',description:'Führen Sie den Versorgungstransport vom Stickney Anchor Field zum Base-Alpha-Depot durch.',action:'grid'},
      {id:'phobos_prospect',title:'Stickney prospektieren',description:'Führen Sie einen lokalen Prospektionsscan durch. Entdeckte Ziele gehen in den gemeinsamen Weltzustand ein; Ihre Teilnahme wird separat protokolliert.',action:'grid'},
      {id:'phobos_sample_return',title:'Referenzprobe zurückbringen',description:'Entnehmen Sie eine Referenzprobe und bringen Sie sie mit Tether Rover 01 zum Base-Alpha-Depot.',action:'grid'},
      {id:'phobos_sample_analysis',title:'Referenzprobe auswerten',description:'Analysieren Sie die zurückgebrachte Probe und erhalten Sie gegebenenfalls eine wissenschaftliche Bohrfreigabe.',action:'grid'},
      {id:'phobos_drill_deploy',title:'Bohrgerät ausrücken',description:'Bringen Sie Bohrgerät und Verbrauchsmaterial zu einem wissenschaftlich freigegebenen Prospektionsziel.',action:'grid'},
      {id:'phobos_core_collect',title:'Bohrkern gewinnen',description:'Führen Sie die autorisierte 10-m-Bohrung aus und gewinnen Sie einen direkten Bohrkern.',action:'grid'},
      {id:'phobos_core_return',title:'Bohrkern zurückbringen',description:'Bringen Sie den Bohrkern mit Tether Rover 01 zurück in das Base-Alpha-Kernlabor.',action:'grid'},
      {id:'phobos_core_analysis',title:'Bohrkern auswerten',description:'Führen Sie die hochauflösende Kernanalyse durch. Erst diese Evidenzstufe kann einen Abbaukandidaten erzeugen.',action:'grid'},
      {id:'phobos_robotic_pilot',title:'Robotischen Pilotabbau fahren',description:'Setzen Sie den Stickney Excavation Robot 01 auf einen Abbaukandidaten an und bewerten Sie Testmasse, Energiebedarf und Verschleiß.',action:'grid'},
    ],
  },
]

async function getUserFromRequest(req: NextRequest){const h=req.headers.get('authorization');if(!h?.startsWith('Bearer '))return null;const s=createServiceClient();const {data:{user}}=await s.auth.getUser(h.split(' ')[1]);return user}
function isProductionEntity(id:string){return ['solar','solar_field','mine','ice_drill','water_extractor','power_plant'].includes(id)}
type MissionContext={ships:any[];entities:any[];trades:any[];profile:any;knowledge:number;cargoUsed:number;phobosJobs:any[];phobosScanCount:number;referenceSamples:any[];coreSamples:any[];pilotJobs:any[]}
function completedStepIds(stepId:string,ctx:MissionContext){switch(stepId){
 case'ship_owned':return ctx.ships.length>0;case'cargo_ready':return ctx.cargoUsed>0||(ctx.trades?.length??0)>0;case'trade_done':return(ctx.trades?.length??0)>0;case'flight_done':return(ctx.profile?.flight_count??0)>0||ctx.profile?.current_location!=='earth';case'production_built':return ctx.entities.some(e=>isProductionEntity(e.entity_id));case'knowledge_gained':return ctx.knowledge>0;case'moon_reached':return ctx.profile?.current_location==='moon'||ctx.entities.some(e=>e.locations?.slug==='moon');case'moon_power':return ctx.entities.some(e=>e.locations?.slug==='moon'&&['solar','solar_field','power_plant'].includes(e.entity_id));case'moon_water':return ctx.entities.some(e=>e.locations?.slug==='moon'&&['ice_drill','water_extractor'].includes(e.entity_id));case'phobos_reached':return ctx.profile?.current_location==='phobos';case'phobos_supply':return ctx.phobosJobs.some(j=>j.domain==='surface'&&j.status==='completed'&&j.route_snapshot?.routeKind==='anchor-tether');case'phobos_prospect':return ctx.phobosScanCount>0;case'phobos_sample_return':return ctx.phobosJobs.some(j=>j.domain==='surface'&&j.status==='completed'&&j.route_snapshot?.routeKind==='prospect-sample-return');case'phobos_sample_analysis':return ctx.referenceSamples.some(s=>s.status==='analyzed'||Boolean(s.analyzed_at));case'phobos_drill_deploy':return ctx.phobosJobs.some(j=>j.domain==='surface'&&j.status==='completed'&&j.route_snapshot?.routeKind==='prospect-drill-deployment');case'phobos_core_collect':return ctx.coreSamples.length>0;case'phobos_core_return':return ctx.coreSamples.some(s=>s.status==='returned'||s.status==='analyzed');case'phobos_core_analysis':return ctx.coreSamples.some(s=>s.status==='analyzed'||Boolean(s.analyzed_at));case'phobos_robotic_pilot':return ctx.pilotJobs.some(j=>j.status==='completed');default:return false}}

export async function GET(req:NextRequest){
 const user=await getUserFromRequest(req);if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});const s=createServiceClient()
 const [shipsR,entitiesR,tradesR,profileR,knowledgeR,phobosLocationR]=await Promise.all([
  s.from('ships').select('*').eq('profile_id',user.id),s.from('tile_entities').select('*, locations(slug)').eq('profile_id',user.id),s.from('trade_transactions').select('id').eq('profile_id',user.id).limit(50),s.from('profiles').select('current_location, flight_count').eq('id',user.id).single(),s.from('player_knowledge').select('knowledge_points').eq('profile_id',user.id).single(),s.from('locations').select('id').eq('slug','phobos').maybeSingle(),
 ])
 const ships=shipsR.data??[],entities=entitiesR.data??[],trades=tradesR.data??[],profile=profileR.data??{},knowledge=knowledgeR.data?.knowledge_points??0,activeShip=ships.find((x:any)=>x.is_active)??ships[0]
 // Ohne Schiff (Spediteur-Pfad) liegt die Ware in profile_cargo statt ship_cargo.
 const {data:cargoRows}=activeShip?.id?await s.from('ship_cargo').select('amount').eq('ship_id',activeShip.id):await s.from('profile_cargo').select('amount').eq('profile_id',user.id)
 const cargoUsed=(cargoRows??[]).reduce((sum:number,row:any)=>sum+Number(row.amount??0),0),phobosId=phobosLocationR.data?.id??null
 const [jobsR,scansR,referenceR,coreR,pilotR]=await Promise.all([
  phobosId?s.from('transport_jobs').select('id,domain,status,vehicle_role,resource,route_snapshot').eq('actor_profile_id',user.id).eq('location_id',phobosId).limit(150):Promise.resolve({data:[] as any[]}),
  phobosId?s.from('events').select('id').eq('profile_id',user.id).eq('location_id',phobosId).eq('type','phobos_prospect_scan').limit(20):Promise.resolve({data:[] as any[]}),
  s.from('research_samples').select('id,status,analyzed_at').eq('owner_profile_id',user.id).neq('sample_kind','drill_core').limit(20),
  s.from('research_samples').select('id,status,analyzed_at').eq('owner_profile_id',user.id).eq('sample_kind','drill_core').limit(20),
  phobosId?s.from('pilot_extraction_jobs').select('id,status,result').eq('profile_id',user.id).eq('location_id',phobosId).limit(20):Promise.resolve({data:[] as any[]}),
 ])
 const ctx:MissionContext={ships,entities,trades,profile,knowledge,cargoUsed,phobosJobs:jobsR.data??[],phobosScanCount:(scansR.data??[]).length,referenceSamples:referenceR.data??[],coreSamples:coreR.data??[],pilotJobs:pilotR.data??[]}
 const missions=MISSIONS.map(m=>{const steps=m.steps.map(step=>({...step,completed:completedStepIds(step.id,ctx)})),completed=steps.filter(x=>x.completed).length,total=steps.length;return{...m,steps,completed,total,progress_percent:Math.round(completed/Math.max(1,total)*100),status:completed>=total?'completed':'active',nextStep:steps.find(x=>!x.completed)??null}})
 return NextResponse.json({missions})
}
