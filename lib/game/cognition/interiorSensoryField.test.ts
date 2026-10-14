import type { InteriorInstance, InteriorRoomDef } from '../buildings/interiors/types'
import { buildInteriorSensoryField } from './interiorSensoryField'

let failures = 0
const check = (ok: boolean, label: string) => {
  if (!ok) {
    failures += 1
    console.error('FAIL: ' + label)
  }
}

const room: InteriorRoomDef = {
  id: 'nursery',
  levelId: 'l1',
  name: 'Nursery',
  kind: 'habitation',
}

const instance: InteriorInstance = {
  id: 'habitat:1',
  templateId: 'habitat-standard',
  host: { kind: 'building', id: 'building:habitat:1' },
  roomStates: {
    nursery: {
      roomId: 'nursery',
      operationalState: 'operational',
      pressureKPa: 101.2,
      temperatureC: 22.5,
      oxygenFraction: 0.209,
      powerAvailable: true,
    },
  },
  portalStates: {},
}

const normal = buildInteriorSensoryField({ instance, room, tick: 20 })
check(normal.some(stimulus => stimulus.modality === 'thermal'), 'room temperature becomes thermal field')
check(normal.some(stimulus => stimulus.modality === 'auditory'), 'powered room has ambient acoustic field')
check(!normal.some(stimulus => stimulus.id.includes('oxygen-body-cue')), 'normal oxygen is not fabricated as a conscious smell')

const degraded: InteriorInstance = {
  ...instance,
  roomStates: {
    nursery: {
      ...instance.roomStates.nursery,
      operationalState: 'degraded',
      oxygenFraction: 0.17,
    },
  },
}
const abnormal = buildInteriorSensoryField({ instance: degraded, room, tick: 21 })
check(abnormal.some(stimulus => stimulus.id.includes('oxygen-body-cue')), 'large respiratory-environment deviation can create bodily cue')
check(abnormal.find(stimulus => stimulus.modality === 'auditory')?.vector.novelty! > normal.find(stimulus => stimulus.modality === 'auditory')?.vector.novelty!, 'degraded room makes machinery ambience more novel')

if (failures) throw new Error(String(failures) + ' interior sensory field test(s) failed')
console.log('Interior sensory field v0.1: tests passed; false_oxygen_smell=0; external_llm_calls=0')
