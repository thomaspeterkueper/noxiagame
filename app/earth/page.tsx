import EarthRegionPreview from './EarthRegionPreview'
import SpaceportAreaComparison from './SpaceportAreaComparison'

export const metadata = {
  title: 'NOXIA Earth · Sauerland',
}

export default function EarthPage() {
  return <>
    <EarthRegionPreview />
    <SpaceportAreaComparison />
  </>
}
