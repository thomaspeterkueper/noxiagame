import { runAcce003 } from "./acce003";
const r=runAcce003({exposures:20,harmfulOutcomes:0},{exposures:5,harmfulOutcomes:5});
if(!r.visibleStateEqual)throw new Error("visible states must match");
if(r.historiesEqual)throw new Error("histories must differ");
if(!(r.reducedClosureDefect>0))throw new Error("omitting embodied history should create a response defect");
if(!r.dispositionClosesDefect||r.restoredClosureDefect>1e-12)throw new Error("present adaptation should restore closure");
if(r.strongerHistoryCarrierAdmissible)throw new Error("history carrier must not be admitted when present disposition closes the defect");
console.log("ACCE-003 PASS",r);
