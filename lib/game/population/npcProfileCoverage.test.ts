import { npcProfileCoverage } from './npcProfileCoverage'
const a=npcProfileCoverage({personId:'npc-1',name:'Lan',bio:'',traits:{curiosity:0},needs:[],health:null})
if(a.complete || a.sections.identity!=='recorded' || a.sections.traits!=='recorded')throw Error('partial coverage')
if(a.sections.biography!=='missing'||a.sections.needs!=='missing'||a.sections.health!=='missing')throw Error('missing facts')
const b=npcProfileCoverage({personId:'npc-2',name:'Tirin',bio:'Chronist',traits:{x:1},needs:[1],health:{},relationships:[1],memories:[1],conversations:[1],events:[1],physiology:{}})
if(!b.complete)throw Error('complete facts')
let threw=false;try{npcProfileCoverage({personId:'',name:'X'})}catch{threw=true}if(!threw)throw Error('identity guard')
console.log('NPC profile coverage tests passed')
