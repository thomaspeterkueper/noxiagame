import { INSTRUMENTS, type InstrumentId } from './resourceScanning'
import type { ObservationCapabilityProfile, ObservationRequirement } from './population/observationCapability'
import { assessObservationDevelopment, type ObservationDevelopmentAssessment } from './population/observationDevelopment'
import type { TechnologyActorState, TechnologyApproach } from './population/technologySolutionSpace'

export type ProspectingObservable='density_contrast'|'magnetic_field_anomaly'|'spectral_reflectance'|'subsurface_structure'|'regional_remote_sensing'

const OBSERVABLE_BY_INSTRUMENT:Record<InstrumentId,ProspectingObservable>={
  gravimetry:'density_contrast',
  magnetometry:'magnetic_field_anomaly',
  hyperspectral:'spectral_reflectance',
  seismic:'subsurface_structure',
  orbital:'regional_remote_sensing',
}

/**
 * Adapter from the live scanner catalog to the generic scientific-observation
 * model. It intentionally maps only capabilities the scanner currently owns;
 * unknown precision/detection limits stay unknown instead of being invented.
 */
export function prospectingObservationCatalog(ownedInstrumentIds:readonly string[]):ObservationCapabilityProfile[]{
  return ownedInstrumentIds
    .filter((id):id is InstrumentId=>id in INSTRUMENTS)
    .map(id=>{
      const instrument=INSTRUMENTS[id]
      return {
        instrumentType:id,
        observable:OBSERVABLE_BY_INSTRUMENT[id],
        method:instrument.name,
        environments:instrument.id==='orbital'?['orbital']:['surface'],
        rangeMeters:instrument.radiusKm*1000,
      }
    })
}

export function assessProspectingObservation(args:{
  ownedInstrumentIds:readonly string[]
  requirement:ObservationRequirement
  approaches:TechnologyApproach[]
  actorState:TechnologyActorState
}):ObservationDevelopmentAssessment{
  return assessObservationDevelopment({
    catalog:prospectingObservationCatalog(args.ownedInstrumentIds),
    requirement:args.requirement,
    approaches:args.approaches,
    actorState:args.actorState,
  })
}
