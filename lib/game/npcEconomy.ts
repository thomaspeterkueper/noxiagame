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
