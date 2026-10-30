/**
 * NOXIA-CCRS-0001: pure conflict / consequence / regeneration prototype.
 * No writes: the Core validates and commits effects atomically.
 */
export type Action = 'provoke' | 'mediate' | 'support' | 'withdraw' | 'pollute' | 'restore'
export type Agent = { id: string; empathy: number; frustration: number; trust: number }
export type Scene = {
  id: string
  tick: number
  actors: Agent[]
  tension: number
  contamination: number
  restorationCapacity: number
}
export type Effect =
  | { kind: 'tension'; delta: number }
  | { kind: 'trust'; actorId: string; delta: number }
  | { kind: 'contamination'; delta: number }
  | { kind: 'restoration_capacity'; delta: number }
export type Event = {
  id: string
  sceneId: string
  tick: number
  actorId: string
  action: Action
  effects: Effect[]
}
const bounded = (n: number) => Math.max(0, Math.min(100, n))
function assertFinite(n: number, name: string) {
  if (!Number.isFinite(n)) throw new Error(`Invalid ${name}`)
}
function unit(n: number) { return bounded(n) / 100 }
/** Stable hash for replay; not a security or randomness primitive. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
export function chooseAction(scene: Scene, actor: Agent, seed: string): Action {
  const roll = hash(`${seed}:${scene.id}:${scene.tick}:${actor.id}`) / 0x100000000
  const helpful = unit(actor.empathy) * (1 - unit(actor.frustration) / 2)
  if (scene.contamination > 20 && scene.restorationCapacity > 0 && roll < helpful) return 'restore'
  if (scene.tension > 35 && roll < helpful * 0.65) return 'mediate'
  if (scene.tension > 55 && roll < helpful) return 'support'
  if (roll < unit(actor.frustration) * (1 - unit(actor.empathy)) * 0.5) return 'provoke'
  return 'withdraw'
}
export function propose(scene: Scene, actorId: string, action: Action, seed: string): Event {
  if (!scene.actors.some(a => a.id === actorId)) throw new Error('Unknown actor')
  const values = [scene.tick, scene.tension, scene.contamination, scene.restorationCapacity]
  values.forEach((v, i) => assertFinite(v, String(i)))
  if (!Number.isInteger(scene.tick) || scene.tick < 0 || values.slice(1).some(n => n < 0 || n > 100)) throw new Error('Invalid scene')
  const effects: Effect[] = action === 'provoke' ? [{kind:'tension',delta:12},{kind:'trust',actorId,delta:-4}]
    : action === 'mediate' ? [{kind:'tension',delta:-10},{kind:'trust',actorId,delta:3}]
    : action === 'support' ? [{kind:'tension',delta:-3},{kind:'trust',actorId,delta:2}]
    : action === 'pollute' ? [{kind:'contamination',delta:10}]
    : action === 'restore' ? [{kind:'contamination',delta:-Math.min(8,scene.restorationCapacity)},{kind:'restoration_capacity',delta:-Math.min(8,scene.restorationCapacity)}]
    : []
  return {id:`ccrs:${scene.id}:${scene.tick}:${actorId}:${action}:${hash(seed)}`,sceneId:scene.id,tick:scene.tick,actorId,action,effects}
}
/** Preview only. It is not a substitute for Core resource accounting. */
export function preview(scene: Scene, event: Event): Scene {
  if (scene.id !== event.sceneId || scene.tick !== event.tick || !scene.actors.some(a=>a.id===event.actorId)) throw new Error('Event/scene mismatch')
  let tension = scene.tension, contamination = scene.contamination, restorationCapacity = scene.restorationCapacity
  const actors = scene.actors.map(a=>({...a}))
  for (const effect of event.effects) {
    assertFinite(effect.delta, 'effect')
    if (effect.kind === 'tension') tension = bounded(tension + effect.delta)
    if (effect.kind === 'contamination') contamination = bounded(contamination + effect.delta)
    if (effect.kind === 'restoration_capacity') restorationCapacity = bounded(restorationCapacity + effect.delta)
    if (effect.kind === 'trust') {
      const actor = actors.find(a => a.id === effect.actorId)
      if (!actor) throw new Error('Unknown effect actor')
      actor.trust = bounded(actor.trust + effect.delta)
    }
  }
  return {...scene,tension,contamination,restorationCapacity,actors}
}
