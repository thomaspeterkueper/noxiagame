// lib/multiplayer/gestures.ts
// Gesten und gemeinsame Bewegungen (Thomas, 04.11.2026: „wir können uns da auch
// Sachen von Second Life abschauen“ – „alles nacheinander“). Abgeschaut ist die
// Spielmechanik, nicht Namen oder Bilder:
// - Gesten über den Chat („/winken“) oder Knöpfe; alle im Raum sehen sie.
// - Gemeinsame Bewegungen zu zweit: einladen, der andere nimmt an oder lehnt ab.
//   Mit Bewohnern entscheidet die Figur nach dem, was sie weiß – nichts wird erfunden.
// Reine Regeln.

import type { KieselPose } from '../figures/kiesel'

export type GestureName = 'winken' | 'jubeln' | 'klatschen' | 'verbeugen' | 'prost' | 'tanzen'
export type JointName = 'paartanz' | 'anstossen' | 'handschlag' | 'umarmen' | 'troesten' | 'armnehmen' | 'handinhand'

export const GESTURES: Readonly<Record<GestureName, { label: string; verb: string; ms: number; words: readonly string[] }>> = {
  winken: { label: 'Winken', verb: 'winkt', ms: 3500, words: ['winken', 'wink', 'winke', 'hallo', 'hi'] },
  jubeln: { label: 'Jubeln', verb: 'jubelt', ms: 3500, words: ['jubeln', 'jubel', 'juhu', 'yeah'] },
  klatschen: { label: 'Klatschen', verb: 'klatscht', ms: 4000, words: ['klatschen', 'klatsch', 'applaus', 'bravo'] },
  verbeugen: { label: 'Verbeugen', verb: 'verbeugt sich', ms: 3000, words: ['verbeugen', 'verbeug', 'diener'] },
  prost: { label: 'Prost', verb: 'prostet zu', ms: 3500, words: ['prost', 'zuprosten', 'cheers', 'prosit'] },
  tanzen: { label: 'Tanzen', verb: 'tanzt', ms: 0, words: ['tanzen', 'tanz', 'tanze', 'dance'] },
}

export const JOINTS: Readonly<Record<JointName, { label: string; ask: string; verb: string; npcFact: string; ms: number; words: readonly string[] }>> = {
  paartanz: { label: 'Zusammen tanzen', ask: 'möchte mit dir tanzen', verb: 'tanzt mit', npcFact: 'Du tanzt gerade mit deinem Gegenüber', ms: 0, words: ['paartanz', 'tanzmit', 'zusammentanzen'] },
  anstossen: { label: 'Anstoßen', ask: 'möchte mit dir anstoßen', verb: 'stößt an mit', npcFact: 'Dein Gegenüber hat eben mit dir angestoßen', ms: 4000, words: ['anstossen', 'anstoßen', 'anstoss'] },
  handschlag: { label: 'Hand geben', ask: 'reicht dir die Hand', verb: 'gibt die Hand', npcFact: 'Dein Gegenüber hat dir eben die Hand gegeben', ms: 3000, words: ['hand', 'handschlag', 'handgeben', 'handschütteln'] },
  umarmen: { label: 'Umarmen', ask: 'möchte dich umarmen', verb: 'umarmt', npcFact: 'Dein Gegenüber hat dich eben umarmt', ms: 5000, words: ['umarmen', 'umarmung', 'drücken', 'hug'] },
  troesten: { label: 'Trösten', ask: 'möchte dich trösten', verb: 'tröstet', npcFact: 'Dein Gegenüber hat dich eben getröstet und dir die Hand auf die Schulter gelegt', ms: 6000, words: ['trösten', 'troesten', 'trost'] },
  // Thomas, 05.11.2026: „in den Arm nehmen fehlt oder Hand in Hand laufen“ – man geht zusammen weiter.
  armnehmen: { label: 'In den Arm nehmen', ask: 'möchte dich in den Arm nehmen', verb: 'nimmt in den Arm', npcFact: 'Dein Gegenüber hat dich in den Arm genommen; ihr steht oder geht eng beieinander', ms: 0, words: ['arm', 'inarm', 'arminarm', 'indenarm'] },
  handinhand: { label: 'Hand in Hand', ask: 'möchte mit dir Hand in Hand gehen', verb: 'geht Hand in Hand mit', npcFact: 'Ihr geht Hand in Hand', ms: 0, words: ['handinhand', 'händchen', 'haendchen', 'händchenhalten'] },
}

