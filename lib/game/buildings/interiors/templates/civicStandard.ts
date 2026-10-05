import type { InteriorTemplate } from '../types'

export const CIVIC_STANDARD_INTERIOR: InteriorTemplate = {
  id:'civic-standard-v1',
  buildingTypeId:'admin',
  hostKinds:['building'],
  name:'Civic Standard',
  version:1,
  levels:[{id:'ground',name:'Hauptebene',order:0,elevationM:0}],
  rooms:[
    {id:'entry',levelId:'ground',name:'Foyer',kind:'entrance',capacity:12,capabilities:['arrival','information'],tags:['public']},
    {id:'service',levelId:'ground',name:'Servicebereich',kind:'office',capacity:10,capabilities:['administration','conversation'],tags:['public']},
    {id:'operations',levelId:'ground',name:'Verwaltung',kind:'office',capacity:12,capabilities:['planning','records'],tags:['staff']},
    {id:'meeting',levelId:'ground',name:'Besprechung',kind:'office',capacity:12,capabilities:['meeting','conversation'],tags:['public','staff']},
  ],
  portals:[
    {id:'entry-service',kind:'door',fromRoomId:'entry',toRoomId:'service',normallyOpen:true},
    {id:'service-operations',kind:'door',fromRoomId:'service',toRoomId:'operations',normallyOpen:false,accessTags:['staff']},
    {id:'service-meeting',kind:'door',fromRoomId:'service',toRoomId:'meeting',normallyOpen:true},
  ],
}
