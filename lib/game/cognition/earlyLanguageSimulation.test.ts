import { simulateEarlyLanguage } from './earlyLanguageSimulation'

let failures = 0
const check = (ok:boolean,label:string) => {
  if (!ok) {
    failures += 1
    console.error('FAIL: ' + label)
  }
}

const result = simulateEarlyLanguage(1095)
const at30 = result.snapshots.find(snapshot => snapshot.ageDays === 30)!
const at270 = result.snapshots.find(snapshot => snapshot.ageDays === 270)!
const at365 = result.snapshots.find(snapshot => snapshot.ageDays === 365)!
const at730 = result.snapshots.find(snapshot => snapshot.ageDays === 730)!
const at1095 = result.snapshots.find(snapshot => snapshot.ageDays === 1095)!

check(at30.formFamiliarity > 0, 'newborn period can accumulate speech-form familiarity')
check(at30.meaningConfidence === 0, 'newborn hearing does not invent semantic grounding')
check(at270.meaningConfidence > 0, 'joint attention begins grounding word meaning later in infancy')
check(at365.meaningConfidence > at270.meaningConfidence, 'repeated aligned usage strengthens word meaning')
check(at30.utterancePlan.maxTokens === 0, 'one-month-old cannot speak words')
check(at730.utterancePlan.maxTokens > 0, 'later toddler development permits productive language')
check(at1095.utterancePlan.grammarComplexity > at730.utterancePlan.grammarComplexity, 'grammar capacity develops over time')
check(at1095.utterancePlan.allowedForms.includes('ball'), 'grounded learned word becomes available for production')

if (failures) throw new Error(String(failures) + ' early language simulation test(s) failed')
console.log(JSON.stringify({
  month1: at30,
  month9: at270,
  year1: at365,
  year2: at730,
  year3: at1095,
}, null, 2))
