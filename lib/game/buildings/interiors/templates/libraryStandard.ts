import type { InteriorTemplate } from '../types'

export const LIBRARY_STANDARD_INTERIOR: InteriorTemplate = {
  id:'library-standard-v1',
  buildingTypeId:'archive_library',
  hostKinds:['building'],
  name:'Archiv / Bibliothek Standard',
  version:1,
  levels:[{id:'ground',name:'Hauptebene',order:0,elevationM:0}],
  rooms:[
    {id:'entry',levelId:'ground',name:'Eingang',kind:'entrance',capacity:10,capabilities:['arrival','information'],tags:['public']},
    {id:'reading',levelId:'ground',name:'Lesesaal',kind:'service',capacity:24,capabilities:['read','study','conversation'],tags:['public']},
    {id:'stacks',levelId:'ground',name:'Magazin',kind:'storage',capacity:8,capabilities:['retrieve','catalogue'],tags:['staff']},
    {id:'archive',levelId:'ground',name:'Archiv',kind:'storage',capacity:6,capabilities:['preserve','research'],tags:['restricted']},
  ],
  portals:[
    {id:'entry-reading',kind:'door',fromRoomId:'entry',toRoomId:'reading',normallyOpen:true},
    {id:'reading-stacks',kind:'door',fromRoomId:'reading',toRoomId:'stacks',normallyOpen:false,accessTags:['staff']},
    {id:'stacks-archive',kind:'door',fromRoomId:'stacks',toRoomId:'archive',normallyOpen:false,accessTags:['staff']},
  ],
}
