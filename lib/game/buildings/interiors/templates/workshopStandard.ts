import type { InteriorTemplate } from '../types'

export const WORKSHOP_STANDARD_INTERIOR: InteriorTemplate = {
  id:'workshop-standard-v1',
  buildingTypeId:'workshop',
  hostKinds:['building'],
  name:'Werkstatt Standard',
  version:1,
  levels:[{id:'ground',name:'Hallenebene',order:0,elevationM:0}],
  rooms:[
    {id:'reception',levelId:'ground',name:'Auftragsannahme',kind:'office',capacity:6,capabilities:['orders','conversation'],tags:['public']},
    {id:'workshop',levelId:'ground',name:'Werkhalle',kind:'workshop',capacity:14,capabilities:['repair','fabrication'],tags:['technical']},
    {id:'parts_store',levelId:'ground',name:'Teilelager',kind:'storage',capacity:6,capabilities:['parts','storage'],tags:['logistics']},
    {id:'crew',levelId:'ground',name:'Technikerbereich',kind:'service',capacity:10,capabilities:['conversation','rest'],tags:['staff']},
  ],
  portals:[
    {id:'reception-workshop',kind:'door',fromRoomId:'reception',toRoomId:'workshop',normallyOpen:true},
    {id:'workshop-parts',kind:'door',fromRoomId:'workshop',toRoomId:'parts_store',normallyOpen:true},
    {id:'workshop-crew',kind:'door',fromRoomId:'workshop',toRoomId:'crew',normallyOpen:true},
  ],
}
