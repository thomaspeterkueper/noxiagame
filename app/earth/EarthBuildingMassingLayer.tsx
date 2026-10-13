'use client'

// app/earth/EarthBuildingMassingLayer.tsx
// Aktualisiert: 13.10.2026 — Fassaden- und Dachbilder des Baukastens (public/worldlab/blocks) auf Wände und Dachflächen gelegt; Höhe geometrisch richtig zur 2:1-Ansicht
// Version:      2.0.0

import { memo, type MouseEvent, type ReactNode } from 'react'
import type { LocalSurfaceBuilding, LocalSurfacePoint } from '@/lib/game/spatial/localSurfaceScene'
import { bellTowerFootprint, buildingMassingStyle, extrudeFootprint, hasBellTower, hipRoof, windowPath, type ScreenPoint } from '@/lib/game/spatial/buildingMassing'
import { ART_PX_PER_M, ISO_HEIGHT } from '@/lib/worldlab/facade'
import { BLOCK_STYLES, blockArt, type BlockArt } from '@/lib/worldlab/blocks'
import { blockKind, type BlockKind } from '@/lib/worldlab/simplify'
import { WALKABLE_VIEW, projectSurfacePoint as iso, surfacePointsAttr as pointsAttr } from '@/app/components/WalkableSurfaceRenderer'

// Screen pixels (before the scene zoom) per metre of building height: the
// scene draws one metre east as isoX pixels; geometrically right for a 2:1
// view is √1,5 of that (docs/workstreams/world-map-zeichenvorlage.md).
export const HEIGHT_PX_PER_M = WALKABLE_VIEW.isoX * ISO_HEIGHT
/** Buildings farther than this from the scene centre keep flat colours – patterns are the expensive part. */
const TEXTURED_WITHIN_M = 150

const ART = blockArt('drawn')

type Props = {
  buildings: LocalSurfaceBuilding[]
  onHover: (building: LocalSurfaceBuilding | null, event?: MouseEvent) => void
}

type Affine = { a: number; b: number; c: number; d: number; e: number; f: number }
const matrix = (m: Affine) => `matrix(${m.a.toFixed(5)} ${m.b.toFixed(5)} ${m.c.toFixed(5)} ${m.d.toFixed(5)} ${m.e.toFixed(2)} ${m.f.toFixed(2)})`

