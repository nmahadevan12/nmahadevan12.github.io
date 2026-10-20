---
title: 2-Axis Light Tracker
channel: 2-axis light tracker
summary: Solo ELEE 4230 project — a battery-powered dual-axis light tracker on an ATmega328P driving DC motors through H-bridges.
status: completed
areas: [embedded, hardware]
start: 2026-06
end: 2026-07
course: ELEE 4230
platform: ATmega328P (AVR)
featured: true
tags: [C, ATmega328P, Kalman filter, H-bridge, UART, KiCad, PCB design, Python]
highlights:
  - Solo build — bare-metal C on an ATmega328P driving base and panel DC motors through MOSFET H-bridges
  - LDR array with Hall-effect and potentiometer feedback for tilt-limit protection, plus an auto-calibration sweep at startup
  - Fixed-point Kalman filter on the ADC channels that cuts peak noise from 3 LSBs to under 1 LSB
  - Register-level UART driver (9.216 MHz crystal) streaming live telemetry to a Python logger
  - Four-layer PCB designed in KiCad around the ATmega328P
repo: https://github.com/nmahadevan12/Light-Tracker
video: https://www.youtube.com/shorts/PQEl34fqnAk
cover: ./build.png
coverAlt: Bench prototype of the dual-axis light tracker with LDR shrouds, metal panel, and DC motor drive
model3d: /models/light-tracker.glb
model3dAlt: Interactive 3D model of the light tracker control board from KiCad
model3dCaption: Four-layer control board exported from the KiCad PCB. Click a part or a copper trace to see what it does.
model3dParts: /models/light-tracker-parts.json
model3dNets: /models/light-tracker-nets.json
gallery:
  - src: ./build.png
    caption: Bench prototype — dual-axis frame, LDR shroud array, and DC-motor-driven panel on a rotating base.
  - src: ./system-architecture.png
    caption: System architecture from light and battery rail through sensing, the ATmega328P, H-bridges, and UART telemetry.
  - src: ./signal-chain.png
    caption: Analog path — LDR pairs, VBAT, and pot through unity-gain buffers and dividers into the 1.1 V ADC, with Hall limits and capacitive UART gating.
  - src: ./firmware-flow.png
    caption: Main firmware loop — Kalman-filtered ADCs, ratiometric light thresholds, base/panel motor drive, and Hall/pot tilt limits.
  - src: ./hall-mount.jpg
    caption: Hall-effect sensors on the aluminum bracket and the magnet taped to the panel for tilt end-stops.
  - src: ./hall-overshoot.png
    caption: Logic-analyzer capture of Hall-effect boundary overshoot while the panel sweeps past a limit.
  - src: ./hall-window.png
    caption: Hall I/O pulse with a measured ~15 ms low window used for limit timing.
  - src: ./pcb-design.png
    caption: KiCad layout, full schematic, and 3D board render — ATmega328P, op-amp conditioning, and MOSFET H-bridges.
  - src: ./pot-buffer.png
    caption: Potentiometer signal conditioning — OP495 unity-gain buffer from POT V into POT ADC.
  - src: ./cap-touch.png
    caption: Homemade capacitive touch pad and 1 MΩ sense schematic used to gate UART logging.
  - src: ./touch-log.png
    caption: Touch charge-time counter idle (~29) versus touched (rising into the hundreds).
---

## Overview

Solo ELEE 4230 project. A closed-loop tracker that keeps a panel pointed at the brightest light source on two axes, with **DC motors** (not servos) on both axes through MOSFET H-bridges. The firmware is bare-metal AVR C and handles everything on one microcontroller: sensing, filtering, motor control, safety limits, and telemetry.

## Results

- Kalman on the ADC path cut peak noise from **~3 LSBs to under 1 LSB** on the LDR / pot / battery channels.
- Hall end-stops latched cleanly in bring-up — analyzer captures show ~**15 ms** low windows used for limit timing (see gallery).
- Four-layer KiCad board: ATmega328P, op-amp conditioning, MOSFET H-bridges; interactive 3D model above.

## How it works

- **Sensing.** Paired LDRs measure the light difference on each axis. Potentiometers report each axis's position, and a resistor divider monitors the battery voltage.
- **Filtering.** A fixed-point Kalman filter smooths the raw ADC readings from the LDRs, potentiometers, and battery monitor, cutting peak noise from 3 LSBs to under 1 LSB.
- **Control.** When an LDR difference crosses its threshold, the firmware drives the base or panel motor toward the light through a MOSFET H-bridge.
- **Calibration and safety.** At power-up the tracker sweeps each axis into its Hall-effect limit sensors to learn the potentiometer's minimum and maximum ADC values. Latched software states then stop the motors before they over-rotate.
- **Telemetry.** A register-level UART driver, clocked from a 9.216 MHz crystal so standard baud rates divide exactly, streams system status to Python logging scripts on a host computer.

## Hardware

The control board is a four-layer KiCad design built around the ATmega328P, with MOSFET H-bridges for both motors, op-amp conditioning on the sensor inputs, an ISP header for programming, and test points on the key nets for bring-up. Explore the interactive board above, or the layout and schematic in the gallery.

See it follow a light source in the [demo video](https://www.youtube.com/shorts/PQEl34fqnAk).

## Checkpoint reports

Weekly write-ups from ELEE 4230 (Sensors and Transducers), plus the final course report:

| Checkpoint | PDF |
| --- | --- |
| CP1 — Project idea, BOM, sensor selection | [Download](/projects/light-tracker/cp1.pdf) |
| CP2 — Hall-effect sensor characterization | [Download](/projects/light-tracker/cp2.pdf) |
| CP3 — LDR sensing and signal chain | [Download](/projects/light-tracker/cp3.pdf) |
| CP4 — Capacitive touch input | [Download](/projects/light-tracker/cp4.pdf) |
| CP5 — Enclosure, telemetry, demo | [Download](/projects/light-tracker/cp5.pdf) |
| CP6 — Final report | [Download](/projects/light-tracker/cp6.pdf) |
