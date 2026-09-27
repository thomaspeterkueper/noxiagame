import type { InteriorTemplate } from '../types'
export const RESONANCE_CENTRE_INTERIOR: InteriorTemplate = {
 id:'resonance-centre-01', buildingTypeId:'resonance_centre', hostKinds:['building'], name:'Resonance Centre', version:1,
 levels:[{id:'level-0',name:'Main level',order:0,elevationM:0}],
 rooms:[
  {id:'entry',levelId:'level-0',name:'Open foyer',kind:'entrance',capacity:18,tags:['entry','plural-use']},
  {id:'resonance-room',levelId:'level-0',name:'Resonance room',kind:'service',capacity:32,capabilities:['culture.reflection','culture.meditation'],tags:['quiet','plural-use']},
  {id:'forum',levelId:'level-0',name:'Dialogue forum',kind:'service',capacity:48,capabilities:['culture.dialogue','culture.public-debate'],tags:['plural-use']},
  {id:'reading-room',levelId:'level-0',name:'Reading room',kind:'service',capacity:16,capabilities:['culture.source.read','culture.archive.access']},
  {id:'consultation',levelId:'level-0',name:'Consultation room',kind:'office',capacity:6,capabilities:['culture.counselling']},
 ],
 portals:[
  {id:'p-entry-resonance',kind:'door',fromRoomId:'entry',toRoomId:'resonance-room',normallyOpen:true},
  {id:'p-entry-forum',kind:'door',fromRoomId:'entry',toRoomId:'forum',normallyOpen:true},
  {id:'p-entry-reading',kind:'door',fromRoomId:'entry',toRoomId:'reading-room',normallyOpen:true},
  {id:'p-entry-consultation',kind:'door',fromRoomId:'entry',toRoomId:'consultation'},
 ],
}
