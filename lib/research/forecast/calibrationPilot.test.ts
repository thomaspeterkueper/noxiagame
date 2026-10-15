import {describe,it,expect} from 'vitest';
import {evaluateForecastCalibration} from './calibrationPilot';
describe('forecast calibration pilot',()=>{
 it('fits bias only on earlier observations',()=>{
  const result=evaluateForecastCalibration([{tick:1,forecast:10,observed:12},{tick:2,forecast:20,observed:22},{tick:3,forecast:30,observed:32}],3);
  expect(result.estimatedBias).toBe(2);
  expect(result.baselineMAE).toBe(2);
  expect(result.correctedMAE).toBe(0);
 });
 it('requires a train and a future test partition',()=>{
  expect(()=>evaluateForecastCalibration([{tick:1,forecast:1,observed:1}],1)).toThrow();
 });
});
