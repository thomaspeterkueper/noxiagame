import { ENCELADUS_PLUME_FRACTIONATION } from './enceladusPlume';

export type EnceladusSignal = 'water' | 'salts' | 'carbonate' | 'organics';
export type EnceladusComposition = Record<EnceladusSignal, number>;

export type SamplingTrajectory = {
  plumeCore: number;      // 0..1
  altitude: number;       // 0 = low pass, 1 = high pass
  collectorBias: Partial<Record<EnceladusSignal, number>>;
};

export type InstrumentProfile = {
  sensitivity: Partial<Record<EnceladusSignal, number>>;
  noise: number;
};

export type SimulatedGrain = {
  sampleModelId: string;
  sampleClass: string;
  sourceComposition: EnceladusComposition;
  transformedComposition: EnceladusComposition;
};

const signals: EnceladusSignal[] = ['water', 'salts', 'carbonate', 'organics'];

function clamp(value: number) { return Math.max(0, Math.min(1, value)); }
function normalise(input: EnceladusComposition): EnceladusComposition {
  const total = signals.reduce((sum, key) => sum + Math.max(0, input[key]), 0) || 1;
  return Object.fromEntries(signals.map(key => [key, Math.max(0, input[key]) / total])) as EnceladusComposition;
}

export function generateEnceladusGrain(
  source: EnceladusComposition,
  fractionation: EnceladusComposition,
): SimulatedGrain {
  const transformed = normalise(Object.fromEntries(
    signals.map(key => [key, source[key] * fractionation[key]]),
  ) as EnceladusComposition);
  const dominant = signals.reduce((a, b) => transformed[a] >= transformed[b] ? a : b);
  const sampleClass = dominant === 'salts' ? 'salt-rich' : dominant === 'carbonate' ? 'carbonate-rich' :
    dominant === 'organics' ? 'organic-rich' : dominant === 'water' ? 'water-rich' : 'mixed';
  return {
    sampleModelId: ENCELADUS_PLUME_FRACTIONATION.id,
    sampleClass,
    sourceComposition: normalise(source),
    transformedComposition: transformed,
  };
}

export function collectGrain(grain: SimulatedGrain, trajectory: SamplingTrajectory): number {
  const coreFactor = 0.35 + 0.65 * clamp(trajectory.plumeCore);
  const altitudeFactor = 1 - 0.45 * clamp(trajectory.altitude);
  const compositionBias = signals.reduce(
    (sum, key) => sum + grain.transformedComposition[key] * (trajectory.collectorBias[key] ?? 1), 0,
  );
  return clamp(coreFactor * altitudeFactor * compositionBias);
}

export function measureGrain(
  grain: SimulatedGrain,
  instrument: InstrumentProfile,
  deterministicNoise = 0,
): EnceladusComposition {
  return normalise(Object.fromEntries(signals.map(key => [
    key,
    clamp(grain.transformedComposition[key] * (instrument.sensitivity[key] ?? 1) + deterministicNoise * instrument.noise),
  ])) as EnceladusComposition);
}

export function reconstructOcean(
  measurements: EnceladusComposition[],
  assumedFractionation?: EnceladusComposition,
): { estimate: EnceladusComposition; confidence: number; caveats: string[] } {
  if (!measurements.length) throw new Error('At least one measurement is required.');
  const mean = Object.fromEntries(signals.map(key => [
    key, measurements.reduce((sum, sample) => sum + sample[key], 0) / measurements.length,
  ])) as EnceladusComposition;
  const corrected = assumedFractionation
    ? normalise(Object.fromEntries(signals.map(key => [key, mean[key] / Math.max(0.0001, assumedFractionation[key])])) as EnceladusComposition)
    : normalise(mean);
  return {
    estimate: corrected,
    confidence: clamp((measurements.length / (measurements.length + 8)) * (assumedFractionation ? 0.9 : 0.45)),
    caveats: assumedFractionation ? [] : ['No fractionation model applied; plume composition may be mistaken for bulk-ocean composition.'],
  };
}
