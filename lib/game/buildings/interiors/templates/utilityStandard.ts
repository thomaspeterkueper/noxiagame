import type { InteriorTemplate } from '../types'

export const UTILITY_STANDARD_INTERIOR: InteriorTemplate = {
  id:'utility-standard-v1',
  buildingTypeId:'utility',
  hostKinds:['building'],
  name:'Utility Standard',
  version:1,
  levels:[{id:'ground',name:'Technikebene',order:0,elevationM:0}],
  rooms:[
    {id:'entry',levelId:'ground',name:'Zugang',kind:'entrance',capacity:4,capabilities:['arrival'],tags:['technical']},
    {id:'control',levelId:'ground',name:'Leitstand',kind:'technical',capacity:6,capabilities:['control','monitor'],tags:['technical']},
    {id:'plant',levelId:'ground',name:'Anlagenraum',kind:'utility',capacity:8,capabilities:['maintenance','repair'],tags:['technical']},
    {id:'service',levelId:'ground',name:'Servicezugang',kind:'service',capacity:5,capabilities:['parts','maintenance'],tags:['technical']},
  ],
  portals:[
    {id:'entry-control',kind:'door',fromRoomId:'entry',toRoomId:'control',normallyOpen:true},
    {id:'control-plant',kind:'door',fromRoomId:'control',toRoomId:'plant',normallyOpen:true},
    {id:'plant-service',kind:'door',fromRoomId:'plant',toRoomId:'service',normallyOpen:true},
  ],
}
