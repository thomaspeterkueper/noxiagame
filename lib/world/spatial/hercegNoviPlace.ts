/** Verified town point: OpenStreetMap node 123858919 (Herceg Novi). */
export const HERCEG_NOVI_EARTH_PLACE = {
  id: 'earth-montenegro-herceg-novi',
  name: 'Herceg Novi',
  country: 'Montenegro',
  region: 'Bucht von Kotor',
  center: { lat: 42.45176, lon: 18.53675 },
  osmNodeId: '123858919',
  narrativeStatus: 'potential-novel-setting',
  settingNotes: ['historic-old-town', 'coastal-hillside', 'bay-of-kotor', 'waterfront'],
  // A story overlay must not alter observed roads or geographic geometry.
  geographySource: 'OpenStreetMap',
} as const
