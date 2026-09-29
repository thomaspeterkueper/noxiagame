import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { robotModuleDefinition } from '@/lib/game/vehicles/robotRetrofit'

async function userFromRequest(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  const s = createServiceClient()
  const { data: { user } } = await s.auth.getUser(token)
  return user ?? null
}

async function requirePresence(s: ReturnType<typeof createServiceClient>, userId: string, locationId: string) {
  const [{ data: profile, error: pe }, { data: location, error: le }] = await Promise.all([
    s.from('profiles').select('current_location').eq('id', userId).maybeSingle(),
    s.from('locations').select('slug').eq('id', locationId).maybeSingle(),
  ])
  if (pe || le) throw new Error(pe?.message ?? le?.message ?? 'Location lookup failed')
  return Boolean(location?.slug && profile?.current_location === location.slug)
}

export async function POST(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const action = typeof body.action === 'string' ? body.action : ''
  const equipmentId = typeof body.equipmentId === 'string' ? body.equipmentId : ''
  if (action !== 'repair' || !equipmentId) return NextResponse.json({ error: 'action=repair und equipmentId erforderlich.' }, { status: 400 })

  const s = createServiceClient()
  try {
    const { data: item, error } = await s.from('equipment_items')
      .select('id,equipment_key,serial_number,status,condition,wear,location_id,inventory_id,metadata')
      .eq('id', equipmentId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!item?.location_id || !item.inventory_id) return NextResponse.json({ error: 'Modul ist nicht in einer Werkstatt eingelagert.' }, { status: 409 })
    if (item.status !== 'stored') return NextResponse.json({ error: 'Nur eingelagerte Module können repariert werden.' }, { status: 409 })
    if (!await requirePresence(s, user.id, item.location_id)) return NextResponse.json({ error: 'Reparatur ist nur vor Ort möglich.' }, { status: 409 })

    const { data: workshop, error: we } = await s.from('logistics_inventories')
      .select('id,metadata')
      .eq('id', item.inventory_id)
      .maybeSingle()
    if (we) throw new Error(we.message)
    if (!workshop || workshop.metadata?.role !== 'equipment_workshop') return NextResponse.json({ error: 'Modul befindet sich nicht im Equipment-Workshop.' }, { status: 409 })

    const definition = robotModuleDefinition(item.equipment_key)
    if (!definition) return NextResponse.json({ error: 'Für dieses Modul existiert noch kein Reparaturprofil.' }, { status: 409 })
    if (Number(item.condition ?? 100) >= 100 && Number(item.wear ?? 0) <= 0) return NextResponse.json({ ok: true, idempotent: true, item })

    const { data: result, error: repairError } = await s.rpc('noxia_repair_equipment_item', {
      p_profile_id: user.id,
      p_equipment_id: item.id,
      p_workshop_inventory_id: workshop.id,
      p_energy_cost: definition.repairEnergyCost,
      p_component_cost: definition.repairComponentCost,
    })
    if (repairError) {
      if (String(repairError.message ?? '').includes('insufficient_resources')) return NextResponse.json({ error: 'Nicht genug Energie oder Komponenten für die Modulreparatur.' }, { status: 409 })
      throw new Error(repairError.message)
    }
    const { data: updated, error: ue } = await s.from('equipment_items')
      .select('id,equipment_key,serial_number,status,condition,wear,metadata,updated_at')
      .eq('id', item.id)
      .single()
    if (ue || !updated) throw new Error(ue?.message ?? 'Updated equipment missing')
    return NextResponse.json({ ok: true, result, item: updated, definition, cost: { energy: definition.repairEnergyCost, components: definition.repairComponentCost } })
  } catch (error) {
    console.error('equipment repair failed:', error)
    return NextResponse.json({ error: 'Modulreparatur konnte nicht durchgeführt werden.' }, { status: 503 })
  }
}
