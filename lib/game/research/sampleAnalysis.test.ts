import { deriveSampleAnalysis } from './sampleAnalysis'

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const strongMetal = deriveSampleAnalysis({ resourceType: 'metal', abundance: 0.44, tier: 'viable', confidence: 'low' })
check(strongMetal.capability.sufficient, 'field lab should satisfy metallic-regolith requirement')
check(strongMetal.finding === 'confirmed', 'strong metal prospect should confirm')
check(strongMetal.developmentStatus === 'drilling_authorized', 'confirmed metal prospect should authorize drilling only')

const weakMetal = deriveSampleAnalysis({ resourceType: 'metal', abundance: 0.26, tier: 'trace', confidence: 'low' })
check(weakMetal.finding === 'inconclusive', 'weak metal prospect should remain inconclusive')
check(weakMetal.developmentStatus === 'blocked', 'inconclusive prospect must remain blocked')

const hydration = deriveSampleAnalysis({ resourceType: 'water', abundance: 0.12, tier: 'trace', confidence: 'very-low' })
check(hydration.capability.sufficient, 'field lab should satisfy hydration requirement')
check(hydration.finding === 'rejected', 'very weak hydration prospect should be rejected')
check(hydration.developmentStatus === 'blocked', 'rejected prospect must remain blocked')

console.log('Stickney sample analysis decisions: tests passed')
