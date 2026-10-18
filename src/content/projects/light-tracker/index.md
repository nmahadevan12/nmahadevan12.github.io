---
title: 2-Axis Light Tracker
channel: 2-axis light tracker
summary: A battery-powered dual-axis solar tracker in bare-metal C on an ATmega328P, with MOSFET H-bridge motor drive, Hall-effect limit protection, a fixed-point Kalman filter, and a custom four-layer KiCad PCB.
status: completed
areas: [embedded, hardware]
start: 2026-06
end: 2026-07
course: ELEE 4230
platform: ATmega328P (AVR)
featured: true
tags: [C, ATmega328P, Kalman filter, H-bridge, UART, KiCad, PCB design, Python]
highlights:
  - Bare-metal C firmware on an ATmega328P driving the base and panel DC motors through MOSFET H-bridges
  - LDR array with Hall-effect and potentiometer feedback for tilt-limit protection, plus an auto-calibration sweep at startup
  - Fixed-point Kalman filter on the ADC channels that cuts peak noise from 3 LSBs to under 1 LSB
  - Register-level UART driver (9.216 MHz crystal) streaming live telemetry to a Python logger
  - Four-layer PCB designed in KiCad around the ATmega328P
repo: https://github.com/nmahadevan12/Light-Tracker
video: https://www.youtube.com/shorts/PQEl34fqnAk
cover: ./pcb-3d.png
coverAlt: KiCad 3D render of the light tracker's four-layer control board
gallery:
  - src: ./final-build.jpg
    caption: The finished tracker. The base rotates on one axis while the panel tilts on the other.
  - src: ./cp-structure.png
    caption: Mechanical frame on a turntable — metal U-base, panel axis, and breadboard housing (from CP5).
  - src: ./cp-system-overview.png
    caption: Hardware photo and system block diagram from the final report (CP6).
  - src: ./cp-signal-chain.png
    caption: Analog signal chain from dual LDR divider through buffer, scaling, and the 1.1 V ADC (CP3).
  - src: ./cp-ldr-transfer.png
    caption: Measured LDR ADC vs light angle with linear fit ADC = −4.59·Angle + 903.40 (CP3).
  - src: ./cp-hall-waveform.png
    caption: Hall-effect limit switch output captured on a logic analyzer while sweeping a magnet (CP2).
  - src: ./cp-cap-touch.png
    caption: Homemade capacitive touch sensor used to gate UART logging (CP4).
  - src: ./cp-telemetry.png
    caption: Host telemetry dashboard showing filtered ADC channels, motor state, and Hall limits (CP5).
  - src: ./cp-go-beyond.png
    caption: Battery-ratiometric “go beyond” base-motor decision flowchart (CP6).
  - src: ./pcb-layout.png
    caption: Four-layer board layout in KiCad, with the H-bridge MOSFETs along the right edge.
  - src: ./schematic.png
    caption: "Full schematic: ATmega328P, MOSFET H-bridges, op-amp sensor conditioning, and connectors."
---

## Overview

A closed-loop tracker that keeps a panel pointed at the brightest light source on two axes. The firmware is bare-metal AVR C and handles everything on one microcontroller: sensing, filtering, motor control, safety limits, and telemetry.

## How it works

- **Sensing.** Paired LDRs measure the light difference on each axis. Potentiometers report each axis's position, and a resistor divider monitors the battery voltage.
- **Filtering.** A fixed-point Kalman filter smooths the raw ADC readings from the LDRs, potentiometers, and battery monitor, cutting peak noise from 3 LSBs to under 1 LSB.
- **Control.** When an LDR difference crosses its threshold, the firmware drives the base or panel motor toward the light through a MOSFET H-bridge.
- **Calibration and safety.** At power-up the tracker sweeps each axis into its Hall-effect limit sensors to learn the potentiometer's minimum and maximum ADC values. Latched software states then stop the motors before they over-rotate.
- **Telemetry.** A register-level UART driver, clocked from a 9.216 MHz crystal so standard baud rates divide exactly, streams system status to Python logging scripts on a host computer.

## Hardware

The control board is a four-layer KiCad design built around the ATmega328P, with MOSFET H-bridges for both motors, op-amp conditioning on the sensor inputs, an ISP header for programming, and test points on the key nets for bring-up. The schematic, layout, and a photo of the finished build are in the gallery below.

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
