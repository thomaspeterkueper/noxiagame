# NOXIA Brick Prototype CR-01 · Cargo Rover

Status: **First physical/digital construction test**  
Standard: `docs/design/NOXIA-BRICK-DESIGN-STANDARD.md` v0.1  
Gameplay role: Cargo Rover from `docs/design/moon-surface-logistics.md`  
Scale class: **B2 — Technical Display Scale**

> Important: all dimensions in this document are **model dimensions in studs/brick geometry**. They do not define real NOXIA vehicle mass, payload, energy use, speed, gradeability or other Engineering values.

## 1. Test objective

CR-01 is not intended to be the final lunar rover. It is the first stress test of the Brick Design Standard.

It must answer:

- Does 4SIU create useful modularity or make the model too blocky?
- Can a rover look convincingly NOXIA while remaining physically buildable?
- Can cargo, systems and wheel modules be exchanged without rebuilding the whole chassis?
- Is the visual hierarchy readable: structure → systems → hull → payload?
- Can the same chassis plausibly seed survey, maintenance and rescue variants?

## 2. Target silhouette

A low, wide, six-wheel utility rover with a short forward control/sensor section, exposed structural center and removable rear/central payload deck.

The vehicle should look like **industrial surface equipment**, not a car and not a military sci-fi vehicle.

Visual priorities:

1. large wheels relative to body,
2. low center volume,
3. strong dark structural spine,
4. bright replaceable outer panels,
5. obvious central cargo module,
6. exposed service detail around the rear systems block,
7. compact sensor mast rather than a decorative cockpit canopy.

## 3. Model envelope

Initial target dimensions:

- structural chassis: **10 studs wide × 24 studs long**
- nominal body envelope: **12 studs wide × 28 studs long**
- overall wheel-to-wheel width: approximately **16 studs**
- nominal body height excluding mast: **7–9 bricks**
- mast maximum: approximately **12–14 bricks above ground**

These values are intentionally compact enough for a desk model while leaving meaningful internal layering.

## 4. Module map

```text
FRONT

  [ sensor / control ]      8×8
          │
  ┌───────┴────────┐
  │ forward module │
  └───────┬────────┘
          │
  ╔════════════════╗
  ║ STRUCTURAL     ║
  ║ SPINE          ║
  ║                ║
  ║  [ CARGO ]     ║  8×12 removable payload
  ║                ║
  ╚════════════════╝
          │
  [ power/service ]         8×8

REAR
```

Primary modules:

### M1 — Forward Control/Sensor Module

Nominal footprint: **8×8 studs**.

Contains visually:

- protected electronics volume,
- forward cameras/lidar/radar analogue,
- two small work lights,
- tow/recovery hardpoint,
- optional compact human access indication without forcing a full crew cabin.

This keeps CR-01 compatible with autonomous or supervised operation.

### M2 — Central Cargo Module

Nominal footprint: **8×12 studs**.

Must be removable as one subassembly.

Baseline version:

- low-sided pallet/container deck,
- four visible corner locks,
- two service/handling markings,
- no permanently attached decorative cargo.

Future drop-in replacements:

- sealed cargo box,
- sample laboratory,
- maintenance workshop,
- rescue module,
- battery pack,
- drilling support module.

### M3 — Rear Power/Service Module

Nominal footprint: **8×8 studs**.

Should visibly contain at least three different technical layers:

- primary enclosed equipment box,
- external service connectors/pipes,
- radiator/thermal-management analogue or protected grille/panel.

It must be detachable from the chassis through an S1 structural interface.

### M4–M9 — Six Wheel Units

Three units per side.

Each wheel unit should visually read as replaceable. Preferred construction:

- Technic arm or beam connection,
- axle/pin wheel mounting,
- dark structural components,
- small light/grey hub detail.

The first version does **not** need physically accurate active suspension. The target is a robust articulated visual prototype that can later be upgraded.

## 5. Structural concept

### 5.1 Main spine

Use two longitudinal Technic beams or equivalent pinned frame members separated laterally to create a rigid ladder/spine chassis.

Target:

- dark grey/black structural core,
- cross-members every ~4 studs where practical,
- at least two cross-members under cargo module,
- no large body panel used as the sole load-bearing element.

### 5.2 System skin

System bricks/plates form:

- top deck,
- light exterior panels,
- access hatches,
- mud/dust guards only where functionally justified,
- sensor housing.

Panels should be removable before the structural frame comes apart.

## 6. Interface implementation

### S1 Structural Interface

CR-01 uses repeated Technic pin/axle attachment points at the 4SIU rhythm.

