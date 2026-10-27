import test from 'node:test';import assert from 'node:assert/strict';
import {newVillage,villageTick} from './village-integration.mjs';
import {conserved} from './simulation.mjs';
const A=[8,50],B=[8.001,50],C=[8.002,50],D=[8.001,50.001];
const way=(id,points)=>({type:'Feature',id,geometry:{type:'LineString',coordinates:points},properties:{tags:{highway:'residential'}}});
const map={type:'FeatureCollection',features:[way('ab',[A,B]),way('bc',[B,C]),way('ad',[A,D]),way('dc',[D,C])]};
test('road available: loaded cargo reaches depot on next tick',()=>{
 let v=newVillage(map,A,C);v=villageTick(v);assert.equal(v.economy.vehicle,8);
 v=villageTick(v);assert.ok(v.economy.delivered>=8);assert.equal(v.trace[1].routeStatus,'ok');assert.ok(conserved(v.economy));
});
test('all exits blocked: cargo remains in transit, no phantom delivery',()=>{
 let v=villageTick(newVillage(map,A,C));const before=v.economy.delivered;
 v=villageTick(v,{blockedWays:['ab','ad']});assert.equal(v.economy.vehicle,8);assert.equal(v.economy.delivered,before);assert.equal(v.trace.at(-1).routeStatus,'unreachable');assert.ok(conserved(v.economy));
});
test('detour restores supply without inventing stock',()=>{
 let v=villageTick(newVillage(map,A,C));
 v=villageTick(v,{blockedWays:['ab']});assert.equal(v.trace.at(-1).routeStatus,'ok');assert.ok(v.economy.delivered>0);
});
test('missing destination cannot deliver cargo',()=>{
 let v=villageTick(newVillage(map,A,[9,51]));assert.equal(v.economy.delivered,0);assert.equal(v.trace[0].routeStatus,'unmapped-endpoint');assert.ok(conserved(v.economy));
});
test('deterministic simulation snapshots',()=>{
 const a=villageTick(villageTick(newVillage(map,A,C)));
 const b=villageTick(villageTick(newVillage(map,A,C)));
 assert.deepEqual(a.trace,b.trace);assert.deepEqual(a.economy,b.economy);
});
