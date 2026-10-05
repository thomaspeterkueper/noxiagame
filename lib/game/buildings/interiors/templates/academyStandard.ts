import type { InteriorTemplate } from '../types'

export const ACADEMY_STANDARD_INTERIOR: InteriorTemplate = {
  id:'academy-standard-v1',
  buildingTypeId:'school',
  hostKinds:['building'],
  name:'Akademie Standard',
  version:1,
  levels:[{id:'ground',name:'Hauptebene',order:0,elevationM:0}],
  rooms:[
    {id:'entry',levelId:'ground',name:'Foyer',kind:'entrance',capacity:12,capabilities:['arrival','conversation'],tags:['public']},
    {id:'classroom',levelId:'ground',name:'Lernraum',kind:'office',capacity:24,capabilities:['learn','teach'],tags:['education']},
    {id:'lab',levelId:'ground',name:'Übungslabor',kind:'laboratory',capacity:12,capabilities:['research','practice'],tags:['education','research']},
    {id:'office',levelId:'ground',name:'Lehrbereich',kind:'office',capacity:8,capabilities:['staff','conversation'],tags:['staff']},
  ],
  portals:[
    {id:'entry-classroom',kind:'door',fromRoomId:'entry',toRoomId:'classroom',normallyOpen:true},
    {id:'classroom-lab',kind:'door',fromRoomId:'classroom',toRoomId:'lab',normallyOpen:true},
    {id:'classroom-office',kind:'door',fromRoomId:'classroom',toRoomId:'office',normallyOpen:false,accessTags:['staff']},
  ],
}
