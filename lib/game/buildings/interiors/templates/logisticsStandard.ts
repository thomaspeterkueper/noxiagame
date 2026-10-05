import type { InteriorTemplate } from '../types'

export const LOGISTICS_STANDARD_INTERIOR: InteriorTemplate = {
  id:'logistics-standard-v1',
  buildingTypeId:'warehouse',
  hostKinds:['building'],
  name:'Logistik Standard',
  version:1,
  levels:[{id:'ground',name:'Hallenebene',order:0,elevationM:0}],
  rooms:[
    {id:'receiving',levelId:'ground',name:'Wareneingang',kind:'storage',capacity:10,capabilities:['receive','inspect'],tags:['logistics']},
    {id:'storage',levelId:'ground',name:'Hauptlager',kind:'storage',capacity:16,capabilities:['storage','reserve'],tags:['logistics']},
    {id:'dispatch',levelId:'ground',name:'Warenausgang',kind:'storage',capacity:10,capabilities:['dispatch','load'],tags:['logistics']},
    {id:'office',levelId:'ground',name:'Disposition',kind:'office',capacity:6,capabilities:['orders','conversation'],tags:['staff']},
  ],
  portals:[
    {id:'receiving-storage',kind:'passage',fromRoomId:'receiving',toRoomId:'storage',normallyOpen:true},
    {id:'storage-dispatch',kind:'passage',fromRoomId:'storage',toRoomId:'dispatch',normallyOpen:true},
    {id:'storage-office',kind:'door',fromRoomId:'storage',toRoomId:'office',normallyOpen:true},
  ],
}
