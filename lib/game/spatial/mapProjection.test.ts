import { panMetricCamera, projectMetricFootprint, viewportToWorld, visibleMetricBounds, worldToViewport, zoomMetricCamera } from './mapProjection'

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message) }
function near(actual: number, expected: number, tolerance = 1e-9) { return Math.abs(actual - expected) <= tolerance }

const viewport = { widthPx: 1000, heightPx: 600 }
const camera = { centerXM: 250, centerYM: -100, metersPerPixel: 2 }
const screen = worldToViewport({ xM: 450, yM: 100 }, camera, viewport)
assert(near(screen.xPx, 600) && near(screen.yPx, 200), 'world projection must use metric camera')
const roundTrip = viewportToWorld(screen, camera, viewport)
assert(near(roundTrip.xM, 450) && near(roundTrip.yM, 100), 'world and viewport projection must round-trip')
const panned = panMetricCamera(camera, 25, -10)
assert(near(panned.centerXM, 200) && near(panned.centerYM, -120), 'screen drag must pan metric camera')
const anchor = { xPx: 800, yPx: 150 }
const before = viewportToWorld(anchor, camera, viewport)
const zoomed = zoomMetricCamera(camera, viewport, 2, anchor)
const after = viewportToWorld(anchor, zoomed, viewport)
assert(near(zoomed.metersPerPixel, 1), 'zoom factor must change scale')
assert(near(before.xM, after.xM) && near(before.yM, after.yM), 'anchored zoom must preserve cursor world point')
const bounds = visibleMetricBounds(camera, viewport)
assert(near(bounds.minXM, -750) && near(bounds.maxXM, 1250), 'visible x bounds must derive from camera')
assert(near(bounds.minYM, -700) && near(bounds.maxYM, 500), 'visible y bounds must derive from camera')
const fullscreen = { widthPx: 1600, heightPx: 900 }
const centerEmbedded = viewportToWorld({ xPx: 500, yPx: 300 }, camera, viewport)
const centerFullscreen = viewportToWorld({ xPx: 800, yPx: 450 }, camera, fullscreen)
assert(near(centerEmbedded.xM, centerFullscreen.xM) && near(centerEmbedded.yM, centerFullscreen.yM), 'viewport size must preserve camera world center')
const footprintCamera = { centerXM: 0, centerYM: 0, metersPerPixel: 1 }
const footprintViewport = { widthPx: 200, heightPx: 200 }
const rectangle = projectMetricFootprint({ xM: 0, yM: 0, widthM: 20, depthM: 10, rotationDeg: 0 }, footprintCamera, footprintViewport)
assert(near(rectangle[0].xPx, 90) && near(rectangle[0].yPx, 105), 'footprint dimensions must remain metric')
assert(near(rectangle[2].xPx, 110) && near(rectangle[2].yPx, 95), 'opposite footprint corner must remain metric')
const rotated = projectMetricFootprint({ xM: 0, yM: 0, widthM: 20, depthM: 10, rotationDeg: 90 }, footprintCamera, footprintViewport)
assert(near(rotated[0].xPx, 105) && near(rotated[0].yPx, 110), 'footprint rotation must remain world-space')
console.log('metric map projection tests passed')
