import type { InteriorTemplate } from '../types'
export const SACRED_SPACE_INTERIOR: InteriorTemplate = {
 id:'sacred-space-01', buildingTypeId:'sacred_space', hostKinds:['building'], name:'Configurable Sacred Space', version:1,
 levels:[{id:'level-0',name:'Main level',order:0,elevationM:0}],
 rooms:[
  {id:'entry',levelId:'level-0',name:'Entrance',kind:'entrance',capacity:16,tags:['entry']},
  {id:'assembly',levelId:'level-0',name:'Assembly / ritual room',kind:'service',capacity:64,capabilities:['religion.assembly','religion.ritual'],tags:['institution-configurable']},
  {id:'quiet-room',levelId:'level-0',name:'Quiet room',kind:'service',capacity:12,capabilities:['religion.prayer','culture.meditation'],tags:['institution-configurable']},
  {id:'community-room',levelId:'level-0',name:'Community room',kind:'service',capacity:20,capabilities:['community.meeting']},
 ],
 portals:[
  {id:'p-entry-assembly',kind:'door',fromRoomId:'entry',toRoomId:'assembly',normallyOpen:true},
  {id:'p-entry-quiet',kind:'door',fromRoomId:'entry',toRoomId:'quiet-room'},
  {id:'p-entry-community',kind:'door',fromRoomId:'entry',toRoomId:'community-room'},
 ],
}
