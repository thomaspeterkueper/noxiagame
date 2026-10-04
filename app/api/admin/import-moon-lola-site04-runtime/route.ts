import { NextRequest, NextResponse } from 'next/server'
import { fromUrl } from 'geotiff'
import { createServiceClient } from '@/lib/supabase/service'
import { sha256Hex } from '@/lib/game/spatial/terrainStorage'

const SOURCE_URL = 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif'
const DATASET_ID = 'moon_lro_lola_south_pole_5m'
const TILE_KEY = 'shackleton-site04-runtime-center-5m-v1'
const STORAGE_PATH = 'moon/lro-lola/south-pole/site04/runtime/site04-center-5m-512.tif'
const PATCH_SIZE_PX = 512

function encodeFloat32ProjectedGeoTiff(params: {
  width: number
  height: number
  data: Float32Array
  originXM: number
  originYM: number
  pixelScaleXM: number
  pixelScaleYM: number
}): Uint8Array {
  const { width, height, data, originXM, originYM, pixelScaleXM, pixelScaleYM } = params
  type Entry = { tag:number; type:number; count:number; valueBytes:Uint8Array; inline:boolean }
  const entries: Entry[] = []
  const le = true
  const u16 = (n:number) => { const b=new Uint8Array(2); new DataView(b.buffer).setUint16(0,n,le); return b }
  const u32 = (n:number) => { const b=new Uint8Array(4); new DataView(b.buffer).setUint32(0,n,le); return b }
  const f64arr = (vals:number[]) => { const b=new Uint8Array(vals.length*8); const dv=new DataView(b.buffer); vals.forEach((v,i)=>dv.setFloat64(i*8,v,le)); return b }
  const addShort=(tag:number,val:number)=>entries.push({tag,type:3,count:1,valueBytes:u16(val),inline:true})
  const addLong=(tag:number,val:number)=>entries.push({tag,type:4,count:1,valueBytes:u32(val),inline:true})
  const addDoubleArr=(tag:number,vals:number[])=>entries.push({tag,type:12,count:vals.length,valueBytes:f64arr(vals),inline:false})

  addLong(256,width); addLong(257,height); addShort(258,32); addShort(259,1); addShort(262,1)
  const stripOffset:{tag:number;type:number;count:number;valueBytes:Uint8Array;inline:boolean}={tag:273,type:4,count:1,valueBytes:u32(0),inline:true}
  entries.push(stripOffset)
  addShort(277,1); addLong(278,height); addLong(279,width*height*4); addShort(339,3)
  addDoubleArr(33550,[pixelScaleXM,pixelScaleYM,0])
  addDoubleArr(33922,[0,0,0,originXM,originYM,0])
  entries.sort((a,b)=>a.tag-b.tag)

  const ifdStart=8
  const ifdSize=2+entries.length*12+4
  let extraOffset=ifdStart+ifdSize
  const extras:{entry:Entry;offset:number}[]=[]
  for(const entry of entries){
    if(!entry.inline){ extras.push({entry,offset:extraOffset}); extraOffset += entry.valueBytes.length + (entry.valueBytes.length%2) }
  }
  const pixelDataOffset=extraOffset
  stripOffset.valueBytes=u32(pixelDataOffset)
  const pixelBytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength)
  const out=new Uint8Array(pixelDataOffset+pixelBytes.length)
  const dv=new DataView(out.buffer)
  dv.setUint8(0,0x49); dv.setUint8(1,0x49); dv.setUint16(2,42,le); dv.setUint32(4,ifdStart,le)
  dv.setUint16(ifdStart,entries.length,le)
  let p=ifdStart+2
  for(const entry of entries){
    dv.setUint16(p,entry.tag,le); dv.setUint16(p+2,entry.type,le); dv.setUint32(p+4,entry.count,le)
    if(entry.inline) out.set(entry.valueBytes,p+8)
    else dv.setUint32(p+8,extras.find(x=>x.entry===entry)!.offset,le)
    p+=12
  }
  dv.setUint32(p,0,le)
  for(const extra of extras) out.set(extra.entry.valueBytes,extra.offset)
  out.set(pixelBytes,pixelDataOffset)
  return out
}

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const secret = new URL(req.url).searchParams.get('secret')
  const { data: cfg } = await supabase.from('internal_config').select('value').eq('key','admin_import_secret').single()
  if (!secret || !cfg || secret !== cfg.value) return NextResponse.json({ error:'Unauthorized' }, { status:401 })

  try {
    const tiff = await fromUrl(SOURCE_URL)
    const image = await tiff.getImage()
    const width=image.getWidth(), height=image.getHeight()
    const [minX,minY,maxX,maxY] = image.getBoundingBox()
    const pixelScaleX=(maxX-minX)/width
    const pixelScaleY=(maxY-minY)/height
    const half=PATCH_SIZE_PX/2
    const centerX=Math.floor(width/2), centerY=Math.floor(height/2)
    const x0=Math.max(0,centerX-half), y0=Math.max(0,centerY-half)
    const x1=Math.min(width,x0+PATCH_SIZE_PX), y1=Math.min(height,y0+PATCH_SIZE_PX)

    const raster = await image.readRasters({ window:[x0,y0,x1,y1], samples:[0], interleave:true })
    const values = raster as unknown as ArrayLike<number>
    const data = new Float32Array(values.length)
    let minElevation=Infinity, maxElevation=-Infinity
    for(let i=0;i<values.length;i++){
      const value=Number(values[i])
      data[i]=value
      if(Number.isFinite(value)){ if(value<minElevation)minElevation=value; if(value>maxElevation)maxElevation=value }
    }

    const patchOriginX=minX+x0*pixelScaleX
    const patchOriginY=maxY-y0*pixelScaleY
    const bytes=encodeFloat32ProjectedGeoTiff({
      width:x1-x0,
      height:y1-y0,
      data,
      originXM:patchOriginX,
      originYM:patchOriginY,
      pixelScaleXM:pixelScaleX,
      pixelScaleYM:pixelScaleY,
    })
    if(bytes.byteLength > 2*1024*1024) throw new Error(`runtime patch too large: ${bytes.byteLength} bytes`)

    const checksum=sha256Hex(bytes)
    const { error: uploadError } = await supabase.storage.from('terrain').upload(STORAGE_PATH, bytes, {
      contentType:'image/tiff',
      upsert:true,
      cacheControl:'31536000',
    })
    if(uploadError) throw new Error(`runtime patch upload failed: ${uploadError.message}`)

    const { error: rowError } = await supabase.from('terrain_tiles').upsert({
      dataset_id:DATASET_ID,
      tile_key:TILE_KEY,
      min_lat:-90,
      min_lon:-180,
      max_lat:-88,
      max_lon:180,
      raster_width:x1-x0,
      raster_height:y1-y0,
      pixel_size_m:5,
      storage_bucket:'terrain',
      storage_path:STORAGE_PATH,
      raster_format:'geotiff',
      nodata_value:null,
      min_elevation_m:Number.isFinite(minElevation)?minElevation:null,
      max_elevation_m:Number.isFinite(maxElevation)?maxElevation:null,
      checksum,
      status:'ready',
      metadata:{
        byte_size:bytes.byteLength,
        source_uri:SOURCE_URL,
        source_product:'Site04_final_adj_5mpp_surf.tif',
        runtime_patch:true,
        runtime_patch_size_px:PATCH_SIZE_PX,
        projected_bbox_m:[
          patchOriginX,
          patchOriginY-(y1-y0)*pixelScaleY,
          patchOriginX+(x1-x0)*pixelScaleX,
          patchOriginY,
        ],
        projection:'south polar stereographic',
        projection_radius_m:1737400,
        projection_center_lon_deg:0,
        projection_x_sign:1,
        projection_y_sign:1,
        stored_scale:1,
        stored_offset:0,
        supersedes_runtime_tile:'shackleton-site04-5m-v1',
      },
    }, { onConflict:'dataset_id,tile_key' })
    if(rowError) throw new Error(`runtime patch manifest failed: ${rowError.message}`)

    return NextResponse.json({
      ok:true,
      tileKey:TILE_KEY,
      storagePath:STORAGE_PATH,
      byteSize:bytes.byteLength,
      rasterWidth:x1-x0,
      rasterHeight:y1-y0,
      elevationRangeM:{
        min:Number.isFinite(minElevation)?minElevation:null,
        max:Number.isFinite(maxElevation)?maxElevation:null,
      },
    })
  } catch (error) {
    return NextResponse.json({ error:error instanceof Error ? error.message : String(error) }, { status:500 })
  }
}
