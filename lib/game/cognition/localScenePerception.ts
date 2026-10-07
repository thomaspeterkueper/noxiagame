import { localSceneInteractionDistance, localSceneInteractions } from '../spatial/localSceneRuntime'
import type { LocalSurfacePoint, LocalSurfaceScene } from '../spatial/localSurfaceScene'
import type { Observation } from './observation'
import { filterPerception, type PerceptionDecision, type PerceptionFilterState } from './npcPerceptionFilter'

export interface LocalScenePerceptionResult {
  emitted: Observation[]
  decisions: PerceptionDecision[]
  nextState: PerceptionFilterState
}

function confidenceForDistance(distanceM:number,rangeM:number){
  const ratio=Math.max(0,Math.min(1,distanceM/Math.max(1,rangeM)))
  return Math.max(.5,Math.min(.98,.98-ratio*.38))
}

export function observeLocalScene(input:{
  scene:LocalSurfaceScene
  observerId:string
  observerPoint:LocalSurfacePoint
  atTick:number
  state:PerceptionFilterState
  visualRangeM?:number
}):LocalScenePerceptionResult{
  const visualRange=Math.max(5,input.visualRangeM??45)
  let state=input.state
  const emitted:Observation[]=[]
  const decisions:PerceptionDecision[]=[]

  for(const interaction of localSceneInteractions(input.scene)){
    // Do not make an NPC perceive itself through the shared mobile-object list.
    if(interaction.mobileObject?.id===input.observerId||interaction.mobileObject?.id==='resident:'+input.observerId)continue
    const distanceM=localSceneInteractionDistance(input.observerPoint,interaction)
    if(distanceM>visualRange)continue

    const provenance=interaction.building?.provenance
    const observation:Observation={
      id:'scene:'+input.scene.frameId+':'+input.observerId+':'+interaction.id+':'+input.atTick,
      observerId:input.observerId,
      subjectRef:interaction.id,
      attribute:'local_presence',
      value:{
        label:interaction.label,
        kind:interaction.kind,
        distanceBand:distanceM<=10?'immediate':distanceM<=25?'near':'visible',
        provenance:provenance??'scene',
      },
      source:{id:'local-scene:'+input.scene.frameId,type:'simulation',provenanceRefs:[input.scene.frameId]},
      modality:'visual',
      observedAtTick:input.atTick,
      confidence:confidenceForDistance(distanceM,visualRange),
      salience:interaction.kind==='person'?.7:interaction.kind==='building'?.5:.45,
      spatialResolutionM:Math.max(1,distanceM*.08),
    }
    const decision=filterPerception({state,observation})
    decisions.push(decision)
    state=decision.nextState
    if(decision.emit)emitted.push(observation)
  }

  return {emitted,decisions,nextState:state}
}
