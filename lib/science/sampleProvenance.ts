// Scientific sample provenance model.
// Keeps source environment, sample formation, measurement and interpretation separate.

export type ScientificEvidenceStatus = 'hypothesis' | 'experiment-supported' | 'observed' | 'validated';

export type SampleTransformation = {
  process: string;
  effect: string;
  evidence: ScientificEvidenceStatus;
};

export type ScientificSampleModel = {
  id: string;
  body: string;
  sourceEnvironment: string;
  transformations: SampleTransformation[];
  sampleClasses: string[];
  measurementCaveat: string;
};

export type SampleObservation = {
  sampleModelId: string;
  sampleClass: string;
  measuredSignals: Record<string, number>;
};

export type SampleInterpretation = {
  inferredSourceSignals: Record<string, number>;
  confidence: number;
  caveats: string[];
};

export function interpretSample(
  model: ScientificSampleModel,
  observation: SampleObservation,
): SampleInterpretation {
  if (observation.sampleModelId !== model.id) {
    throw new Error('Observation does not belong to this sample model.');
  }

  return {
    inferredSourceSignals: { ...observation.measuredSignals },
    confidence: 0.5,
    caveats: [
      model.measurementCaveat,
      `Sample class "${observation.sampleClass}" is not assumed to be compositionally representative of "${model.sourceEnvironment}".`,
    ],
  };
}
