import {
  panMetricCamera,
  viewportToWorld,
  visibleMetricBounds,
  worldToViewport,
  zoomMetricCamera,
} from './mapProjection'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function near(actual: number, expected: number, tolerance = 1e-9) {
  return Math.abs(actual - expected) <= tolerance
}

const viewport = { widthPx: 1000, heightPx: 600 }
const camera = { centerXM: 250, centerYM: -100, metersPerPixel: 2 }

const screen = worldToViewport({ xM: 450, yM: 100 }, camera, viewport)
assert(near(screen.xPx, 600) && near(screen.yPx, 200), 'world projection must use metric camera and north-up screen orientation')
const roundTrip = viewportToWorld(screen, camera, viewport)
assert(near(roundTrip.xM, 450) && near(roundTrip.yM, 100), 'world/viewport projection must round-trip')

const panned = panMetricCamera(camera, 25, -10)
assert(near(panned.centerXM, 200) && near(panned.centerYM, -120), 'screen drag must pan camera in metric world coordinates')

const anchor = { xPx: 800, yPx: 150 }
const before = viewportToWorld(anchor, camera, viewport)
const zoomed = zoomMetricCamera(camera, viewport, 2, anchor)
const after = viewportToWorld(anchor, zoomed, viewport)
assert(near(zoomed.metersPerPixel, 1), 'zoom factor must change scale only')
assert(near(before.xM, after.xM) && near(before.yM, after.yM), 'anchored zoom must preserve world point under cursor')

const bounds = visibleMetricBounds(camera, viewport)
assert(near(bounds.minXM, -750) && near(bounds.maxXM, 1250), 'visible x bounds must derive from camera and viewport')
assert(near(bounds.minYM, -700) && near(bounds.maxYM, 500), 'visible y bounds must derive from camera and viewport')

const fullscreen = { widthPx: 1600, heightPx: 900 }
const centerEmbedded = viewportToWorld({ xPx: 500, yPx: 300 }, camera, viewport)
const centerFullscreen = viewportToWorld({ xPx: 800, yPx: 450 }, camera, fullscreen)
assert(near(centerEmbedded.xM, centerFullscreen.xM) && near(centerEmbedded.yM, centerFullscreen.yM), 'embedded/fullscreen viewport changes must preserve camera world center')

console.log('metric map projection tests passed')
