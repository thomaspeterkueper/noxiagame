export interface MetricMapCamera {
  centerXM: number
  centerYM: number
  metersPerPixel: number
}

export interface MetricViewportSize {
  widthPx: number
  heightPx: number
}

export interface ViewportPoint {
  xPx: number
  yPx: number
}

export interface WorldMapPoint {
  xM: number
  yM: number
}

function assertViewport(camera: MetricMapCamera, viewport: MetricViewportSize) {
  if (!Number.isFinite(camera.centerXM) || !Number.isFinite(camera.centerYM)) throw new Error('Map camera center must be finite')
  if (!Number.isFinite(camera.metersPerPixel) || camera.metersPerPixel <= 0) throw new Error('Map camera metersPerPixel must be positive')
  if (!Number.isFinite(viewport.widthPx) || !Number.isFinite(viewport.heightPx) || viewport.widthPx <= 0 || viewport.heightPx <= 0) {
    throw new Error('Map viewport dimensions must be positive')
  }
}

/**
 * Maps canonical local-world metres to a 2D viewport. World +Y is north/up;
 * screen +Y is down. Renderer dimensions never alter world geometry.
 */
export function worldToViewport(
  point: WorldMapPoint,
  camera: MetricMapCamera,
  viewport: MetricViewportSize,
): ViewportPoint {
  assertViewport(camera, viewport)
  return {
    xPx: viewport.widthPx / 2 + (point.xM - camera.centerXM) / camera.metersPerPixel,
    yPx: viewport.heightPx / 2 - (point.yM - camera.centerYM) / camera.metersPerPixel,
  }
}

export function viewportToWorld(
  point: ViewportPoint,
  camera: MetricMapCamera,
  viewport: MetricViewportSize,
): WorldMapPoint {
  assertViewport(camera, viewport)
  return {
    xM: camera.centerXM + (point.xPx - viewport.widthPx / 2) * camera.metersPerPixel,
    yM: camera.centerYM - (point.yPx - viewport.heightPx / 2) * camera.metersPerPixel,
  }
}

/** Pan by a screen-space drag while preserving metric camera semantics. */
export function panMetricCamera(camera: MetricMapCamera, deltaXPx: number, deltaYPx: number): MetricMapCamera {
  return {
    ...camera,
    centerXM: camera.centerXM - deltaXPx * camera.metersPerPixel,
    centerYM: camera.centerYM + deltaYPx * camera.metersPerPixel,
  }
}

/**
 * Zoom around an optional viewport anchor. The world point under the cursor stays
 * fixed, which allows embedded and fullscreen renderers to share one camera.
 */
export function zoomMetricCamera(
  camera: MetricMapCamera,
  viewport: MetricViewportSize,
  factor: number,
  anchor: ViewportPoint = { xPx: viewport.widthPx / 2, yPx: viewport.heightPx / 2 },
): MetricMapCamera {
  assertViewport(camera, viewport)
  if (!Number.isFinite(factor) || factor <= 0) throw new Error('Map zoom factor must be positive')
  const before = viewportToWorld(anchor, camera, viewport)
  const next = { ...camera, metersPerPixel: camera.metersPerPixel / factor }
  const after = viewportToWorld(anchor, next, viewport)
  return {
    ...next,
    centerXM: next.centerXM + (before.xM - after.xM),
    centerYM: next.centerYM + (before.yM - after.yM),
  }
}

export function visibleMetricBounds(camera: MetricMapCamera, viewport: MetricViewportSize) {
  const northWest = viewportToWorld({ xPx: 0, yPx: 0 }, camera, viewport)
  const southEast = viewportToWorld({ xPx: viewport.widthPx, yPx: viewport.heightPx }, camera, viewport)
  return {
    minXM: northWest.xM,
    maxXM: southEast.xM,
    minYM: southEast.yM,
    maxYM: northWest.yM,
  }
}
