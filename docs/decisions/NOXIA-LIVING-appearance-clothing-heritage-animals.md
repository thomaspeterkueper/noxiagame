# NOXIA-LIVING — Appearance, clothing, heritage and animals

Status: accepted direction
Date: 2026-10-04

## Principle

Visible appearance is not the same thing as identity or biography.

NOXIA keeps these layers separate:

1. Gender identity — personal identity data; may be unknown.
2. Gender presentation — visible presentation used by the renderer.
3. Physical appearance — body frame, skin tone, hair, facial hair, visible age.
4. Clothing / equipment — changeable state layered on top of the body.
5. Cultural / ethnic heritage — biographical and social identity, never inferred from skin tone, hair or name.
6. Animals — separate living entities, not cosmetic person accessories.

## Current implementation

person_appearance persists presentation and visible traits.

The renderer consumes the visible profile and keeps a deterministic fallback only for missing data.

Unknown-person labels may use visible presentation (for example Mann/Frau/Person), while confirmed identity remains controlled by player-relative identity knowledge.

## Clothing next

clothing_profile is already reserved in person_appearance.

Future clothing should be item-based where gameplay matters:

- everyday clothing
- workwear
- pressure suits
- uniforms
- ceremonial/religious clothing
- fashion and status markers
- weather/environment layers
- wear, damage and cleanliness

Clothing must be able to change without changing the person.

## Heritage next

cultural_heritage is reserved as biographical data.

Heritage may influence language, family history, cuisine, religion, naming traditions or self-description when the character canon supports it.

It must not be automatically inferred from visible phenotype.

## Animals next

Animals should use their own persistent entity model with:

- stable identity
- species/breed or biological type
- owner/caretaker relationships where applicable
- needs and health
- current location/presence
- movement
- social bonds
- optional work/service role

This supports pets, livestock, service animals, research animals and later non-Earth fauna through the same living-world principles.