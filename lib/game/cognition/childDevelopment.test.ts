import { childDevelopmentStage, childDevelopmentState } from './childDevelopment'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}
const Y=720

check(childDevelopmentStage(0,Y)==='newborn','birth starts newborn')
check(childDevelopmentStage(Y,Y)==='toddler','one compressed year is past infancy boundary')
check(childDevelopmentStage(5*Y,Y)==='early_childhood','five years stays early childhood')
check(childDevelopmentStage(10*Y,Y)==='middle_childhood','ten years is middle childhood')
check(childDevelopmentStage(16*Y,Y)==='adolescent','sixteen years is adolescent')

const newborn=childDevelopmentState(0,Y,2)
const teen=childDevelopmentState(16*Y,Y,14)
check(newborn.computeTier===0,'newborn has no adult deliberative tier')
check(newborn.memoryWeight<teen.memoryWeight,'memory capacity grows with development')
check(newborn.symbolicWeight<teen.symbolicWeight,'symbolic capacity grows with development')
check(teen.computeTier===2,'adolescent may reach bounded deliberative depth')

if(failures)throw new Error(String(failures)+' child-development test(s) failed')
console.log('Child development projection: tests passed')
