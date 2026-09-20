# NOXIA Brick Prototype CR-01 · Concrete Build v0.1

Status: **construction draft, not yet Studio/physical validated**  
Parent: `docs/design/brick-prototype-cargo-rover-cr01.md`  
Standard: `docs/design/NOXIA-BRICK-DESIGN-STANDARD.md` v0.1

## Purpose

This document turns CR-01 from a shape concept into an actual build recipe. The aim is to expose geometric failures early. Dimensions here are brick-model dimensions only and do not define real NOXIA engineering performance.

## First geometry correction

The original 16-stud overall width target is too optimistic when using robust 56 x 26 mm Technic tyres. With a 10-stud structural chassis and 26 mm tyres, the practical outside width is roughly 17–18 studs depending on hub offset. CR-01 v0.1 therefore accepts an **18-stud nominal outside width** while keeping the structural spine at 10 studs.

This is the first direct finding from applying the Brick Design Standard.

## Chosen wheel standard

Baseline wheel assembly per corner:

- 1 × tyre 56 x 26 Tractor, BrickLink design ID **70695**, black
- 1 × wheel 30.4 mm D x 20 mm with 3 pin holes, design ID **44292**, light bluish grey preferred
- 1 × axle 8L, design ID **3707**, black
- 2 × Technic bush, design ID **3713**, light bluish grey or black

Six identical wheel assemblies are used.

Reason: this wheel/tire family is common, visually industrial, and large enough to establish the rover silhouette without forcing a much larger chassis.

## Structural architecture

### Coordinate convention

- X = left/right
- Y = front/rear
- Z = vertical
- front is Y=0

### Chassis target

- structural width: 10 studs
- structural length: 24 studs
- body length after front/rear modules: about 28 studs
- outside wheel width: target 18 studs
- cargo bay: 8 x 12 studs
- front system block: 8 x 8 studs
- rear system block: 8 x 8 studs

## Core BOM v0.1

### A. Structural spine

- 4 × Technic Liftarm Thick 1 x 15, ID **32278**, black/dark bluish grey
- 4 × Technic Liftarm Thick 1 x 11, ID **32525**, black/dark bluish grey
- 4 × Technic Frame 5 x 7 Open Center, ID **64179**, dark/neutral colour
- 12 × Technic Liftarm Thick 1 x 5, black/dark bluish grey
- 6 × Technic Liftarm Thick 1 x 3, black/dark bluish grey
- 24 × Technic Pin 3L with Friction Ridges, ID **6558**, black/blue as available
- 36 × Technic friction pin 2L, black/blue
- 12 × axle-pin connector / axle pin, neutral/dark

### B. Wheel modules

- 6 × tyre 56 x 26 Tractor, ID **70695**, black
- 6 × wheel 30.4 x 20 with 3 pin holes, ID **44292**, light bluish grey
- 6 × axle 8L, ID **3707**, black
- 12 × Technic bush, ID **3713**, light bluish grey/black
- 12 × Technic Liftarm Thick 1 x 5, dark bluish grey
- 6 × Technic Liftarm Thick 1 x 3, dark bluish grey
- 18 × friction pin 2L

### C. Cargo deck M2

- 2 × Plate 4 x 12, light bluish grey
- 2 × Plate 2 x 12, light bluish grey
- 4 × Plate 2 x 4, dark bluish grey
- 4 × Tile 2 x 4, light bluish grey
- 4 × modified plate / Technic-interface plate with pin or clip connection
- 4 × 1 x 1 round plate or tile, yellow/orange, as visible corner-lock markers
- 4 × bracket or inverted bracket, dark bluish grey
- 4 × small grille tile, medium/light bluish grey

### D. Forward sensor/control module M1

- 2 × Plate 4 x 8, white/light bluish grey
- 2 × Brick 2 x 4, white/light bluish grey
- 4 × Brick 1 x 4, white/light bluish grey
- 2 × slope 2 x 2 or 2 x 3, white/light bluish grey
- 2 × grille tile 1 x 2, medium bluish grey
- 2 × transparent round 1 x 1, clear/blue, work lights
- 3 × transparent dark 1 x 1 / 1 x 2 element, sensor lenses
- 1 × bar/clip mast base
- 1 × short mast using bar + round plate/antenna element
- 2 × dark brackets for attaching shell to Technic core

### E. Rear power/service module M3

- 2 × Plate 4 x 8, white/light bluish grey
- 4 × Brick 1 x 4, white/light bluish grey
- 2 × Brick 2 x 4, white/light bluish grey
- 4 × grille tile 1 x 2, medium/dark bluish grey
- 2 × clip plate
- 2 × bar 3L or 4L
- 2 × round 1 x 1 plate/tile, yellow/orange, service-port markers
- 2 × flexible hose or rigid bar segment, dark/metallic, visible service bundle
- 2 × dark brackets for structural attachment

### F. External skin and deck detail

- 8 × Plate 1 x 4, white/light bluish grey
- 8 × Plate 1 x 6, white/light bluish grey
- 6 × Tile 1 x 4, white/light bluish grey
- 4 × Tile 1 x 2, yellow/orange
- 6 × grille tile 1 x 2, medium/dark bluish grey
- 4 × small wedge/slope elements, white/light bluish grey
- 4 × clip/bar details for service routing

Approximate total at this stage: **~230 pieces**, depending on chosen bracket and pin substitutions. This is deliberately a medium-size technical prototype, not a parts-optimized display model.

