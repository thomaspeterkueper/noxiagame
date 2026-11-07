import test from 'node:test'; import assert from 'node:assert/strict';
import {initialState,advance,conserved} from './simulation.mjs';
test('normal transport has inventory conservation',()=> {let s=initialState();for(let i=0;i<5;i++){s=advance(s);assert.ok(conserved(s));assert.ok(s.producer>=0&&s.vehicle>=0&&s.depot>=0);}assert.ok(s.delivered>0);});
test('blocked road leaves cargo in transit and reduces supply',()=>{let s=advance(initialState());assert.equal(s.vehicle,8);s=advance(s,{blocked:true});assert.equal(s.vehicle,8);assert.ok(s.depot<12);assert.ok(s.events.includes('route_blocked'));assert.ok(conserved(s));});
test('extra demand triggers resupply',()=>{let s=advance(initialState(),{demand:11}); assert.ok(s.events.includes('resupply_requested'));assert.ok(conserved(s));});
test('same input gives same state',()=>{assert.deepEqual(advance(initialState()),advance(initialState()));});
