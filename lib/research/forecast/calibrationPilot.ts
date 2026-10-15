/** Deterministic research-only calibration benchmark. No production access. */
export type ForecastSample={tick:number;forecast:number;observed:number};
export function evaluateForecastCalibration(samples:readonly ForecastSample[],trainBeforeTick:number){
 const train=samples.filter(s=>s.tick<trainBeforeTick);
 const test=samples.filter(s=>s.tick>=trainBeforeTick);
 if(!train.length||!test.length)throw new Error('Need nonempty past and future');
 const bias=train.reduce((sum,s)=>sum+s.observed-s.forecast,0)/train.length;
 const mae=(fn:(s:ForecastSample)=>number)=>test.reduce((sum,s)=>sum+Math.abs(fn(s)-s.observed),0)/test.length;
 return {trainingCount:train.length,testCount:test.length,estimatedBias:bias,baselineMAE:mae(s=>s.forecast),correctedMAE:mae(s=>s.forecast+bias)};
}
