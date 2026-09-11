import MarsRegionPreview from './MarsRegionPreview'
import TharsisCorePreview from './TharsisCorePreview'

export const metadata = {
  title: 'NOXIA Mars',
}

export default function MarsPage() {
  return <>
    <MarsRegionPreview />
    <TharsisCorePreview />
  </>
}
