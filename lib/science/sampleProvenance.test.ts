import { strict as assert } from 'node:assert';
import { ENCELADUS_PLUME_FRACTIONATION } from './enceladusPlume';
import { interpretSample } from './sampleProvenance';

const result = interpretSample(ENCELADUS_PLUME_FRACTIONATION, {
  sampleModelId: ENCELADUS_PLUME_FRACTIONATION.id,
  sampleClass: 'organic-rich',
  measuredSignals: { organics: 0.8, salts: 0.2 },
});

assert.equal(result.inferredSourceSignals.organics, 0.8);
assert.ok(result.caveats.some((item) => item.includes('must not be equated directly')));
assert.ok(result.caveats.some((item) => item.includes('not assumed to be compositionally representative')));

assert.throws(() =>
  interpretSample(ENCELADUS_PLUME_FRACTIONATION, {
    sampleModelId: 'wrong-model',
    sampleClass: 'mixed',
    measuredSignals: {},
  }),
);

console.log('scientific sample provenance tests passed');
