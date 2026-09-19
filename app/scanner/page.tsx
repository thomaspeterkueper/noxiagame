import ScannerWorkspace from './ScannerWorkspace'
import CoreSamplePanel from './CoreSamplePanel'
import CoreSampleLearningCard from './CoreSampleLearningCard'

export default async function ScannerPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const params = await searchParams
  const location = params.location || 'mars'
  return <>
    <ScannerWorkspace location={location} />
    <CoreSamplePanel location={location} />
    <CoreSampleLearningCard />
  </>
}
