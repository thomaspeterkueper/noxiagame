import { strict as assert } from 'node:assert';
import { generateEnceladusGrain, measureGrain, reconstructOcean } from './enceladusSampling';

const ocean = { water: 0.7, salts: 0.15, carbonate: 0.1, organics: 0.05 };
const organicGrain = generateEnceladusGrain(ocean, { water: 0.1, salts: 0.2, carbonate: 0.2, organics: 8 });
assert.equal(organicGrain.sampleClass, 'organic-rich');
assert.ok(organicGrain.transformedComposition.organics > ocean.organics);

const measured = measureGrain(organicGrain, { sensitivity: {}, noise: 0 });
const naive = reconstructOcean([measured]);
assert.ok(naive.estimate.organics > ocean.organics);
assert.ok(naive.caveats.length > 0);

const corrected = reconstructOcean([measured], { water: 0.1, salts: 0.2, carbonate: 0.2, organics: 8 });
assert.ok(Math.abs(corrected.estimate.organics - ocean.organics) < 0.0001);
assert.ok(corrected.confidence > naive.confidence);

console.log('Enceladus sampling simulation tests passed');
