# NOXIA Modular Facility System

Status: canonical gameplay and asset-design rule.

## Principle

NOXIA facilities grow primarily through **physical functional modules**, not only through abstract building levels.

A facility begins with a viable core or starter module. Additional capabilities, throughput and capacity may require modules placed on neighbouring grid tiles. The resulting footprint is therefore a consequence of the player's actual development decisions.

## Spatial rules

- A module occupies explicit grid tiles.
- A module can be constructed only when every required tile is free, buildable and legally usable by the operator.
- Existing buildings, reserved infrastructure, terrain restrictions or unavailable land can block an expansion.
- Construction never silently displaces another entity.
- Initial placement therefore matters strategically because future expansion space is finite.
- Facilities do not need to expand symmetrically. Their final layout may depend on terrain, roads, neighbouring owners and the sequence in which modules were added.

## Technology versus physical expansion

Technology level and physical size are separate dimensions.

A technology upgrade can improve efficiency, automation, reliability, processing speed or energy consumption of an existing module. It must not create physical capacity that canonically requires another module.

Examples:

- Better warehouse automation can increase handling speed without creating unlimited storage volume.
- Better spaceport control systems can improve turnaround without creating another landing position.
- Better laboratory equipment can improve research output without automatically adding another laboratory room.

## Functional differentiation

Modules should not be reduced to generic `level +1` components. Where useful, different modules create different facility specialisations.

Examples include:

- production hall
- specialised production line
- warehouse
- refrigerated storage
- hazardous-material storage
- loading/transfer module
- laboratory
- workshop
- energy/utility module
- passenger terminal
- cargo terminal
- landing pad
- heavy landing pad

Two facilities with the same original building type may therefore develop into different layouts and economic roles.

## Ownership and multiplayer

Physical facility structure must remain compatible with NOXIA's separation of land ownership and operation. Long-term data modelling should allow land owner, facility/module owner, operator and capacity user to differ where gameplay requires it.

Public infrastructure may expose shared capacity instead of requiring every player to duplicate the same facility. This is particularly important at multiplayer starting locations.

## Spaceports as reference implementation

A `spaceport` is conceptually a facility composed of modules. `landing_pad` should be treated as a spaceport module rather than assuming that one landing-pad entity represents every possible complete spaceport.

### Mini pad

A starter or remote spaceport may use a compact mini-pad module:

- capacity: typically 1–2 small/standard ships, subject to balancing and ship class;
- integrated minimal cargo/storage capacity;
- basic service and utility connection;
- intended to make a small outpost operational without requiring a large terminal complex.

### Larger pads

Larger spaceports can add differentiated pad modules. Pad capacity, operational launch/landing throughput and parking/storage capacity are separate values and must not be conflated.

Possible modules include standard, cargo, passenger and heavy pads. Exact balancing remains data-driven rather than hard-coded into the visual system.

### Earth starting spaceport

Earth is a shared starting location and therefore does **not** begin as a one-pad player outpost. Its state-owned starting spaceport should be a visibly established public facility with enough initial shared capacity for multiplayer starts and with neighbouring expansion interfaces for later growth.

Players use shared Earth infrastructure; they do not each require a duplicate personal Earth landing pad at game start.

## Other facility families

The same system should be applied where it creates meaningful choices, including warehouses, production facilities, schools/research facilities, resource processing and logistics hubs.

It is not mandatory for every decorative or intrinsically atomic building. A module should exist because it has spatial, economic or functional meaning, not merely to make a building larger.

## Visual asset rule

Asset production must support modular composition:

- preserve consistent camera, lighting, ground anchor and scale;
- keep connection/service edges visually plausible;
- avoid artwork that permanently depicts future modules which are not yet constructed;
- use separate module assets where runtime composition is preferable to monolithic final-stage images;
- keep the facility recognisable as it grows.

The Earth raster pass is the first production implementation of this rule.