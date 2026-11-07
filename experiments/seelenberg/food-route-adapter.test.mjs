import test from 'node:test';import assert from 'node:assert/strict';
import {leadDaysFromRoutes,disruptionFromDelay} from './food-route-adapter.mjs';
const routes={grainToMill:{status:'ok',distanceMeters:4500},flourToBakery:{status:'ok',distanceMeters:1200},breadToShop:{status:'ok',distanceMeters:300}};
test('all three route legs receive deterministic integer days',()=>{const x=leadDaysFromRoutes(routes);assert.deepEqual(x,{status:'ok',leadDays:{grainToMill:1,flourToBakery:1,breadToShop:1}});assert.deepEqual(x,leadDaysFromRoutes(routes));});
test('missing or blocked leg fails closed',()=>{assert.equal(leadDaysFromRoutes({...routes,flourToBakery:{status:'unreachable'}}).status,'unreachable');assert.equal(leadDaysFromRoutes({...routes,breadToShop:undefined}).link,'breadToShop');});
test('long road requires extra day',()=>{const x=leadDaysFromRoutes({...routes,grainToMill:{status:'ok',distanceMeters:250000}},{speedKmH:25,dispatchHours:8});assert.equal(x.leadDays.grainToMill,2);});
test('disruption has Food chain compatible fields',()=>{assert.deepEqual(disruptionFromDelay({link:'flourToBakery',fromDay:8,toDay:20,extraDays:6}),{link:'flourToBakery',fromDay:8,toDay:20,extraDays:6});assert.throws(()=>disruptionFromDelay({link:'nope',fromDay:8,toDay:20,extraDays:6}));});
