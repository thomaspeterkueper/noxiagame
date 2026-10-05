import type { InteriorTemplate } from '../types'

export const MEDICAL_STANDARD_INTERIOR: InteriorTemplate = {
  id:'medical-standard-v1',
  buildingTypeId:'medical_core',
  hostKinds:['building'],
  name:'Medical Standard',
  version:1,
  levels:[{id:'ground',name:'Hauptebene',order:0,elevationM:0}],
  rooms:[
    {id:'reception',levelId:'ground',name:'Aufnahme',kind:'medical',capacity:10,capabilities:['triage','conversation'],tags:['public']},
    {id:'treatment',levelId:'ground',name:'Behandlung',kind:'medical',capacity:8,capabilities:['treatment','stabilize'],tags:['clinical']},
    {id:'diagnostics',levelId:'ground',name:'Diagnostik',kind:'medical',capacity:5,capabilities:['scan','diagnose'],tags:['clinical']},
    {id:'staff',levelId:'ground',name:'Personalbereich',kind:'service',capacity:6,capabilities:['staff','records'],tags:['staff-only']},
  ],
  portals:[
    {id:'reception-treatment',kind:'door',fromRoomId:'reception',toRoomId:'treatment',normallyOpen:true},
    {id:'treatment-diagnostics',kind:'door',fromRoomId:'treatment',toRoomId:'diagnostics',normallyOpen:true},
    {id:'treatment-staff',kind:'door',fromRoomId:'treatment',toRoomId:'staff',normallyOpen:false,accessTags:['staff']},
  ],
}
