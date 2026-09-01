'use client'

import { create } from 'zustand'
import { getSessionInfo } from '@/lib/supabase/auth'

export type ColonyWorldLocation = {
  id: string
  slug: string
  name?: string
  location_type?: string
  population?: number
  location_resources?: unknown[]
}

export type ColonyEntity = {
  id: string
  entity_id: string
  entity_type: string
  tile_row: number
  tile_col: number
  profile_id: string | null
  owner_class?: string
  location_id?: string
  locations?: { slug?: string } | null
}

export type ColonyBuild = {
  id?: string
  buildable_id?: string
  status?: string
  completes_at?: string | null
  location_id?: string
  locations?: { slug?: string } | null
  [key: string]: unknown
}

export type ColonyResident = {
  id: string
  displayName: string
  birthYear: number | null
  activityState: string
  lastAction: string | null
  assignments: Array<{ type: string; roleCode: string | null; tileEntityId: string | null }>
  needs: Array<{ code: string; satisfaction: number }>
  skills: Array<{ code: string; level: number; experience: number }>
}

type ColonyState = {
  locationSlug: string | null
  userId: string
  locations: ColonyWorldLocation[]
  entities: ColonyEntity[]
  builds: ColonyBuild[]
  residents: ColonyResident[]
  loading: boolean
  refreshing: boolean
  error: string | null
  updatedAt: number | null
  refresh: (locationSlug: string, options?: { background?: boolean }) => Promise<void>
  clear: () => void
}

let requestSerial = 0

export const useColonyStateStore = create<ColonyState>((set, get) => ({
  locationSlug: null,
  userId: '',
  locations: [],
  entities: [],
  builds: [],
  residents: [],
  loading: false,
  refreshing: false,
  error: null,
  updatedAt: null,

  clear: () => {
    requestSerial += 1
    set({
      locationSlug: null,
      userId: '',
      locations: [],
      entities: [],
      builds: [],
      residents: [],
      loading: false,
      refreshing: false,
      error: null,
      updatedAt: null,
    })
  },

  refresh: async (locationSlug, options) => {
    const background = options?.background === true
    const serial = ++requestSerial
    const previousSlug = get().locationSlug

    set({
      locationSlug,
      loading: background ? get().loading : previousSlug !== locationSlug || !get().updatedAt,
      refreshing: background,
      error: null,
      ...(previousSlug !== locationSlug ? { residents: [] } : {}),
    })

    try {
      const { token, userId } = await getSessionInfo()
      const headers = { Authorization: `Bearer ${token}` }

      const [buildResponse, worldResponse, populationResponse] = await Promise.all([
        fetch('/api/game/build', { headers, cache: 'no-store' }),
        fetch('/api/game/world', { cache: 'no-store' }),
        fetch(`/api/game/population?locationSlug=${encodeURIComponent(locationSlug)}`, { cache: 'no-store' }),
      ])

      if (serial !== requestSerial) return

      const [buildData, worldData, populationData] = await Promise.all([
        buildResponse.ok ? buildResponse.json() : Promise.resolve({}),
        worldResponse.ok ? worldResponse.json() : Promise.resolve({}),
        populationResponse.ok ? populationResponse.json() : Promise.resolve({}),
      ])

      if (serial !== requestSerial) return

      const failed = [
        !buildResponse.ok ? `build:${buildResponse.status}` : null,
        !worldResponse.ok ? `world:${worldResponse.status}` : null,
        !populationResponse.ok ? `population:${populationResponse.status}` : null,
      ].filter(Boolean)

      set({
        locationSlug,
        userId,
        locations: Array.isArray(worldData?.locations) ? worldData.locations : [],
        entities: Array.isArray(buildData?.entities) ? buildData.entities : [],
        builds: Array.isArray(buildData?.builds) ? buildData.builds : [],
        residents: Array.isArray(populationData?.residents) ? populationData.residents : [],
        loading: false,
        refreshing: false,
        error: failed.length ? failed.join(', ') : null,
        updatedAt: Date.now(),
      })
    } catch (error) {
      if (serial !== requestSerial) return
      set({
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : 'colony_state_refresh_failed',
      })
    }
  },
}))

export function selectCurrentColonyState(state: ColonyState) {
  const slug = state.locationSlug
  const current = slug ? state.locations.find(location => location.slug === slug) ?? null : null
  if (!current || !slug) return { current, entities: [], builds: [] }

  return {
    current,
    entities: state.entities.filter(entity => entity.locations?.slug === slug || entity.location_id === current.id),
    builds: state.builds.filter(build => build.locations?.slug === slug || build.location_id === current.id),
  }
}
