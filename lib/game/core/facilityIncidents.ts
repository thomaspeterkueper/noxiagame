export const FACILITY_INCIDENT_KINDS = [
  'equipment_failure',
  'containment_breach',
  'workplace_accident',
] as const

export type FacilityIncidentKind = (typeof FACILITY_INCIDENT_KINDS)[number]

export interface FacilityIncident {
  tick: number
  locationId: string
  tileEntityId: string
  kind: FacilityIncidentKind
  severity: number
  affectedPersonId: string | null
  causeRef: string | null
}

export interface FacilityIncidentHealthEffect {
  eventType: 'workplace_accident' | 'environmental_exposure'
  severity: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

/** Pure mapping: only explicit facility incidents can become health effects. */
export function healthEffectFromFacilityIncident(
  incident: FacilityIncident,
): FacilityIncidentHealthEffect | null {
  if (!incident.affectedPersonId) return null
  const severity = clamp01(incident.severity)
  if (severity <= 0) return null

  if (incident.kind === 'containment_breach') {
    return { eventType: 'environmental_exposure', severity }
  }
  if (incident.kind === 'workplace_accident') {
    return { eventType: 'workplace_accident', severity }
  }
  return null
}
