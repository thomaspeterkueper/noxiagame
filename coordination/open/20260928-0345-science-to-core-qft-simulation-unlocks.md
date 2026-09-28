---
id: 20260928-0345-science-to-core-qft-simulation-unlocks
status: open
source: science
target: core
priority: medium
---

# QFT-Simulationspfad in bestehendes Wissens-/Forschungssystem integrieren

## Ziel
Den von OTA gerouteten Quantum-Field-Simulation-Pfad in die vorhandene SSF→NOXIA-Progression integrieren. Kein paralleles Tech-/Learning-State-System.

## Bestehende Architektur
- `lib/knowledge/unlockRegistry.ts`: NOXIA besitzt Unlock-Identität, Voraussetzungen und Spielwirkung.
- SSF liefert Lernmodule/Unlock-Kandidaten.
- `player_unlocks` persistiert Spielerfreischaltungen.
- Build-Gates verwenden dieselben Unlocks.

## Benötigte Unlock-Kette
In sinnvoller Granularität, nicht zwingend 1:1 pro Unterrichtskapitel:
- quantum-mechanics-foundation
- quantum-many-body
- quantum-field-theory
- lattice-gauge-theory
- quantum-simulation
- nonequilibrium-qft
- quantum-field-simulator
- advanced-gauge-dynamics

Vor Implementierung vorhandene SSF/NOXIA-IDs prüfen und wiederverwenden. Keine Dubletten.

## Gameplay
Unlocks sollen Forschungsfähigkeiten freischalten, nicht automatisch Forschungsergebnisse schenken. Der Spieler/NPC muss Experimente durchführen:
Theorie -> Encoding -> Präparation -> Evolution -> Messung -> Inferenz -> Modellrevision.

Instrumentfähigkeit getrennt von Wissen modellieren: Wissen erlaubt Nutzung/Planung; reale Forschung benötigt geeignetes Gebäude, Hardware, Personal/Ressourcen und Experimentzustand.

## Quellen
OTA External Task EXT-NOXIA-OTA-20260928-QFT-SIMULATION-PATH.
