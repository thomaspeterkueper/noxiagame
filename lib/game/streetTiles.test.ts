import { getCanonicalStreetTiles,getStreetTiles } from './streetTiles'
let failures=0;const check=(x:boolean,l:string)=>{if(!x){failures++;console.error('FAIL: '+l)}}
const entities:any[]=[{id:'r',entity_id:'road',entity_type:'building',profile_id:null,tile_row:2,tile_col:2,owner_class:'STATE'}]
const a=getStreetTiles('earth',500,entities,[],'player-a',32,24)
const b=getCanonicalStreetTiles('earth',500,entities,[],32,24)
check(JSON.stringify(a.map(x=>[x.row,x.col,x.mask]))===JSON.stringify(b.map(x=>[x.row,x.col,x.mask])),'ownership context cannot change street topology')
check(b.some(x=>x.row===2&&x.col===2),'persisted road entity belongs to canonical topology')
if(failures)throw new Error(String(failures)+' canonical street test(s) failed');console.log('Canonical street runtime: tests passed')
