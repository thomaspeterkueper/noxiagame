import { panMetricCamera, projectMetricFootprint, viewportToWorld, visibleMetricBounds, worldToViewport, zoomMetricCamera } from './mapProjection'
function assert(condition:boolean,message:string){if(!condition)throw new Error(message)}
function near(actual:number,expected:number,tolerance=1e-9){return Math.abs(actual-expected)<=tolerance}
const viewport={widthPx:1000,heightPx:600},camera={centerXM:250,centerYM:-100,metersPerPixel:2}
const screen=worldToViewport({xM:450,yM:100},camera,viewport);assert(near(screen.xPx,600)&&near(screen.yPx,200),'world projection must use metric camera')
const roundTrip=viewportToWorld(screen,camera,viewport);assert(near(roundTrip.xM,450)&&near(roundTrip.yM,100),'projection must round-trip')
const panned=panMetricCamera(camera,25,-10);assert(near(panned.centerXM,200)&&near(panned.centerYM,-120),'drag must pan metric camera')
const anchor={xPx:800,yPx:150},before=viewportToWorld(anchor,camera,viewport),zoomed=zoomMetricCamera(camera,viewport,2,anchor),after=viewportToWorld(anchor,zoomed,viewport);assert(near(before.xM,after.xM)&&near(before.yM,after.yM),'anchored zoom must preserve world point')
const bounds=visibleMetricBounds(camera,viewport);assert(near(bounds.minXM,-750)&&near(bounds.maxXM,1250)&&near(bounds.minYM,-700)&&near(bounds.maxYM,500),'visible bounds must derive from metric camera')
const fullscreen={widthPx:1600,heightPx:900};assert(near(viewportToWorld({xPx:500,yPx:300},camera,viewport).xM,viewportToWorld({xPx:800,yPx:450},camera,fullscreen).xM),'viewport resize must preserve world center')
const rectangle=projectMetricFootprint({xM:0,yM:0,widthM:20,depthM:10,rotationDeg:0},{centerXM:0,centerYM:0,metersPerPixel:1},{widthPx:200,heightPx:200});assert(near(rectangle[0].xPx,90)&&near(rectangle[2].xPx,110),'footprint dimensions must remain metric')
console.log('metric map projection tests passed')