## Build sequence

### Stage 1 — central ladder frame

1. Place two 15L liftarms parallel, 8 studs apart centre-to-centre, forming the forward half of the chassis rails.
2. Continue each rail rearward with one 11L liftarm, overlapping the 15L rail by two Technic holes.
3. Pin the overlaps with two friction pins per rail.
4. Install one 5 x 7 frame transversely near the front wheel station.
5. Install a second 5 x 7 frame at the front edge of the cargo bay.
6. Install a third 5 x 7 frame at the rear edge of the cargo bay.
7. Install the fourth 5 x 7 frame at the rear wheel/service station.
8. Add 5L liftarms as diagonal/short cross braces where the frames leave unsupported rail sections.
9. Check that the two rails remain parallel and the chassis lies flat.

**Gate A:** the bare frame must be liftable by one rail without obvious twist. If not, add a second pinned brace at the two rail-overlap zones before proceeding.

### Stage 2 — wheel hardpoints

For each of six stations:

1. Pin one 5L liftarm vertically or slightly downward/outward to the side of the chassis frame.
2. Add a 3L liftarm as a local triangular brace back to the nearest 5 x 7 frame/cross-member.
3. Insert one 8L axle through the outer end of the 5L arm.
4. Retain axle position on the inboard side with one bush.
5. Fit wheel and tyre.
6. Retain the outboard side with the second bush.
7. Confirm tyre does not rub the chassis through a full hand-spin.

Front, middle and rear wheel stations should visually align along the same longitudinal line.

**Gate B:** with all six wheels fitted, the rover must stand on all six tyres on a flat surface. If one pair floats, adjust the wheel-arm mounting holes before adding bodywork.

### Stage 3 — cargo interface

1. Build an independent 8 x 12 plate sandwich from the 4 x 12 and 2 x 12 plates.
2. Reinforce its underside with four 2 x 4 plates.
3. Add one bracket/interface piece near each corner on the underside.
4. Add matching attachment points on the two central chassis cross-members.
5. Use four identical attachment points as the S3 payload interface.
6. Add four yellow/orange corner-lock markers on the deck top.
7. Tile only the centre and outer rim; leave at least four studs exposed for future cargo attachment.

**Gate C:** the deck must lift off as one piece without wheel removal and without disassembling the structural rails.

### Stage 4 — front module

1. Build an 8 x 8 plate base.
2. Add a low 2–3 brick high equipment housing, deliberately avoiding a car-like windscreen.
3. Place two work lights low and wide.
4. Group three sensor lenses on the upper front face.
5. Add a short central or offset mast.
6. Leave at least one side grille/hatch visible.
7. Attach the whole module to the front frame through two dark brackets/pins.

**Gate D:** front must read as sensor/control equipment, not as a passenger-car cockpit.

### Stage 5 — rear service module

1. Build the second 8 x 8 plate base.
2. Form a compact equipment box.
3. Put grille tiles on at least one side and one upper/rear face.
4. Add two external service lines using bar/hose pieces.
5. Mark two accessible service ports in yellow/orange.
6. Attach via two or four repeatable structural points.

**Gate E:** rear module must detach separately from cargo deck.

### Stage 6 — skin

1. Add white/light-grey narrow plates along rail tops where they do not block interfaces.
2. Add limited side panels only between wheel stations.
3. Keep at least 25–35% of the dark Technic structure visible from a 3/4 view.
4. Add yellow/orange only at handles, service points, cargo locks and maintenance edges.
5. Do not add decorative aerodynamic surfaces.

## Expected silhouette after v0.1

```text
TOP VIEW (schematic)

       FRONT
       ┌───────8───────┐
       │ SENSOR/CTRL    │
  O====┤               ├====O
       └───────┬───────┘
               │
  O====╔═══════╧═══════╗====O
       ║   CARGO 8x12  ║
       ║               ║
  O====╚═══════╤═══════╝====O
               │
       ┌───────┴───────┐
       │ POWER/SERVICE │
       └───────────────┘
              REAR
```

## Standard findings already visible

### 1. 4SIU works for modules, not for every dimension

The 8 x 8 and 8 x 12 functional blocks work well. For chassis width and wheel offset, strict multiples of four are unnecessarily restrictive. Recommendation for v0.2: **4SIU governs replaceable modules and interfaces; structural offsets may use 1- or 2-stud increments.**

### 2. Overall width needs to be derived from selected wheel family

The first concept treated width as a visual target. The concrete build shows that wheel/tire geometry must be selected first and the outer envelope derived afterwards.

### 3. Wheel hardpoints should become a reusable subassembly

The six identical wheel stations are strong candidates for a shared NOXIA brick component. A later rocker/bogie experiment can replace the arm while preserving the hub/tire family.

### 4. Cargo interface deserves its own standard

The four-point 8 x 12 payload deck is useful enough to become the first reusable NOXIA brick payload standard if the physical/digital build validates clutch strength and removal.

## Validation still required

This document is not yet equivalent to a finished Studio instruction file. Before calling CR-01 physically validated we still need:

- exact Studio collision check,
- exact pin/hole alignment check,
- exact bracket choice for S3 cargo interface,
- wheel clearance check with the chosen 44292/70695 assembly,
- real part-count export,
- physical or Studio stability test,
- final instruction steps/screenshots.

Those checks may change the BOM. Any such change should feed back into Brick Standard v0.2 rather than being hidden as an implementation detail.
