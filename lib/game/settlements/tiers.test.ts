import {
  SETTLEMENT_TIER_DOWNGRADE_FACTOR,
  SETTLEMENT_TIER_THRESHOLDS,
  missingSettlementCapabilities,
  settlementTierForPopulation,
  settlementTierWithHysteresis,
} from './tiers'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}

check(JSON.stringify(SETTLEMENT_TIER_THRESHOLDS)===JSON.stringify({settlement:20,town:100,city:500}),'thresholds are explicit tuning values')
check(SETTLEMENT_TIER_DOWNGRADE_FACTOR===0.8,'downgrade hysteresis is 80%')
check(settlementTierForPopulation(0)===0 && settlementTierForPopulation(19)===0,'under 20 is tier 0')
check(settlementTierForPopulation(20)===1 && settlementTierForPopulation(99)===1,'20 starts settlement')
check(settlementTierForPopulation(100)===2 && settlementTierForPopulation(499)===2,'100 starts town')
check(settlementTierForPopulation(500)===3,'500 starts city')
check(settlementTierWithHysteresis({population:90,currentTier:2})===2,'tier 2 stays until below 80')
check(settlementTierWithHysteresis({population:79,currentTier:2})===1,'tier 2 drops below 80% threshold')
check(settlementTierWithHysteresis({population:17,currentTier:1})===1 && settlementTierWithHysteresis({population:15,currentTier:1})===0,'tier 1 drops below 16')
check(missingSettlementCapabilities({population:20,buildingIds:['landing_pad','admin','cafe']}).missing.length===0,'cafe satisfies first social tier')
check(missingSettlementCapabilities({population:20,buildingIds:['landing_pad','admin','bar']}).missing.length===0,'bar is same first social capability')
check(missingSettlementCapabilities({population:20,buildingIds:['landing_pad','admin','q1_everyday_life']}).missing.length===0,'Q1 everyday module satisfies social tier')
check(missingSettlementCapabilities({population:100,buildingIds:['landing_pad','admin','cafe']}).missing.join(',')==='market,academy,clinic','tier 2 lists missing standard capabilities')

if(failures) throw new Error(String(failures)+' settlement tier test(s) failed')
console.log('Settlement tiers: tests passed; mutations=0')