/** Bewegungen, bei denen man zusammen weitergeht: wer angenommen hat, läuft mit. */
export const FOLLOW_JOINTS: ReadonlySet<string> = new Set(['armnehmen', 'handinhand'])

/**
 * Hand in Hand braucht die Hand auf der Seite des Partners: Schaut die Figur nach
 * rechts (se, ne) und steht der Partner rechts, ist es die vordere Hand, sonst die hintere.
 */
export function sidePose(pose: KieselPose, dir: 'se' | 'sw' | 'ne' | 'nw', me: { x: number }, partner: { x: number } | null): KieselPose {
  if (pose !== 'handinhand' || !partner) return pose
  const facesRight = dir === 'se' || dir === 'ne'
  return facesRight === (partner.x >= me.x) ? 'handinhand' : 'handinhand_l'
}

export type GestureCommand = { kind: 'gesture'; name: GestureName } | { kind: 'joint'; name: JointName }

/** „/winken“, „/prost“, „/hand“ … – null, wenn der Text kein Befehl ist. */
export function parseGestureCommand(text: string | null | undefined): GestureCommand | null {
  const m = /^\s*\/\s*([\p{L}]+(?:\s+mit)?)/u.exec(String(text ?? ''))
  if (!m) return null
  const word = m[1].toLocaleLowerCase('de-DE').replace(/\s+/g, '')
  if (/^hand\s*in\s*hand/i.test(text!.replace(/^\s*\/\s*/, ''))) return { kind: 'joint', name: 'handinhand' }
  if (/^(in\s+den\s+)?arm\b/i.test(text!.replace(/^\s*\/\s*/, ''))) return { kind: 'joint', name: 'armnehmen' }
  if (word === 'tanzenmit' || word === 'tanzmit') return { kind: 'joint', name: 'paartanz' }
  for (const [name, g] of Object.entries(JOINTS) as [JointName, typeof JOINTS[JointName]][]) if (g.words.includes(word)) return { kind: 'joint', name }
  for (const [name, g] of Object.entries(GESTURES) as [GestureName, typeof GESTURES[GestureName]][]) if (g.words.includes(word)) return { kind: 'gesture', name }
  return null
}

/** Was im Raum gerade läuft: Pose mit Beginn, Dauer (0 = bis man sich bewegt) und Partner. */
export interface PoseState { name: GestureName | JointName; at: number; ms: number; with: string | null }
export interface InviteState { to: string; action: JointName; at: number }

export const INVITE_MS = 30_000

export function poseNow(p: PoseState | null | undefined, nowMs: number): KieselPose | null {
  if (!p) return null
  if (p.ms > 0 && nowMs - p.at > p.ms) return null
  return p.name as KieselPose
}

export function gestureState(name: GestureName, nowMs: number): PoseState { return { name, at: nowMs, ms: GESTURES[name].ms, with: null } }
export function jointState(name: JointName, partner: string, nowMs: number): PoseState { return { name, at: nowMs, ms: JOINTS[name].ms, with: partner } }

/** Offene Einladungen an mich – frisch und noch nicht beantwortet. */
export function invitesFor<T extends { profileId: string; invite?: InviteState | null }>(peers: readonly T[], me: string, nowMs: number): Array<T & { invite: InviteState }> {
  return peers.filter((p): p is T & { invite: InviteState } => Boolean(p.invite) && p.invite!.to === me && nowMs - p.invite!.at < INVITE_MS)
}

/** Hat mein Gegenüber meine Einladung angenommen? Dann trägt es die Pose mit mir. */
export function acceptedBy<T extends { profileId: string; pose?: PoseState | null }>(peers: readonly T[], invite: InviteState | null, me: string): T | null {
  if (!invite) return null
  return peers.find(p => p.profileId === invite.to && p.pose?.with === me && p.pose.name === invite.action && p.pose.at >= invite.at) ?? null
}

