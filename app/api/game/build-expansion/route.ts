import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { canBuildExpansion, getExpansionDef } from '@/lib/game/buildingExpansions'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

async function completeDueExpansions(profileId: string) {
  const { data: due } = await serviceClient
    .from('player_builds')
    .select('*')
    .eq('profile_id', profileId)
    .eq('target_type', 'building_expansion')
    .eq('status', 'building')
    .lte('completes_at', new Date().toISOString())

  for (const build of due ?? []) {
    const def = getExpansionDef(build.buildable_id)
    if (!def || build.parent_id == null) continue

    const { data: parent } = await serviceClient
      .from('tile_entities')
      .select('id, profile_id, location_id, tile_level, tile_row, tile_col, entity_type, entity_id, status')
      .eq('id', build.parent_id)
      .eq('profile_id', profileId)
      .maybeSingle()

    if (!parent || parent.entity_type !== 'building' || parent.status !== 'active') continue
    if (!def.parentBuildingIds.includes(parent.entity_id)) continue

    const { data: existing } = await serviceClient
      .from('tile_entities')
      .select('id')
      .eq('parent_id', parent.id)
      .eq('entity_id', build.buildable_id)
      .eq('slot', build.slot)
      .maybeSingle()

    if (!existing) {
      const { data: inserted, error } = await serviceClient
        .from('tile_entities')
        .insert({
          profile_id: profileId,
          location_id: parent.location_id,
          tile_level: parent.tile_level,
          tile_row: parent.tile_row,
          tile_col: parent.tile_col,
          entity_type: 'building',
          entity_id: build.buildable_id,
          parent_id: parent.id,
          slot: build.slot,
          condition: 100,
          status: 'active',
          owner_class: 'PLAYER',
          owner_id: profileId,
        })
        .select('id')
        .single()

      if (error || !inserted) continue
      await serviceClient.from('player_builds')
        .update({ status: 'complete', entity_ref: inserted.id })
        .eq('id', build.id)
    } else {
      await serviceClient.from('player_builds')
        .update({ status: 'complete', entity_ref: existing.id })
        .eq('id', build.id)
    }
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await completeDueExpansions(user.id)

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (!action) {
    const { data: builds } = await serviceClient
      .from('player_builds')
      .select('*')
      .eq('profile_id', user.id)
      .eq('target_type', 'building_expansion')
      .in('status', ['building', 'complete'])
      .order('created_at', { ascending: false })

    return NextResponse.json({ builds: builds ?? [] })
  }

  if (action === 'start') {
    const expansionId = searchParams.get('expansionId')
    const parentEntityId = searchParams.get('parentEntityId')
    if (!expansionId || !parentEntityId) {
      return NextResponse.json({ error: 'Fehlende Parameter' }, { status: 400 })
    }

    const def = getExpansionDef(expansionId)
    if (!def) return NextResponse.json({ error: 'Unbekannte Erweiterung' }, { status: 400 })

    const { data: parent } = await serviceClient
      .from('tile_entities')
      .select('id, profile_id, location_id, tile_level, tile_row, tile_col, entity_type, entity_id, status')
      .eq('id', parentEntityId)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!parent) return NextResponse.json({ error: 'Basisgebäude nicht gefunden oder gehört dir nicht' }, { status: 404 })
    if (parent.entity_type !== 'building' || parent.status !== 'active') {
      return NextResponse.json({ error: 'Basisgebäude ist nicht aktiv' }, { status: 400 })
    }
    if (!canBuildExpansion(def, parent.entity_id)) {
      return NextResponse.json({ error: 'Erweiterung ist für dieses Gebäude nicht baubar' }, { status: 400 })
    }

    const { data: existing } = await serviceClient
      .from('tile_entities')
      .select('id')
      .eq('parent_id', parent.id)
      .eq('entity_id', expansionId)
      .limit(1)
    const { data: pending } = await serviceClient
      .from('player_builds')
      .select('id')
      .eq('profile_id', user.id)
      .eq('target_type', 'building_expansion')
      .eq('parent_id', parent.id)
      .eq('buildable_id', expansionId)
      .eq('status', 'building')
      .limit(1)

    if ((existing?.length ?? 0) > 0 || (pending?.length ?? 0) > 0) {
      return NextResponse.json({ error: 'Diese Erweiterung existiert bereits oder wird gebaut.' }, { status: 409 })
    }

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()
    const cost = def.cost as number
    const buildTicks = def.buildTimeTicks as number
    if (!profile || profile.credits < cost) {
      return NextResponse.json({ error: 'Unzureichende Credits.' }, { status: 400 })
    }

    const [{ data: children }, { data: pendingSlots }] = await Promise.all([
      serviceClient.from('tile_entities').select('slot').eq('parent_id', parent.id),
      serviceClient.from('player_builds').select('slot').eq('parent_id', parent.id).eq('target_type', 'building_expansion').eq('status', 'building'),
    ])
    const usedSlots = [
      ...(children ?? []).map(row => row.slot),
      ...(pendingSlots ?? []).map(row => row.slot),
    ].filter((slot): slot is number => typeof slot === 'number')
    const nextSlot = usedSlots.length ? Math.max(...usedSlots) + 1 : 0

    const completesAt = new Date()
    completesAt.setHours(completesAt.getHours() + buildTicks * 24)

    const { data: build, error: buildError } = await serviceClient
      .from('player_builds')
      .insert({
        profile_id: user.id,
        buildable_id: expansionId,
        target_type: 'building_expansion',
        location_id: parent.location_id,
        tile_level: parent.tile_level,
        tile_row: parent.tile_row,
        tile_col: parent.tile_col,
        parent_id: parent.id,
        slot: nextSlot,
        status: 'building',
        completes_at: completesAt.toISOString(),
      })
      .select('id')
      .single()

    if (buildError || !build) return NextResponse.json({ error: 'Bauauftrag konnte nicht angelegt werden' }, { status: 500 })

    const { error: creditError } = await serviceClient
      .from('profiles')
      .update({ credits: profile.credits - cost })
      .eq('id', user.id)

    if (creditError) {
      await serviceClient.from('player_builds').delete().eq('id', build.id)
      return NextResponse.json({ error: 'Credits konnten nicht gebucht werden' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      buildId: build.id,
      expansionId,
      parentEntityId: parent.id,
      slot: nextSlot,
      cost,
      newCredits: profile.credits - cost,
      completesAt: completesAt.toISOString(),
    })
  }

  if (action === 'cancel') {
    const buildId = searchParams.get('buildId')
    if (!buildId) return NextResponse.json({ error: 'Fehlende Build ID' }, { status: 400 })

    const { data: build } = await serviceClient
      .from('player_builds')
      .select('*')
      .eq('id', buildId)
      .eq('profile_id', user.id)
      .eq('target_type', 'building_expansion')
      .eq('status', 'building')
      .maybeSingle()
    if (!build) return NextResponse.json({ error: 'Erweiterungsbau nicht gefunden' }, { status: 404 })

    const def = getExpansionDef(build.buildable_id)
    const refund = Math.floor((def?.cost ?? 0) * 0.5)
    const { data: profile } = await serviceClient.from('profiles').select('credits').eq('id', user.id).single()

    await serviceClient.from('player_builds').update({ status: 'cancelled' }).eq('id', build.id)
    if (profile && refund > 0) {
      await serviceClient.from('profiles').update({ credits: profile.credits + refund }).eq('id', user.id)
    }

    return NextResponse.json({ ok: true, refund })
  }

  return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
}
