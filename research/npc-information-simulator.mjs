// Isolated synthetic experiment; no production DB or network calls.
export function seeded(seed) { let x=seed>>>0; return ()=>{x=(x+0x6D2B79F5)>>>0;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296} }
export function simulate({seed=170102,trials=20000,bits=32,signalAccuracy=0.55}={}) {
 if(!Number.isSafeInteger(seed)||!Number.isInteger(trials)||trials<1||trials>1e6||!Number.isInteger(bits)||bits<1||bits>1024||signalAccuracy<.5||signalAccuracy>1) throw Error('invalid parameters');
 const rng=[0xA5A5A5A5,0x11,0x22,0x33,0x44,0x55].map(s=>seeded(seed^s));
 const hits={control:0,recombination:0,social:0,signal:0,placebo:0};
 for(let i=0;i<trials;i++) for(let j=0;j<bits;j++){
  const target=rng[0]()<.5;
  hits.control+=+( (rng[1]()<.5)===target );
  hits.recombination+=+( (rng[2]()<.5)===target );
  hits.social+=+( (rng[3]()<.5)===target );
  hits.signal+=+( (rng[4]()<signalAccuracy?target:!target)===target );
  hits.placebo+=+( (rng[5]()<.5)===target );
 }
 return {parameters:{seed,trials,bits,signalAccuracy,offline:true},groups:Object.fromEntries(Object.entries(hits).map(([name,correct])=>[name,{correct,total:trials*bits,accuracy:correct/(trials*bits)}]))};
}
