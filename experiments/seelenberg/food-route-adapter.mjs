// Pure bridge between Earth route assessments and NOXIA-FOOD-0002 ChainConfig.leadDays.
// No state, booking, map fetching, transport job writes or changes to hospitality.
const LINKS=['grainToMill','flourToBakery','breadToShop'];
export function leadDaysFromRoutes(routes,{speedKmH=25,dispatchHours=8,serviceHours=1,minimumDays=0}={}){
 if(![speedKmH,dispatchHours].every(x=>Number.isFinite(x)&&x>0))throw new Error('invalid vehicle/dispatch settings');
 if(!Number.isFinite(serviceHours)||serviceHours<0||!Number.isFinite(minimumDays)||minimumDays<0)throw new Error('invalid service settings');
 const leadDays={};
 for(const link of LINKS){
  const route=routes[link];
  if(!route||route.status!=='ok'||!Number.isFinite(route.distanceMeters)||route.distanceMeters<0){
   return {status:'unreachable',link,reason:route?.status||'missing-route'};
  }
  const journeyHours=route.distanceMeters/1000/speedKmH+serviceHours;
  leadDays[link]=Math.max(minimumDays,Math.ceil(journeyHours/dispatchHours));
 }
 return {status:'ok',leadDays};
}
export function disruptionFromDelay({link,fromDay,toDay,extraDays}){
 if(!LINKS.includes(link)||![fromDay,toDay,extraDays].every(Number.isInteger)||fromDay<1||toDay<fromDay||extraDays<0)throw new Error('invalid food chain disruption');
 return {link,fromDay,toDay,extraDays};
}
