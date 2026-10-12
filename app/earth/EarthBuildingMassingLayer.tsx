'use client'

// app/earth/EarthBuildingMassingLayer.tsx
// Aktualisiert: 12.10.2026 — Kirchen mit Turm, Spitzhelm und hohen Fenstern; 2,5D-Ebene der realen Gebäude: Walmdächer, Fensterreihen, einmal je Szene aufgebaut
// Version:      1.1.0

import { memo, type MouseEvent, type ReactNode } from 'react'
import type { LocalSurfaceBuilding } from '@/lib/game/spatial/localSurfaceScene'
import { bellTowerFootprint, buildingMassingStyle, extrudeFootprint, hasBellTower, hipRoof, windowPath, type ScreenPoint } from '@/lib/game/spatial/buildingMassing'
import { projectSurfacePoint as iso, surfaceBuildingTop, surfacePointsAttr as pointsAttr } from '@/app/components/WalkableSurfaceRenderer'

// Screen pixels (before the scene zoom) per metre of building height.
export const HEIGHT_PX_PER_M = .8

type Props = {
  buildings: LocalSurfaceBuilding[]
  onHover: (building: LocalSurfaceBuilding | null, event?: MouseEvent) => void
}

function shade(hex: string, factor: number) {
  const value = Number.parseInt(hex.slice(1), 16)
  const channel = (shift: number) => Math.max(0, Math.min(255, Math.round(((value >> shift) & 255) * factor)))
  return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`
}

function Building({ building, onHover }: { building: LocalSurfaceBuilding; onHover: Props['onHover'] }) {
  const footprint = building.footprint && building.footprint.length >= 3 ? building.footprint : null
  const base = footprint ? footprint.map(iso) : surfaceBuildingTop(building.center, building.widthM, building.depthM)
  const style = buildingMassingStyle(building.id, building.tags)
  const heightPx = style.heightM * HEIGHT_PX_PER_M
  const massing = extrudeFootprint(base, heightPx)
  const cls = String(building.tags?.building ?? 'yes')
  const sacred = /^(church|cathedral|chapel|mosque|synagogue|temple|shrine|monastery)$/.test(cls)
  const windows = sacred
    ? windowPath(massing.walls, style.heightM, heightPx, 4.6, true)
    : style.heightM >= 4.5 && !/^(barn|farm_auxiliary|stable|cowshed|sty|hangar|parking)$/.test(cls)
      ? windowPath(massing.walls, style.heightM, heightPx, style.roofForm === 'flat' && style.heightM <= 9 ? 5.2 : 3.4)
      : ''
  // Bell tower: a slim square shaft at one short end with a pointed spire.
  const towerPlan = hasBellTower(cls) && footprint ? bellTowerFootprint(footprint) : null
  let tower: ReactNode = null
  let towerBehind = false
  if (towerPlan) {
    const shaftPx = heightPx * 1.75
    const shaft = extrudeFootprint(towerPlan.corners.map(iso), shaftPx)
    const centre = iso(towerPlan.centre)
    const apex = { x: centre.x, y: centre.y - shaftPx - towerPlan.sideM * 1.5 * HEIGHT_PX_PER_M }
    const spire = shaft.roof.map((point, index) => {
      const next = shaft.roof[(index + 1) % shaft.roof.length]
      const mx = (point.x + next.x) / 2, my = (point.y + next.y) / 2
      return { key: index, depth: my, points: [point, next, apex], fill: shade(style.roof, (mx - centre.x < 0 ? 1.14 : .82) * (my - (centre.y - shaftPx) < 0 ? .9 : 1)) }
    }).sort((a, b) => a.depth - b.depth)
    towerBehind = towerPlan.centre.xM + towerPlan.centre.yM < building.center.xM + building.center.yM
    tower = <>
      {shaft.walls.map((wall, index) => <polygon key={index} points={pointsAttr(wall.points)} fill={wall.lit ? style.wallLight : style.wallDark} stroke="#6d6557" strokeWidth=".3"/>)}
      <path d={windowPath(shaft.walls.map(wall => ({ points: wall.points.map(point => ({ x: point.x, y: point.y - shaftPx * .72 })) })), 4, shaftPx * .2, 2.6, true)} fill="#3d4f5c" fillOpacity=".85"/>
      {spire.map(face => <polygon key={face.key} points={pointsAttr(face.points)} fill={face.fill} stroke={style.roofEdge} strokeWidth=".35" strokeLinejoin="round"/>)}
    </>
  }
  const hip = style.roofForm === 'pitched' && footprint ? hipRoof(footprint) : null
  let roof = <polygon points={pointsAttr(massing.roof)} fill={style.roof} stroke={style.roofEdge} strokeWidth=".5" strokeLinejoin="round"/>
  if (hip) {
    const lift = (heightPx + hip.riseM * HEIGHT_PX_PER_M)
    const ridge: Record<'a' | 'b', ScreenPoint> = {
      a: { x: iso(hip.ridgeA).x, y: iso(hip.ridgeA).y - lift },
      b: { x: iso(hip.ridgeB).x, y: iso(hip.ridgeB).y - lift },
    }
    const cx = (ridge.a.x + ridge.b.x) / 2, cy = (ridge.a.y + ridge.b.y) / 2
    const faces = hip.faces.map(face => {
      const p = massing.roof[face.edge], q = massing.roof[(face.edge + 1) % 4]
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2
      // Light comes from the upper left: faces sloping towards it are bright.
      const tone = (mx - cx < 0 ? 1.12 : .84) * (my - cy < 0 ? .9 : 1)
      return { key: face.edge, depth: my, points: [p, q, ...face.ridge.map(end => ridge[end])], fill: shade(style.roof, tone) }
    }).sort((a, b) => a.depth - b.depth)
    roof = <>{faces.map(face => <polygon key={face.key} points={pointsAttr(face.points)} fill={face.fill} stroke={style.roofEdge} strokeWidth=".35" strokeLinejoin="round"/>)}</>
  }
  return <g opacity={building.provenance === 'observed' ? 1 : .78} style={{ cursor: 'help' }}
    onMouseMove={event => onHover(building, event)} onMouseLeave={() => onHover(null)}>
    <polygon points={pointsAttr(base.map(point => ({ x: point.x + style.heightM * .35, y: point.y + style.heightM * .12 })))} fill="#1c2a1c" opacity=".2"/>
    {towerBehind && tower}
    {massing.walls.map((wall, index) => <polygon key={index} points={pointsAttr(wall.points)} fill={wall.lit ? style.wallLight : style.wallDark} stroke="#6d6557" strokeWidth=".3"/>)}
    {windows && <path d={windows} fill="#4f6577" fillOpacity=".82"/>}
    {roof}
    {!hip && style.roofForm === 'pitched' && <line x1={massing.ridge[0].x} y1={massing.ridge[0].y} x2={massing.ridge[1].x} y2={massing.ridge[1].y} stroke="#ffffff" strokeOpacity=".38" strokeWidth=".9" strokeLinecap="round"/>}
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
  return <>{ordered.map(building => <Building key={building.id} building={building} onHover={onHover}/>)}</>
}

export default memo(EarthBuildingMassingLayer)
