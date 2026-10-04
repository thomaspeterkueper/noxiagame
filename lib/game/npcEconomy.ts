import { createServiceClient } from '@/lib/supabase/service'

const MAX_GIFT_CREDITS = 1000

export type NpcCreditTransferResult = {
  ok: true
  person_id: string
  actor_id: string
  amount: number
  player_credits: number
  npc_credits: number
}

export function normalizeNpcGiftAmount(value: unknown) {
  const amount = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(amount) || amount < 1 || amount > MAX_GIFT_CREDITS) return null
  return amount
}

export async function transferPlayerToNpcCredits(input: {
  profileId: string
  personId: string
  amount: number
  note?: string
}): Promise<NpcCreditTransferResult> {
  const amount = normalizeNpcGiftAmount(input.amount)
  if (!amount) throw new Error('NOXIA_TRANSFER_AMOUNT_INVALID')

  const supabase = createServiceClient()
  const { data: tickRow } = await supabase
    .from('tick_log')
    .select('tick_number')
    .order('tick_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase.rpc('transfer_player_to_npc_credits', {
    p_profile_id: input.profileId,
    p_person_id: input.personId,
    p_amount: amount,
    p_tick: tickRow?.tick_number ?? 0,
    p_note: String(input.note ?? 'Geschenk eines Spielers').slice(0, 240),
  })

  if (error) throw new Error(error.message)
  return data as NpcCreditTransferResult
}


export async function runNpcPayrollTick(supabase: any, tick: number) {
  if (tick % 24 !== 0) {
    return { ok: true, due: false, paid: 0, duplicates: 0, insufficient: 0, total_credits: 0 }
  }

  const [
    { data: syncData, error: syncError },
    { data: publicJobData, error: publicJobError },
    { data: tenancyData, error: tenancyError },
  ] = await Promise.all([
    supabase.rpc('sync_employer_economy', { p_tick: tick }),
    supabase.rpc('sync_public_unlocated_jobs', { p_tick: tick }),
    supabase.rpc('sync_person_tenancies', { p_tick: tick }),
  ])

  if (syncError) console.error('syncEmployerEconomy failed', { tick, code: syncError.code })
  if (publicJobError) console.error('syncPublicUnlocatedJobs failed', { tick, code: publicJobError.code })
  if (tenancyError) console.error('syncPersonTenancies failed', { tick, code: tenancyError.code })

  const [{ data, error }, { data: rentData, error: rentError }] = await Promise.all([
    supabase.rpc('run_npc_payroll', { p_tick: tick }),
    supabase.rpc('run_npc_rent_settlement', { p_tick: tick }),
  ])
  if (error) {
    console.error('runNpcPayrollTick failed', { tick, code: error.code })
    return {
      ok: false,
      due: true,
      employerSync: syncData ?? null,
      publicJobSync: publicJobData ?? null,
      tenancySync: tenancyData ?? null,
      rent: rentData ?? null,
      paid: 0,
      duplicates: 0,
      insufficient: 0,
      total_credits: 0,
    }
  }

  if (rentError) console.error('runNpcRentSettlement failed', { tick, code: rentError.code })

  return {
    ...(data ?? { ok: true, due: true, paid: 0, duplicates: 0, insufficient: 0, total_credits: 0 }),
    employerSync: syncData ?? null,
    publicJobSync: publicJobData ?? null,
    tenancySync: tenancyData ?? null,
    rent: rentData ?? null,
  }
}

export async function fundPlayerCorp(input: {
  profileId: string
  amount: number
  requestId: string
  note?: string
}) {
  const amount = Number.parseInt(String(input.amount), 10)
  if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
    throw new Error('NOXIA_CORP_FUND_AMOUNT_INVALID')
  }

  const supabase = createServiceClient()
  const { data: tickRow } = await supabase
    .from('tick_log')
    .select('tick_number')
    .order('tick_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase.rpc('fund_player_corp', {
    p_profile_id: input.profileId,
    p_amount: amount,
    p_tick: tickRow?.tick_number ?? 0,
    p_request_id: input.requestId,
    p_note: String(input.note ?? 'Einlage des Eigentümers').slice(0, 240),
  })

  if (error) throw new Error(error.message)
  return data
}


export async function runNpcConsumptionTick(supabase: any, tick: number) {
  if (tick % 6 !== 0) {
    return { ok: true, due: false, bought: 0, no_money: 0, no_seller: 0, total_credits: 0 }
  }

  const { data, error } = await supabase.rpc('run_npc_consumption', { p_tick: tick })
  if (error) {
    console.error('runNpcConsumptionTick failed', { tick, code: error.code })
    return { ok: false, due: true, bought: 0, no_money: 0, no_seller: 0, total_credits: 0 }
  }
  return data ?? { ok: true, due: true, bought: 0, no_money: 0, no_seller: 0, total_credits: 0 }
}
