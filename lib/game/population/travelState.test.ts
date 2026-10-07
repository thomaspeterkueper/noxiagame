import { createTravelState,advanceTravel,travelStreetPoint } from './travelState'
const streets:any[]=[{row:0,col:0,mask:2,subtype:'side'},{row:0,col:1,mask:10,subtype:'main'},{row:0,col:2,mask:8,subtype:'side'}]
let failures=0;const check=(x:boolean,l:string)=>{if(!x){failures++;console.error('FAIL: '+l)}}
const s=createTravelState({personId:'hana',from:{tileEntityId:'home',locationId:'earth',row:0,col:0},to:{tileEntityId:'cafe',locationId:'earth',row:0,col:2},streets,tick:1})
check(Boolean(s)&&s!.route.length===3,'travel uses canonical street path')
const mid=advanceTravel(s!,2,.5);check(travelStreetPoint(mid)?.col===1,'travel progress produces deterministic street position')
const arrived=advanceTravel(mid,3,.5);check(arrived.status==='arrived'&&arrived.progress===1,'travel arrives deterministically')
check(createTravelState({personId:'x',from:{tileEntityId:'a',locationId:'earth',row:0,col:0},to:{tileEntityId:'b',locationId:'mars',row:0,col:2},streets,tick:1})===null,'cross-location street travel rejected')
if(failures)throw new Error(String(failures)+' travel state test(s) failed');console.log('Authoritative travel state: tests passed')
