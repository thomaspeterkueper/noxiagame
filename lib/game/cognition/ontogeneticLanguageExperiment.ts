/** Ontogenetic vocabulary experiment: toy cross-situational learner, not human development. */
export type Episode = Readonly<{ day: number; scene: readonly string[]; utterance: readonly string[]; caregiver: string; attention?: string }>;
export type Lexicon = Readonly<Record<string, Readonly<Record<string, number>>>>;
export type DevelopmentSnapshot = Readonly<{ day: number; vocabulary: number; correct: number; tested: number; accuracy: number; associations: Lexicon }>;
const token = (s:string) => s.trim().toLowerCase();
export function learnEpisode(lexicon:Lexicon, episode:Episode):Lexicon {
  if (!Number.isSafeInteger(episode.day) || episode.day < 0 || !episode.caregiver) throw new Error("invalid_episode");
  const scene=[...new Set(episode.scene.map(token).filter(Boolean))];
  const words=[...new Set(episode.utterance.map(token).filter(Boolean))];
  if (episode.attention && !scene.includes(token(episode.attention))) throw new Error("attention_not_visible");
  if (!scene.length || !words.length) return lexicon;
  const result:Record<string,Record<string,number>>={};
  for(const [word,scores] of Object.entries(lexicon)) result[word]={...scores};
  for(const word of words) {
    const scores=result[word] ?? {};
    for(const object of scene) scores[object]=(scores[object]??0)+(episode.attention===object?2:1)/scene.length;
    result[word]=scores;
  }
  return result;
}
export function predictReferent(lexicon:Lexicon, word:string):string|null {
  const scores=lexicon[token(word)];
  if (!scores) return null;
  const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]));
  if (!ranked.length || ranked[0][1] <= 0 || (ranked[1] && ranked[0][1]===ranked[1][1])) return null;
  return ranked[0][0];
}
export function runDevelopment(
  episodes:readonly Episode[],
  evaluation:Readonly<Record<string,string>>,
  checkpoints:readonly number[]
):readonly DevelopmentSnapshot[] {
  if (episodes.some((e,i)=>i>0 && e.day<episodes[i-1].day)) throw new Error("episodes_not_chronological");
  if (checkpoints.some((d,i)=>!Number.isSafeInteger(d)||d<0||(i>0 && d<=checkpoints[i-1]))) throw new Error("invalid_checkpoints");
  let index=0, lexicon:Lexicon={};
  return checkpoints.map(day=>{
    while(index<episodes.length && episodes[index].day<=day) lexicon=learnEpisode(lexicon,episodes[index++]);
    const probes=Object.entries(evaluation);
    const correct=probes.filter(([word,referent])=>predictReferent(lexicon,word)===referent).length;
    const vocabulary=Object.keys(lexicon).filter(word=>predictReferent(lexicon,word)!==null).length;
    const frozen=Object.fromEntries(Object.entries(lexicon).map(([k,v])=>[k,Object.freeze({...v})]));
    return Object.freeze({day,vocabulary,correct,tested:probes.length,accuracy:probes.length?correct/probes.length:0,associations:Object.freeze(frozen)});
  });
}
/** Synthetic, deliberately simplified episodes with a held-out word-to-object probe. */
export function syntheticInfancy(days=120):readonly Episode[] {
  if (!Number.isSafeInteger(days)||days<0||days>10000) throw new Error("invalid_days");
  const pairs=[["ball","ball"],["cup","cup"],["book","book"],["water","water"]] as const;
  return Array.from({length:days},(_,i)=>{
    const [word,object]=pairs[i%pairs.length];
    const distractor=pairs[(i+1)%pairs.length][1];
    return {day:i,scene:[object,distractor],utterance:[word],caregiver:i%2?"caregiver-b":"caregiver-a",attention:object};
  });
}
