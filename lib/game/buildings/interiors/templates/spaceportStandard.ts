import type { InteriorTemplate } from '../types'

export const SPACEPORT_STANDARD_INTERIOR: InteriorTemplate = {
  id:'spaceport-standard-v1',
  buildingTypeId:'landing_pad',
  hostKinds:['building'],
  name:'Surface Spaceport Standard',
  version:1,
  levels:[{id:'ground',name:'Bodenebene',order:0,elevationM:0}],
  rooms:[
    {id:'arrival',levelId:'ground',name:'Ankunft & Schleuse',kind:'airlock',capacity:12,capabilities:['arrival','exit'],tags:['public']},
    {id:'flight_control',levelId:'ground',name:'Flugleitung',kind:'office',capacity:8,capabilities:['navigation','control'],tags:['staff']},
    {id:'cargo',levelId:'ground',name:'Cargo-Terminal',kind:'storage',capacity:16,capabilities:['cargo','market'],tags:['logistics']},
    {id:'service',levelId:'ground',name:'Service & Wartung',kind:'workshop',capacity:12,capabilities:['repair','maintenance'],tags:['technical']},
    {id:'dock',levelId:'ground',name:'Lande-/Dockbereich',kind:'service',capacity:18,capabilities:['boarding','vehicle'],tags:['vehicle']},
  ],
  portals:[
    {id:'arrival-control',kind:'door',fromRoomId:'arrival',toRoomId:'flight_control',normallyOpen:true},
    {id:'arrival-cargo',kind:'passage',fromRoomId:'arrival',toRoomId:'cargo',normallyOpen:true},
    {id:'cargo-service',kind:'door',fromRoomId:'cargo',toRoomId:'service',normallyOpen:true},
    {id:'service-dock',kind:'airlock',fromRoomId:'service',toRoomId:'dock',normallyOpen:true,pressureBoundary:true},
  ],
}
