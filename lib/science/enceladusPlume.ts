import type { ScientificSampleModel } from './sampleProvenance';

export const ENCELADUS_PLUME_FRACTIONATION: ScientificSampleModel = {
  id: 'enceladus-plume-fractionation-v1',
  body: 'enceladus',
  sourceEnvironment: 'subsurface-ocean',
  transformations: [
    {
      process: 'bubble-mediated droplet formation',
      effect: 'Ocean material is transferred into aerosol droplets; sampling begins before spacecraft collection.',
      evidence: 'experiment-supported',
    },
    {
      process: 'slow freezing / cryosegregation',
      effect: 'Salts and organic constituents may become spatially segregated and locally enriched.',
      evidence: 'experiment-supported',
    },
    {
      process: 'vent acceleration',
      effect: 'Frozen droplets are accelerated through tiger-stripe fractures.',
      evidence: 'experiment-supported',
    },
    {
      process: 'wall collision and fragmentation',
      effect: 'Parent grains can fragment into micrometre-scale daughter grains with non-representative compositions.',
      evidence: 'experiment-supported',
    },
  ],
  sampleClasses: ['water-rich', 'salt-rich', 'carbonate-rich', 'organic-rich', 'mixed', 'unclassified'],
  measurementCaveat:
    'Plume-grain composition is a transformed sample of the ocean and must not be equated directly with bulk-ocean composition.',
};
