import test from 'node:test';import assert from 'node:assert/strict';import {roadGraph,shortestRoute} from './road-graph.mjs';
const a=[8,50],b=[8.001,50],c=[8.002,50],d=[8.001,50.001];
const line=(id,coords,tags={highway:'residential'})=>({type:'Feature',id,properties:{tags},geometry:{type:'LineString',coordinates:coords}});
const fc={type:'FeatureCollection',features:[line('direct1',[a,b]),line('direct2',[b,c]),line('detour1',[a,d]),line('detour2',[d,c]),line('private',[a,c],{highway:'service',access:'private'}),line('path',[a,c],{highway:'footway'})]};
test('public road graph excludes private and pedestrian ways',()=>{const g=roadGraph(fc);assert.equal(g.edges.get('8.0000000,50.0000000').length,2);});
test('shortest route uses valid public roads',()=>{const r=shortestRoute(roadGraph(fc),a,c);assert.equal(r.status,'ok');assert.deepEqual(r.coordinates,[a,b,c]);});
test('blocked routes detour or remain unreachable',()=>{const g=roadGraph(fc);assert.deepEqual(shortestRoute(g,a,c,{blockedWays:['direct1']}).coordinates,[a,d,c]);assert.equal(shortestRoute(g,a,c,{blockedWays:['direct1','detour1']}).status,'unreachable');});
test('unmapped endpoints never snap silently',()=>assert.equal(shortestRoute(roadGraph(fc),[7,50],c).status,'unmapped-endpoint'));