function shade(hex: string, factor: number) {
  const value = Number.parseInt(hex.slice(1), 16)
  const channel = (shift: number) => Math.max(0, Math.min(255, Math.round(((value >> shift) & 255) * factor)))
  return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`
}

function rectFootprint(building: LocalSurfaceBuilding): LocalSurfacePoint[] {
  const { xM, yM } = building.center
  const w = building.widthM / 2, d = building.depthM / 2
  return [{ xM: xM - w, yM: yM - d }, { xM: xM + w, yM: yM - d }, { xM: xM + w, yM: yM + d }, { xM: xM - w, yM: yM + d }]
}

/**
 * Pattern transform for a wall picture: texture pixel (0, 0) sits at the top of
 * the wall's left corner, u runs along the wall (16 px per metre of wall), v
 * runs straight down (16 px per metre of height).
 */
function wallMatrix(left: ScreenPoint, right: ScreenPoint, lengthM: number, topPx: number): Affine {
  const s = 1 / (ART_PX_PER_M * (lengthM || 1))
  return { a: (right.x - left.x) * s, b: (right.y - left.y) * s, c: 0, d: HEIGHT_PX_PER_M / ART_PX_PER_M, e: left.x, f: left.y - topPx }
}

/** Pattern transform for a roof picture: u along the eave, v down the slope (16 px per metre of roof surface). */
function roofMatrix(eaveLeft: ScreenPoint, eaveRight: ScreenPoint, eaveLengthM: number, upSlope: ScreenPoint, slopeM: number): Affine {
  const s = 1 / (ART_PX_PER_M * (eaveLengthM || 1)), t = 1 / (ART_PX_PER_M * (slopeM || 1))
  return { a: (eaveRight.x - eaveLeft.x) * s, b: (eaveRight.y - eaveLeft.y) * s, c: -upSlope.x * t, d: -upSlope.y * t, e: eaveLeft.x, f: eaveLeft.y }
}

/** Base patterns, one per picture; faces reference them with their own transform. */
export function BlockArtDefs() {
  return <>{(Object.keys(ART) as BlockKind[]).flatMap(kind => {
    const art = ART[kind] as BlockArt
    const style = BLOCK_STYLES[kind]
    const wallW = style.bayM * ART_PX_PER_M, wallH = style.storeyM * ART_PX_PER_M
    return (Object.keys(art) as Array<keyof BlockArt>).map(part => {
      const w = part === 'roof' ? 64 : wallW, h = part === 'roof' ? 64 : wallH
      return <pattern key={`${kind}-${part}`} id={`bart-${kind}-${part}`} patternUnits="userSpaceOnUse" width={w} height={h}>
        <image href={art[part]} width={w} height={h} style={{ imageRendering: 'pixelated' }}/>
      </pattern>
    })
  })}</>
}

function Building({ building, onHover }: { building: LocalSurfaceBuilding; onHover: Props['onHover'] }) {
  const footprint = building.footprint && building.footprint.length >= 3 ? building.footprint : rectFootprint(building)
  const base = footprint.map(iso)
  const style = buildingMassingStyle(building.id, building.tags)
  const tags = (building.tags ?? {}) as Record<string, unknown>
  const kind = blockKind(tags, building.widthM, building.depthM)
  const art = Math.max(Math.abs(building.center.xM), Math.abs(building.center.yM)) <= TEXTURED_WITHIN_M ? ART[kind] : undefined
  const block = BLOCK_STYLES[kind]
  // With pictures the eave is a whole number of storeys; without, the mapped height.
  const storeys = art ? Math.max(1, Math.round(style.heightM / block.storeyM)) : 0
  const eaveM = art ? storeys * block.storeyM : style.heightM
  const heightPx = eaveM * HEIGHT_PX_PER_M
  const storeyPx = block.storeyM * HEIGHT_PX_PER_M
  const massing = extrudeFootprint(base, heightPx)
  const cls = String(tags.building ?? 'yes')
  const sacred = /^(church|cathedral|chapel|mosque|synagogue|temple|shrine|monastery)$/.test(cls)
  const windows = art ? '' : sacred
    ? windowPath(massing.walls, style.heightM, heightPx, 4.6, true)
    : style.heightM >= 4.5 && !/^(barn|farm_auxiliary|stable|cowshed|sty|hangar|parking)$/.test(cls)
      ? windowPath(massing.walls, style.heightM, heightPx, style.roofForm === 'flat' && style.heightM <= 9 ? 5.2 : 3.4)
      : ''
  const pid = `b${building.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`
  const defs: ReactNode[] = []

  // Walls: flat colour, or ground-floor and upper-floor pictures.
  const walls = massing.walls.map((wall, index) => {
    const [p, q, qTop, pTop] = wall.points
    if (!art?.wallGround) return <polygon key={index} points={pointsAttr(wall.points)} fill={wall.lit ? style.wallLight : style.wallDark} stroke="#6d6557" strokeWidth=".3"/>
    const edge = wall.edge
    const fm = footprint[edge], tm = footprint[(edge + 1) % footprint.length]
    const lengthM = Math.hypot(tm.xM - fm.xM, tm.yM - fm.yM)
    const [left, right] = p.x <= q.x ? [p, q] : [q, p]
    const groundTop = Math.min(storeyPx, heightPx)
    const ground = { id: `${pid}-w${index}g`, href: `#bart-${kind}-wallGround`, m: wallMatrix(left, right, lengthM, groundTop) }
    defs.push(<pattern key={ground.id} id={ground.id} href={ground.href} patternTransform={matrix(ground.m)}/>)
    const groundQuad = [p, q, { x: q.x, y: q.y - groundTop }, { x: p.x, y: p.y - groundTop }]
    const upperQuad = [{ x: p.x, y: p.y - groundTop }, { x: q.x, y: q.y - groundTop }, qTop, pTop]
    let upper: ReactNode = null
    if (heightPx > groundTop + .01) {
      const id = `${pid}-w${index}u`
      defs.push(<pattern key={id} id={id} href={`#bart-${kind}-${art.wallUpper ? 'wallUpper' : 'wallGround'}`} patternTransform={matrix(wallMatrix(left, right, lengthM, heightPx))}/>)
      upper = <polygon points={pointsAttr(upperQuad)} fill={`url(#${id})`}/>
    }
    return <g key={index}>
      <polygon points={pointsAttr(groundQuad)} fill={`url(#${ground.id})`}/>
      {upper}
      {/* The map darkens the side turned away from the light itself. */}
      <polygon points={pointsAttr(wall.points)} fill={wall.lit ? 'none' : '#1a1410'} fillOpacity={wall.lit ? 0 : .2} stroke="#5b4a3c" strokeOpacity=".7" strokeWidth=".3"/>
    </g>
  })

  // Roof: hip faces (four corners) or a lifted flat face.
  let roof: ReactNode
  const hip = style.roofForm === 'pitched' ? hipRoof(footprint) : null
  const roofFill = (id: string, m: Affine) => {
    if (!art?.roof) return null
    defs.push(<pattern key={id} id={id} href={`#bart-${kind}-roof`} patternTransform={matrix(m)}/>)
    return `url(#${id})`
  }
  if (hip) {
    const lift = heightPx + hip.riseM * HEIGHT_PX_PER_M
    const ridge: Record<'a' | 'b', ScreenPoint> = {
      a: { x: iso(hip.ridgeA).x, y: iso(hip.ridgeA).y - lift },
      b: { x: iso(hip.ridgeB).x, y: iso(hip.ridgeB).y - lift },
    }
    const ridgeM = { a: hip.ridgeA, b: hip.ridgeB }
    const cx = (ridge.a.x + ridge.b.x) / 2, cy = (ridge.a.y + ridge.b.y) / 2
    const faces = hip.faces.map(face => {
      const p = massing.roof[face.edge], q = massing.roof[(face.edge + 1) % 4]
      const pm = footprint[face.edge], qm = footprint[(face.edge + 1) % 4]
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2
      const tone = (mx - cx < 0 ? 1.12 : .84) * (my - cy < 0 ? .9 : 1)
      // Slope length in metres from the eave midpoint to the ridge (midpoint of its end points).
      const ends = face.ridge.map(end => ridgeM[end])
      const rm = { xM: ends.reduce((s, e) => s + e.xM, 0) / ends.length, yM: ends.reduce((s, e) => s + e.yM, 0) / ends.length }
      const runM = Math.hypot(rm.xM - (pm.xM + qm.xM) / 2, rm.yM - (pm.yM + qm.yM) / 2)
      const slopeM = Math.hypot(runM, hip.riseM)
      const rs = face.ridge.map(end => ridge[end])
      const up = { x: rs.reduce((s, e) => s + e.x, 0) / rs.length - mx, y: rs.reduce((s, e) => s + e.y, 0) / rs.length - my }
      const [left, right, lm, rmm] = p.x <= q.x ? [p, q, pm, qm] : [q, p, qm, pm]
      const fill = roofFill(`${pid}-r${face.edge}`, roofMatrix(left, right, Math.hypot(rmm.xM - lm.xM, rmm.yM - lm.yM), up, slopeM))
      return { key: face.edge, depth: my, points: [p, q, ...rs], fill: fill ?? shade(style.roof, tone), tone, textured: Boolean(fill) }
    }).sort((a, b) => a.depth - b.depth)
    roof = <>{faces.map(face => <g key={face.key}>
      <polygon points={pointsAttr(face.points)} fill={face.fill} stroke={style.roofEdge} strokeWidth=".35" strokeLinejoin="round"/>
      {face.textured && face.tone !== 1 && <polygon points={pointsAttr(face.points)} fill={face.tone > 1 ? '#fff' : '#000'} fillOpacity={Math.abs(face.tone - 1) * .9}/>}
    </g>)}</>
  } else {
    // Flat lifted face: picture lies in the ground plane, rows along the longest edge.
    let fill: string | null = null
    if (art?.roof) {
      let best = 0, e0 = 0
      for (let i = 0; i < footprint.length; i++) {
        const a = footprint[i], b = footprint[(i + 1) % footprint.length]
        const len = Math.hypot(b.xM - a.xM, b.yM - a.yM)
        if (len > best) { best = len; e0 = i }
      }
      const a = footprint[e0], b = footprint[(e0 + 1) % footprint.length]
      const ux = (b.xM - a.xM) / (best || 1), uy = (b.yM - a.yM) / (best || 1)
      const o = massing.roof[e0]
      const uScreen = iso({ xM: a.xM + ux, yM: a.yM + uy }), vScreen = iso({ xM: a.xM - uy, yM: a.yM + ux }), oScreen = iso(a)
      fill = roofFill(`${pid}-rf`, {
        a: (uScreen.x - oScreen.x) / ART_PX_PER_M, b: (uScreen.y - oScreen.y) / ART_PX_PER_M,
        c: (vScreen.x - oScreen.x) / ART_PX_PER_M, d: (vScreen.y - oScreen.y) / ART_PX_PER_M,
        e: o.x, f: o.y,
      })
    }
    roof = <>
      <polygon points={pointsAttr(massing.roof)} fill={fill ?? style.roof} stroke={style.roofEdge} strokeWidth=".5" strokeLinejoin="round"/>
      {style.roofForm === 'pitched' && <line x1={massing.ridge[0].x} y1={massing.ridge[0].y} x2={massing.ridge[1].x} y2={massing.ridge[1].y} stroke="#ffffff" strokeOpacity=".38" strokeWidth=".9" strokeLinecap="round"/>}
    </>
  }

  // Bell tower: a slim square shaft at one short end with a pointed spire.
  const towerPlan = hasBellTower(cls) && footprint.length === 4 ? bellTowerFootprint(footprint) : null
  let tower: ReactNode = null
  let towerBehind = false
  if (towerPlan) {
    const shaftPx = heightPx * 1.75
    const shaftBase = towerPlan.corners.map(iso)
    const shaft = extrudeFootprint(shaftBase, shaftPx)
    const centre = iso(towerPlan.centre)
    const spireM = towerPlan.sideM * 1.5
    const apex = { x: centre.x, y: centre.y - shaftPx - spireM * HEIGHT_PX_PER_M }
    const spire = shaft.roof.map((point, index) => {
      const next = shaft.roof[(index + 1) % shaft.roof.length]
      const mx = (point.x + next.x) / 2, my = (point.y + next.y) / 2
      const tone = (mx - centre.x < 0 ? 1.14 : .82) * (my - (centre.y - shaftPx) < 0 ? .9 : 1)
      const [left, right] = point.x <= next.x ? [point, next] : [next, point]
      const fill = roofFill(`${pid}-s${index}`, roofMatrix(left, right, towerPlan.sideM, { x: apex.x - mx, y: apex.y - my }, Math.hypot(towerPlan.sideM / 2, spireM)))
      return { key: index, depth: my, points: [point, next, apex], fill: fill ?? shade(style.roof, tone), tone, textured: Boolean(fill) }
    }).sort((a, b) => a.depth - b.depth)
    towerBehind = towerPlan.centre.xM + towerPlan.centre.yM < building.center.xM + building.center.yM
    tower = <>
      {shaft.walls.map((wall, index) => {
        if (!art?.wallGround) return <polygon key={index} points={pointsAttr(wall.points)} fill={wall.lit ? style.wallLight : style.wallDark} stroke="#6d6557" strokeWidth=".3"/>
        const [p, q] = wall.points
        const [left, right] = p.x <= q.x ? [p, q] : [q, p]
        const id = `${pid}-t${index}`
        defs.push(<pattern key={id} id={id} href={`#bart-${kind}-${art.wallUpper ? 'wallUpper' : 'wallGround'}`} patternTransform={matrix(wallMatrix(left, right, towerPlan.sideM, shaftPx))}/>)
        return <g key={index}><polygon points={pointsAttr(wall.points)} fill={`url(#${id})`}/><polygon points={pointsAttr(wall.points)} fill={wall.lit ? 'none' : '#1a1410'} fillOpacity={wall.lit ? 0 : .2} stroke="#5b4a3c" strokeOpacity=".7" strokeWidth=".3"/></g>
      })}
      {!art?.wallGround && <path d={windowPath(shaft.walls.map(wall => ({ points: wall.points.map(point => ({ x: point.x, y: point.y - shaftPx * .72 })) })), 4, shaftPx * .2, 2.6, true)} fill="#3d4f5c" fillOpacity=".85"/>}
      {spire.map(face => <g key={face.key}>
        <polygon points={pointsAttr(face.points)} fill={face.fill} stroke={style.roofEdge} strokeWidth=".35" strokeLinejoin="round"/>
        {face.textured && <polygon points={pointsAttr(face.points)} fill={face.tone > 1 ? '#fff' : '#000'} fillOpacity={Math.abs(face.tone - 1) * .9}/>}
      </g>)}
    </>
  }

  return <g opacity={building.provenance === 'observed' ? 1 : .78} style={{ cursor: 'help' }}
    onMouseMove={event => onHover(building, event)} onMouseLeave={() => onHover(null)}>
    {defs.length > 0 && <defs>{defs}</defs>}
    <polygon points={pointsAttr(base.map(point => ({ x: point.x + eaveM * .35, y: point.y + eaveM * .12 })))} fill="#1c2a1c" opacity=".2"/>
    {towerBehind && tower}
    {walls}
    {windows && <path d={windows} fill="#4f6577" fillOpacity=".82"/>}
    {roof}
    {!towerBehind && tower}
    <title>{building.label ?? 'Gebäude'} · {building.provenance === 'observed' ? 'reale Geometrie' : 'abgeleitete Bebauungsmasse'}</title>
  </g>
}

/**
 * All real buildings of a scene, back to front. Memoised on the building list:
 * the surrounding scene re-renders many times per second for motion, the
 * building geometry only changes when the scene frame does.
 */
function EarthBuildingMassingLayer({ buildings, onHover }: Props) {
  const ordered = [...buildings].sort((a, b) => (a.center.xM + a.center.yM) - (b.center.xM + b.center.yM))
  return <>
    <defs><BlockArtDefs/></defs>
    {ordered.map(building => <Building key={building.id} building={building} onHover={onHover}/>)}
  </>
}

export default memo(EarthBuildingMassingLayer)
