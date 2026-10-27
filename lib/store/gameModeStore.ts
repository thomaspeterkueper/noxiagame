import { create } from 'zustand'

export type GameMode = 'colony' | 'planning' | 'interior'

interface GameModeState {
  mode: GameMode
  interiorBuildingId: string | null
  enterColony: () => void
  enterPlanning: () => void
  enterInterior: (buildingId: string) => void
  resetForLocation: () => void
  /** Onboarding fertig und Standort geladen (DashboardGate). Vorher zeichnet die Karte nichts – sonst überdeckt sie den Eröffnungsdialog (27.10.2026). */
  dashboardReady: boolean
  setDashboardReady: (ready: boolean) => void
}

// Start in der begehbaren Ansicht, nicht in der Übersichtskarte (Thomas, 27.10.2026:
// „man startet mit der begehbaren Karte und nicht mit der Übersicht“). Die Übersicht
// bleibt über „Karte“ im Cockpit erreichbar.
export const useGameModeStore = create<GameModeState>((set) => ({
  mode: 'colony',
  interiorBuildingId: null,

  enterColony: () => set({ mode: 'colony', interiorBuildingId: null }),
  enterPlanning: () => set({ mode: 'planning', interiorBuildingId: null }),
  enterInterior: (buildingId) => set({ mode: 'interior', interiorBuildingId: buildingId }),
  resetForLocation: () => set({ mode: 'colony', interiorBuildingId: null }),
  dashboardReady: false,
  setDashboardReady: (ready) => set({ dashboardReady: ready }),
}))
