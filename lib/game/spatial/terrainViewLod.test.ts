import assert from 'node:assert/strict'
import { terrainViewLod } from './terrainViewLod'

const phobos=terrainViewLod(1200,60)
assert.equal(phobos.size,17)
assert.equal(phobos.sampleCount,289)
assert.equal(phobos.stepM,75)
assert.ok((phobos.size-1)*phobos.stepM>=1200)

const coarse=terrainViewLod(1200,100)
assert.equal(coarse.stepM,100)
assert.ok((coarse.size-1)*coarse.stepM>=1200)

const wide=terrainViewLod(20_000,60)
assert.equal(wide.sampleCount,289)
assert.ok((wide.size-1)*wide.stepM>=20_000)

for(const source of [10,60,100,500]){
 const lod=terrainViewLod(2400,source)
 assert.ok(lod.stepM>=source,'view LOD must never claim finer source sampling than the dataset')
 assert.equal(lod.sampleCount,289,'sampler cost stays bounded across bodies and view spans')
}
console.log('Planetary terrain view LOD tests passed')
