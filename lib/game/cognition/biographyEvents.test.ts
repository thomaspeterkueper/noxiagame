import { projectBiography, type BiographyEvent } from './biographyEvents'
let errors=0
function ok(condition:boolean,label:string){if(!condition){console.error('FAIL',label);errors++}}
const events:BiographyEvent[]=[
{id:'1',personId:'p',tick:0,kind:'birth'},
{id:'2',personId:'p',tick:20,kind:'care_started',relatedPersonId:'guardian'},
{id:'3',personId:'p',tick:100,kind:'bond_formed',relatedPersonId:'friend'},
{id:'4',personId:'p',tick:900,kind:'death'},
]
const a=projectBiography('p',events)
ok(a.ok && a.projection.bonds[0]==='friend' && a.projection.diedAtTick===900,'full biography')
ok(JSON.stringify(a)===JSON.stringify(projectBiography('p',[...events].reverse())),'order invariant')
ok(!projectBiography('p',[...events,events[0]]).ok,'duplicate ID rejected')
ok(!projectBiography('p',[...events,{id:'5',personId:'p',tick:901,kind:'bond_ended',relatedPersonId:'friend'}]).ok,'no events after death')
ok(!projectBiography('p',[{id:'x',personId:'p',tick:4,kind:'death'}]).ok,'birth required')
ok(!projectBiography('p',[events[0],{id:'x',personId:'p',tick:3,kind:'bond_formed',relatedPersonId:'p'}]).ok,'self bond rejected')
if(errors)throw Error(errors+' biography tests failed')
console.log('Biography projection tests passed')
