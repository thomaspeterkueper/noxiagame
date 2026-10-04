export const GENDER_PRESENTATIONS = ['feminine','masculine','androgynous'] as const
export type GenderPresentation = (typeof GENDER_PRESENTATIONS)[number]

export const BODY_FRAMES = ['slender','average','broad'] as const
export type BodyFrame = (typeof BODY_FRAMES)[number]

export interface PersonAppearance {
  genderPresentation: GenderPresentation
  bodyFrame: BodyFrame
  skinToneCode: string
  hairStyleCode: string
  hairColorCode: string
  facialHairCode: string
  visibleAgeBand: 'child'|'teen'|'young_adult'|'adult'|'older'
  clothingProfile?: Record<string, unknown>
}

export function appearanceFromRow(row: any): PersonAppearance {
  return {
    genderPresentation: row?.gender_presentation ?? 'androgynous',
    bodyFrame: row?.body_frame ?? 'average',
    skinToneCode: row?.skin_tone_code ?? 'skin_3',
    hairStyleCode: row?.hair_style_code ?? 'short',
    hairColorCode: row?.hair_color_code ?? 'dark',
    facialHairCode: row?.facial_hair_code ?? 'none',
    visibleAgeBand: row?.visible_age_band ?? 'adult',
    clothingProfile: row?.clothing_profile ?? {},
  }
}
