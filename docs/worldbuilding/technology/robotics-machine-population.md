# NOXIA Robotics: from machines to machine populations

Status: worldbuilding + simulation design
Date: 2026-09-29

## Principle
Robots are not a rare special object class. As technological capability rises, they become part of ordinary civilization and eventually form persistent machine populations.

## Diffusion sequence
industry -> logistics -> agriculture -> construction -> maintenance -> cleaning -> food service -> care assistance -> household -> public infrastructure -> autonomous field work -> orbital/lunar/martian infrastructure

This sequence is a modeling scaffold, not a fixed historical prediction.

## Morphology rule
Do not equate robot with humanoid.
Generate morphology from task and environment: manipulators, crawlers, wheeled systems, legged systems, drones, maintenance units, textile handlers, excavation systems, inspection nodes, humanoid/general-purpose platforms and MiniNodes.

## Simulation entities
RobotType:
- morphology
- task_domains
- autonomy_level
- perception_capability
- manipulation_capability
- environment_tolerance
- energy_profile
- maintenance_profile
- communication_profile

RobotInstance:
- owner/operator
- location
- condition
- current_task
- energy_state
- maintenance_debt
- network_membership

MachinePopulation:
- settlement/body
- active_units
- role_distribution
- energy_demand
- maintenance_capacity
- replacement_rate
- human_to_machine_work_ratio

## Environment entropy
Tasks receive an environment-entropy value derived from object variability, deformability, contamination, occlusion, human co-presence and novelty. Automation success depends on robot capability relative to this entropy.

## Buildings/places
- robotics workshop
- service depot
- autonomous logistics hub
- municipal robot depot
- field-robot station
- swarm operations center
- MiniNode fabrication/repair shop
- lunar/martian dust-service bay
- orbital external-maintenance bay

These are workplaces and social/economic locations, not merely upgrade menus.

## Sauerland lineage
Regional automotive suppliers, metalworking, tooling, mechatronics and industrial automation evolve into a robotics cluster. Later generations produce distributed autonomous systems and MiniNodes. This gives the MiniNode technology a traceable industrial ancestry rather than a sudden invention.

## Space effect
On Moon/Mars/orbital installations, hazardous environments and expensive human labor increase the value of autonomous inspection, construction, maintenance and logistics. Machine populations can therefore become proportionally larger than in contemporary terrestrial settlements.

## Gameplay
Players can buy, lease, manufacture, repair, specialize and network robots. Settlements require energy and maintenance capacity for their machine population. Robot abundance changes labor markets, logistics throughput, construction speed, failure modes and infrastructure resilience.

## Lore rule
By the mature NOXIA era, the unusual condition in many developed settlements is not the presence of robots but their absence.

Research basis:
OTA research/robotics/robotics-diffusion-unstructured-work-environments-2026.md
KG entities/concepts/robotics-diffusion-machine-population.md
SSF learning/robotics/from-industrial-robot-to-machine-population.md
