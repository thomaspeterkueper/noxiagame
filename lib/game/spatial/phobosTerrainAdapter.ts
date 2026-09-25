import { planetaryToLocalWorld } from './planetary'
import type { PlanetaryCoordinate, TerrainDatasetDescriptor, WorldFrame } from './types'
import type { TerrainRasterAdapter, TerrainRasterSourceSample } from './terrainRaster'

export interface PhobosRasterImage {
  getWidth(): number
  getHeight(): number
  getBoundingBox(): [number, number, number, number]
  getGDALNoData?(): number | string | null
  readRasters(options: { window: [number, number, number, number]; samples: number[]; interleave: true }): Promise<ArrayLike<number>>
}

export type PhobosRasterImageOpener = (url: string) => Promise<PhobosRasterImage>
export type PhobosVerticalConverter = (
  sourceElevationM: number,
  coordinate: PlanetaryCoordinate,
  dataset: TerrainDatasetDescriptor,
  frame: WorldFrame,
) => number | null

const PHOBOS_MEAN_RADIUS_M = 11100

function metadataNumber(dataset: TerrainDatasetDescriptor, key: string, fallback: number) {
  const value = dataset.metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
function normalizeLongitude(lonDeg: number) {
  const normalized = ((lonDeg + 180) % 360 + 360) % 360 - 180
  return normalized === -180 ? 180 : normalized
}
function looksLikeProjectedMeters(box: [number, number, number, number]) {
  return box.some(v => Math.abs(v) > 360)
}
function boundingBoxDeg(image: PhobosRasterImage): [number, number, number, number] {
  const box = image.getBoundingBox()
  if (!looksLikeProjectedMeters(box)) return box
  const toDeg = (m: number) => (m / PHOBOS_MEAN_RADIUS_M) * (180 / Math.PI)
  const [minX, minY, maxX, maxY] = box
  return [toDeg(minX), toDeg(minY), toDeg(maxX), toDeg(maxY)]
}
function pixelForCoordinate(image: PhobosRasterImage, coordinate: PlanetaryCoordinate) {
  const [minLon, minLat, maxLon, maxLat] = boundingBoxDeg(image)
  const lon = normalizeLongitude(coordinate.lonDeg), lat = coordinate.latDeg
  if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) return null
  const xFraction = (lon - minLon) / (maxLon - minLon)
  const yFraction = (maxLat - lat) / (maxLat - minLat)
  return {
    x: Math.min(image.getWidth() - 1, Math.max(0, Math.floor(xFraction * image.getWidth()))),
    y: Math.min(image.getHeight() - 1, Math.max(0, Math.floor(yFraction * image.getHeight()))),
  }
}
function isNoData(image: PhobosRasterImage, value: number) {
  const raw = image.getGDALNoData?.()
  if (raw == null) return false
  const noData = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(noData) && value === noData
}

export class PhobosTerrainAdapter implements TerrainRasterAdapter {
  readonly id = 'phobos-mex-hrsc-dem'
  private imagePromise: Promise<PhobosRasterImage> | null = null

  constructor(
    private readonly openImage: PhobosRasterImageOpener,
    private readonly convertVertical?: PhobosVerticalConverter,
  ) {}

  supports(dataset: TerrainDatasetDescriptor) {
    return dataset.id === 'phobos_mex_hrsc_dem_100m'
  }

  private getImage(dataset: TerrainDatasetDescriptor) {
    if (!this.imagePromise) this.imagePromise = this.openImage(dataset.sourceUri)
    return this.imagePromise
  }

  async sampleAtPlanetary(dataset: TerrainDatasetDescriptor, frame: WorldFrame, coordinate: PlanetaryCoordinate): Promise<TerrainRasterSourceSample | null> {
    if (!this.supports(dataset)) return null
    const image = await this.getImage(dataset)
    const pixel = pixelForCoordinate(image, coordinate)
    if (!pixel) return null
    const raster = await image.readRasters({ window: [pixel.x, pixel.y, pixel.x + 1, pixel.y + 1], samples: [0], interleave: true })
    const storedValue = Number(raster[0])
    if (!Number.isFinite(storedValue) || isNoData(image, storedValue)) return null
    const sourceElevationM = storedValue * metadataNumber(dataset, 'stored_scale', 1) + metadataNumber(dataset, 'stored_offset', 0)

    if (frame.verticalDatum === dataset.verticalReference) {
      if (frame.originAltM == null || !Number.isFinite(frame.originAltM)) return null
      return { sourceElevationM, localUpM: sourceElevationM - frame.originAltM, tileKey: `source:${dataset.id}:${pixel.x}:${pixel.y}` }
    }

    const frameElevationM = this.convertVertical?.(sourceElevationM, coordinate, dataset, frame) ?? null
    if (frameElevationM == null || !Number.isFinite(frameElevationM)) return null
    const local = planetaryToLocalWorld({ latDeg: coordinate.latDeg, lonDeg: coordinate.lonDeg, elevationM: frameElevationM }, frame)
    if (!local) return null
    return { sourceElevationM, localUpM: local.zM, tileKey: `source:${dataset.id}:${pixel.x}:${pixel.y}` }
  }
}

export const PHOBOS_HRSC_DATASET: TerrainDatasetDescriptor = {
  id: 'phobos_mex_hrsc_dem_100m',
  body: 'phobos',
  provider: 'USGS Astrogeology / ESA Mars Express',
  datasetName: 'Phobos Mars Express HRSC DEM Global 100m',
  datasetVersion: '2009-06-01',
  datasetKind: 'dem',
  resolutionM: 100,
  horizontalReference: 'PHOBOS_PLANETOCENTRIC',
  verticalReference: 'PHOBOS_MEAN_RADIUS_11100M',
  latitudeType: 'planetocentric',
  longitudeDirection: 'positive_east',
  sourceUri: 'https://planetarymaps.usgs.gov/mosaic/Phobos_ME_HRSC_DEM_Global_2ppd.tif',
  sourceLicense: 'public-domain',
  accessMode: 'geotiff',
  status: 'catalogued',
  metadata: {
    pixels_per_degree: 2,
    pixel_resolution_m_equator: 100,
    stored_scale: 1,
    stored_offset: 0,
    source_family: 'Mars Express HRSC + Viking (gap-fill)',
    latitude_type: 'planetocentric',
    longitude_direction: 'positive_east',
    vertical_reference: 'Phobos mean spherical radius ~11.1km (approximate; body is triaxial ~13.0x11.4x9.1km)',
    raster_width: 699,
    raster_height: 349,
    source_byte_size_note: '478 kB whole-body raster; no windowed crop needed at ingestion',
  },
}
