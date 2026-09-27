import type { InteriorTemplate } from '../types'
export const COMMUNITY_HALL_INTERIOR: InteriorTemplate = {
 id:'community-hall-01', buildingTypeId:'community_hall', hostKinds:['building'], name:'Community Hall', version:1,
 levels:[{id:'level-0',name:'Main level',order:0,elevationM:0}],
 rooms:[
  {id:'foyer',levelId:'level-0',name:'Foyer',kind:'entrance',capacity:20,tags:['entry']},
  {id:'hall',levelId:'level-0',name:'Assembly hall',kind:'service',capacity:80,capabilities:['community.assembly','community.celebration','culture.public-debate']},
  {id:'meeting',levelId:'level-0',name:'Meeting room',kind:'service',capacity:16,capabilities:['community.meeting']},
  {id:'kitchen',levelId:'level-0',name:'Community kitchen',kind:'service',capacity:10,capabilities:['community.catering']},
 ],
 portals:[
  {id:'p-foyer-hall',kind:'door',fromRoomId:'foyer',toRoomId:'hall',normallyOpen:true},
  {id:'p-foyer-meeting',kind:'door',fromRoomId:'foyer',toRoomId:'meeting'},
  {id:'p-hall-kitchen',kind:'door',fromRoomId:'hall',toRoomId:'kitchen'},
 ],
}