At minimum:

- cargo module: 4-point attachment,
- rear systems module: 2–4 point attachment,
- each wheel unit: independent structural attachment.

### S2 Service Interface

Use small bars/clips/round elements to represent service connections.

Required visible groups:

- power/data between M1 and spine,
- service bundle between cargo interface and rear module,
- one externally accessible rear service panel.

### S3 Payload Interface

Cargo module is the main test.

Acceptance:

- can be detached without removing wheels,
- can be detached without opening structural spine,
- replacement module fits the same attachment geometry.

### S4 Crew/Pressure Interface

Not required for CR-01 baseline. If a later crew cabin is fitted, its pressure interface must be geometrically distinct from the open cargo S3 interface.

## 7. Colour implementation for prototype 1

Recommended first build:

- structural frame: black/dark bluish grey
- body/service housings: white/light bluish grey
- cargo deck: light/medium grey
- maintenance/handling markers: yellow or orange
- warning/emergency detail: minimal red
- optical sensors: transparent black/clear/dark transparent elements

Do not optimize the first build for exact brand-specific colour availability. Geometry and hierarchy are the test priorities.

## 8. Wheel and suspension experiment

CR-01 should be built in two possible configurations if practical.

### A — Fixed articulated bogie

Simpler and preferred for first physical prototype.

- front/middle/rear wheel arms visibly separate,
- limited articulation or decorative articulation sufficient,
- highest robustness.

### B — Rocker/bogie-inspired variant

Second test only.

Purpose:

- compare visual realism,
- assess part count,
- assess stability,
- see whether complexity improves the NOXIA design enough to justify it.

The mechanism is not automatically canonical just because the brick model can implement it.

## 9. Brick families expected

Brand-neutral part families:

- Technic liftarms 3L–15L
- Technic pins and axle pins
- axles and bushes
- 6 compatible off-road wheels/tyres
- plates 1×N, 2×N and 4×N
- brackets/SNOT bricks
- tiles and grille tiles
- slopes/wedges in moderation
- clips and bars
- round plates/tiles for connectors
- small transparent elements for sensors/lights
- hinge plates or compact joints for mast/service covers

Specialized moulds should be avoided in prototype 1 unless they solve a clear geometric problem.

## 10. Construction sequence

### Stage 1 — Bare chassis

Build only:

- central spine,
- cross-members,
- six wheel attachment points,
- cargo S3 attachment geometry.

Test:

- torsional rigidity,
- wheel clearance,
- whether the 4SIU rhythm is practical.

### Stage 2 — Wheel modules

Fit six independent wheel units.

Test:

- stance,
- clearance,
- visual load capacity,
- whether overall width is excessive.

### Stage 3 — Cargo module

Fit removable 8×12 cargo deck.

Test:

- removal process,
- structural independence,
- whether a second dummy module can replace it without adapters.

### Stage 4 — Front and rear systems

Add M1 and M3.

Test:

- NOXIA silhouette,
- massing,
- service visibility,
- front/rear differentiation.

### Stage 5 — Skin and detail

Add only enough panelling to create a coherent finished prototype.

Rule: if a panel hides an important functional relationship, omit or reduce it.

## 11. Preliminary acceptance checklist

CR-01 passes the v0.1 standard if:

- [ ] cargo module detaches independently,
- [ ] rear service module detaches independently,
- [ ] wheel assemblies read as replaceable units,
- [ ] dark structural core remains partly visible,
- [ ] bright body panels do not turn the model into a smooth car-like shell,
- [ ] front sensor/control section is visually distinct,
- [ ] at least one service bundle is visible,
- [ ] model remains stable when lifted by the structural chassis,
- [ ] overall silhouette remains industrial and near-future,
- [ ] no game/Engineering performance value had to be invented to complete the build.

## 12. Expected findings for Standard v0.2

The first build should explicitly record:

1. whether 4SIU remains the base module,
2. whether 8×8 / 8×12 modules are too coarse,
3. ideal rover chassis width,
4. preferred wheel attachment family,
5. how much exposed Technic structure still looks like NOXIA rather than a bare construction toy,
6. whether colour-coded service points are useful,
7. whether a standard cargo pallet/container should become the next shared brick component.

## 13. Next model after CR-01

If CR-01 passes, the preferred second prototype is **CR-01-S Survey Rover**, reusing the same chassis while replacing the central cargo module with:

- telescopic sensor mast,
- sample storage,
- instrument package,
- small deployable drone bay.

That will test whether the standard actually generates a **vehicle family** rather than a single attractive model.
