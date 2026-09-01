import ScannerWorkspace from './ScannerWorkspace'

export default async function ScannerPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const params = await searchParams
  return <ScannerWorkspace location={params.location || 'mars'} />
}
