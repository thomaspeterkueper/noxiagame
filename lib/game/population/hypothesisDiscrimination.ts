// Chooses evidence that best discriminates between declared competing hypotheses.
// Pure epistemic planning: no ground-truth/history access and no action authority.

import type { EpistemicHypothesisDefinition, HypothesisEvidenceRule } from './hypothesis'
import type { PersonKnowledge } from './types'
import type { HypothesisResearchQuestion } from './hypothesisResearch'

export interface DiscriminatingResearchQuestion extends HypothesisResearchQuestion {
  discriminatesHypothesisIds: string[]
  discriminationScore: number
}

function key(r:HypothesisEvidenceRule){return r.subjectType+'|'+r.subjectRef+'|'+r.knowledgeType}
function known(ks:PersonKnowledge[],r:HypothesisEvidenceRule){return ks.some(k=>k.subjectType===r.subjectType&&k.subjectRef===r.subjectRef&&k.knowledgeType===r.knowledgeType&&k.confidence>=(r.minConfidence??0))}

export function discriminatingQuestions(defs:EpistemicHypothesisDefinition[], knowledge:PersonKnowledge[]):DiscriminatingResearchQuestion[]{
  const map=new Map<string,{rule:HypothesisEvidenceRule,support:string[],contradict:string[],weight:number}>()
  for(const d of defs){
    for(const [kind,rules] of [['support',d.supporting],['contradict',d.contradicting??[]]] as const){
      for(const r of rules){
        if(known(knowledge,r)) continue
        const k=key(r), x=map.get(k)??{rule:r,support:[],contradict:[],weight:0}
        x[kind].push(d.id); x.weight=Math.max(x.weight,Math.max(0,r.weight)); map.set(k,x)
      }
    }
  }
  const out:DiscriminatingResearchQuestion[]=[]
  for(const x of map.values()){
    const affected=[...new Set([...x.support,...x.contradict])]
    const polarityBonus=x.support.length>0&&x.contradict.length>0?2:1
    const score=x.weight*affected.length*polarityBonus
    if(affected.length<2 && polarityBonus===1) continue
    out.push({
      id:'question:discriminate:'+key(x.rule), hypothesisId:affected.join(','),
      kind:x.contradict.length>x.support.length?'test_contradiction':'seek_support',
      rule:x.rule, priority:score, discriminatesHypothesisIds:affected.sort(), discriminationScore:score,
    })
  }
  return out.sort((a,b)=>b.discriminationScore-a.discriminationScore||a.id.localeCompare(b.id))
}
