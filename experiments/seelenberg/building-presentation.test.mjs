import test from 'node:test';import assert from 'node:assert/strict';
import {earthBuildingLevel,buildingPresentation,selectVisibleBuildings} from './building-presentation.mjs';
const building={type:'Feature',id:'osm:way:1',properties:{tags:{building:'yes'}},geometry:{type:'Polygon',coordinates:[[[8,50],[8.001,50],[8.001,50.001],[8,50]]]}};
test('zoom tiers reduce geometry and asset demand',()=>{assert.equal(earthBuildingLevel(.3),'overview');assert.equal(earthBuildingLevel(1),'footprints');assert.equal(earthBuildingLevel(2),'portfolio');assert.equal(earthBuildingLevel(4),'detailed');});
test('real building without fictional function stays neutral',()=>{const x=buildingPresentation(building,{zoom:2});assert.equal(x.appearance,'neutral-building');assert.equal(x.portfolioBuildingId,null);assert.equal(x.inferenceOfActualUse,false);});
test('portfolio appearance requires explicit game building',()=>{const x=buildingPresentation(building,{zoom:2,simulationBuilding:{id:'sim:warehouse',buildingId:'warehouse'}});assert.equal(x.appearance,'simulation-portfolio');assert.equal(x.portfolioBuildingId,'warehouse');});
test('viewport culls outside buildings',()=>{assert.equal(selectVisibleBuildings([building],[9,51,10,52],{zoom:2}).length,0);});
test('hard limit avoids unbounded draw calls',()=>{const list=[...Array(20)].map((_,i)=>({...building,id:'osm:way:'+i}));assert.equal(selectVisibleBuildings(list,[7,49,9,51],{zoom:2,limit:5}).length,5);});
