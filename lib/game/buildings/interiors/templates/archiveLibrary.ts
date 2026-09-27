import type { InteriorTemplate } from '../types'
export const ARCHIVE_LIBRARY_INTERIOR: InteriorTemplate = {
 id:'archive-library-01', buildingTypeId:'archive_library', hostKinds:['building'], name:'Archive & Library', version:1,
 levels:[{id:'level-0',name:'Public level',order:0,elevationM:0},{id:'level-1',name:'Archive level',order:1,elevationM:3.2}],
 rooms:[
  {id:'entry',levelId:'level-0',name:'Entrance',kind:'entrance',capacity:12,tags:['entry']},
  {id:'reading',levelId:'level-0',name:'Reading room',kind:'service',capacity:30,capabilities:['culture.source.read','research.historical']},
  {id:'catalogue',levelId:'level-0',name:'Catalogue & reference desk',kind:'service',capacity:8,capabilities:['culture.provenance.search']},
  {id:'archive',levelId:'level-1',name:'Controlled archive',kind:'storage',capacity:8,capabilities:['culture.source.preserve','culture.provenance.verify'],tags:['controlled-access']},
  {id:'analysis',levelId:'level-1',name:'Source analysis room',kind:'laboratory',capacity:8,capabilities:['culture.source.compare','culture.attribution.review']},
 ],
 portals:[
  {id:'p-entry-reading',kind:'door',fromRoomId:'entry',toRoomId:'reading',normallyOpen:true},
  {id:'p-reading-catalogue',kind:'door',fromRoomId:'reading',toRoomId:'catalogue',normallyOpen:true},
  {id:'p-catalogue-archive',kind:'stairs',fromRoomId:'catalogue',toRoomId:'archive',accessTags:['archive-access']},
  {id:'p-archive-analysis',kind:'door',fromRoomId:'archive',toRoomId:'analysis',accessTags:['archive-access']},
 ],
}
