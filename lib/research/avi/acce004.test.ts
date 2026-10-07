import { biographicalClosureCurve } from "./acce004";
const affect=(id:string,fear:number,mood:number)=>({personId:id,joy:0,fear,anger:0,sadness:0,mood,pain:0,updatedTick:10});
const a={affect:affect('a',.7,-.3),reflex:{habituation:.05,sensitization:.5},memory:{salience:.9,uncertainty:.2}};
const b={affect:affect('b',.1,.2),reflex:{habituation:.4,sensitization:0},memory:{salience:.2,uncertainty:.05}};
const curve=biographicalClosureCurve(a,b);
if(!(curve[0].defect>curve[1].defect&&curve[1].defect>curve[2].defect&&curve[2].defect>curve[3].defect))throw new Error('each present carrier should reduce this constructed closure defect');
if(curve[3].defect>1e-12)throw new Error('known present carriers must close the constructed response');
console.log('ACCE-004 PASS',curve);