/** Stelle neben dem Partner, Gesicht zueinander: links oder rechts von ihm, je nachdem, wo man steht. */
export function besidePartner(me: { x: number; y: number }, partner: { x: number; y: number }, gap = 26): { x: number; y: number } {
  const side = me.x <= partner.x ? -1 : 1
  return { x: partner.x + side * gap, y: partner.y + 2 }
}

/** Blickrichtung zum Partner (vorn rechts oder vorn links). */
export const faceTowards = (me: { x: number }, partner: { x: number }) => (partner.x >= me.x ? 'se' : 'sw') as 'se' | 'sw'

// ── Bewohner entscheiden selbst ─────────────────────────────────────────────

export interface NpcJointContext {
  /** Kam die Figur mit dem Spieler her (Begleitung)? */
  companion: boolean
  staff: boolean
  /** Arbeitet sie gerade (Schicht, Bedienung)? */
  working: boolean
  minor: boolean
  sitting: boolean
  /** Gibt es hier eine Tanzfläche? */
  danceFloor: boolean
  /** Tanzt die Figur gerade? */
  dancing: boolean
  npcHasDrink: boolean
  playerHasDrink: boolean
  /** Trauert sie (Beerdigungskaffee: Familie, Trauergast)? */
  mourning: boolean
  /** Hat der Spieler ihr eben Beileid ausgesprochen? */
  condoled: boolean
  /** Hat sie das Gespräch beendet oder ist sie verärgert? */
  refusedTalk: boolean
}

export type NpcJointDecision = { ok: true } | { ok: false; reply: string }

/** Nimmt die Figur an? Nur nach dem, was im Raum sichtbar und bekannt ist. */
export function npcJointDecision(action: JointName, c: NpcJointContext): NpcJointDecision {
  if (c.refusedTalk) return { ok: false, reply: 'Lass mich bitte in Ruhe.' }
  switch (action) {
    case 'handschlag':
      return { ok: true }
    case 'anstossen':
      if (c.working) return { ok: false, reply: 'Ich arbeite gerade – aber danke!' }
      if (!c.npcHasDrink) return { ok: false, reply: 'Ich habe gar nichts zu trinken.' }
      if (!c.playerHasDrink) return { ok: false, reply: 'Womit denn? Du hast ja nichts im Glas.' }
      return { ok: true }
    case 'paartanz':
      if (!c.danceFloor) return { ok: false, reply: 'Hier wird nicht getanzt.' }
      if (c.minor) return { ok: false, reply: 'Nein, danke.' }
      if (c.working) return { ok: false, reply: 'Ich bin bei der Arbeit.' }
      if (c.mourning) return { ok: false, reply: 'Heute nicht – mir ist nicht nach Tanzen.' }
      if (c.companion || c.dancing) return { ok: true }
      if (c.sitting) return { ok: false, reply: 'Ich sitze gerade gut, vielleicht später.' }
      return { ok: true }
    case 'umarmen':
      if (c.companion && !c.minor) return { ok: true }
      if (c.mourning && c.condoled && !c.minor) return { ok: true }
      return { ok: false, reply: 'Wir kennen uns doch kaum.' }
    case 'troesten':
      if (c.mourning) return { ok: true }
      return { ok: false, reply: 'Danke, mir geht es gut.' }
    case 'armnehmen':
      if (c.minor) return { ok: false, reply: 'Nein.' }
      if (c.companion) return { ok: true }
      if (c.mourning && c.condoled) return { ok: true }
      return { ok: false, reply: 'Wir kennen uns doch kaum.' }
    case 'handinhand':
      if (c.minor) return { ok: false, reply: 'Nein.' }
      if (c.working) return { ok: false, reply: 'Ich bin bei der Arbeit.' }
      if (c.companion) return { ok: true }
      return { ok: false, reply: 'Hand in Hand? Wir kennen uns doch kaum.' }
  }
}
