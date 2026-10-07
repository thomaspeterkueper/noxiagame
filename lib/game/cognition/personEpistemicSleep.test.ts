import { sleepConsolidationRows, type PersistedEpistemicTrace } from './personEpistemicPersistence'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}
const trace=(id:string,person_id:string,salience:number,observed_tick:number):PersistedEpistemicTrace=>({id,person_id,subject_ref:'building:cafe',attribute:'nearby_place',value:{},source_type:'simulation',source_ref:'scene',modality:'visual',provenance_refs:[],confidence:.8,salience,observed_tick,trace_kind:'observation'})
const rows=sleepConsolidationRows({sleepingPersonIds:['hana'],traces:[trace('recent','hana',.9,90),trace('old','hana',.2,1),trace('lan','lan',1,99)],tick:100})
check(rows.length===2,'only sleeping persons are consolidated')
check(rows[0].trace_id==='recent','salient recent trace ranks first')
check(rows.every(row=>row.person_id==='hana'&&row.consolidated_tick===100),'projection remains actor scoped')
check(rows[0].retention>rows[1].retention,'retention uses shared person cognition policy')
if(failures)throw new Error(String(failures)+' sleep epistemic consolidation test(s) failed')
console.log('Sleep epistemic consolidation: tests passed; external_llm_calls=0')
