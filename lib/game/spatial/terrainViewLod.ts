export interface TerrainViewLod { spanM:number; size:number; stepM:number; sampleCount:number }

export function terrainViewLod(requestedSpanM:number,sourceResolutionM:number,size=17):TerrainViewLod{
  if(!Number.isFinite(requestedSpanM)||requestedSpanM<=0)throw new Error('requested terrain span must be positive')
  if(!Number.isFinite(sourceResolutionM)||sourceResolutionM<=0)throw new Error('source terrain resolution must be positive')
  const gridSize=Math.max(3,Math.min(33,Math.floor(size)))
  const spanM=Math.max(300,Math.min(20_000,requestedSpanM))
  const stepM=Math.max(sourceResolutionM,Math.ceil(spanM/(gridSize-1)))
  return{spanM,size:gridSize,stepM,sampleCount:gridSize*gridSize}
}
