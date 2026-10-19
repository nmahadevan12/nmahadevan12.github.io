---
title: Edge AI Wake-Word Engine
channel: Wake-word engine
summary: A bare-metal wake-word pipeline on an STM32L4 (Cortex-M4F) with PDM microphone capture, on-chip DSP, a 921.6 kbps binary UART link, and an MFCC classifier that detects “Hey STM32” with 92% test accuracy.
status: completed
areas: [embedded, signal]
start: 2026-08
end: 2026-08
platform: STM32L475VG (ARM Cortex-M4F) · B-L475E-IOT01A
featured: true
tags: [ARM Cortex-M4, Bare-metal C, DFSDM, DSP, UART, Python, scikit-learn, librosa]
highlights:
  - "Register-level C firmware with no HAL: RCC, GPIO, DFSDM, UART4, and SysTick configured directly, with a custom linker script and startup assembly"
  - Hardware PDM-to-PCM demodulation of the onboard MEMS microphone using DFSDM Sinc3 decimation (FOSR = 64)
  - DC-blocking IIR filter and EMA energy detector feeding an event state machine that isolates speech and rejects background noise
  - 921.6 kbps UART driver with SysTick interrupt-driven timestamping that streams framed audio to a host PC
  - MFCC-based wake-word classifier trained in Python, with 92% hold-out accuracy and all 25 test wake words detected
repo: https://github.com/nmahadevan12/Edge-AI-STM32
cover: ./board.png
coverAlt: STMicroelectronics B-L475E-IOT01A Discovery kit for IoT node (STM32L475)
coverCaption: B-L475E-IOT01A Discovery kit — STM32L475VG with onboard MEMS mics, sensors, and ST-LINK.
coverFit: contain
coverHotspots:
  - id: user
    label: USER button
    detail: Blue user button — useful for bring-up hooks and simple firmware tests.
    x: 7
    y: 24
  - id: reset
    label: RESET
    detail: Hardware reset for the STM32 during flashing and debug.
    x: 7
    y: 44
  - id: wifi
    label: Inventek eS-WiFi
    detail: 802.11 b/g/n Wi-Fi module (ISM43362). Not used by the wake-word pipeline.
    x: 21
    y: 29
  - id: usb-otg
    label: USB OTG
    detail: USB Full-Speed OTG Micro-AB connector.
    x: 40
    y: 5
  - id: stlink
    label: USB ST-LINK
    detail: On-board ST-LINK/V2-1 — flash, debug, and virtual COM for UART telemetry.
    x: 80
    y: 5
  - id: mics
    label: MEMS microphones
    detail: Dual MP34DT01 PDM mics. DFSDM turns them into 24-bit PCM for energy detection.
    x: 62
    y: 14
  - id: dig-headers
    label: Arduino digital headers
    detail: D0–D15 headers for shields and external I/O.
    x: 58
    y: 18
  - id: ble
    label: Bluetooth Low Energy
    detail: SPBTLE-RF module for BLE on the IoT node.
    x: 92
    y: 28
  - id: mcu
    label: STM32L475VG
    detail: Arm Cortex-M4F at 80 MHz — runs the bare-metal wake-word firmware with no HAL.
    x: 52
    y: 48
  - id: imu
    label: Motion sensors
    detail: LSM6DSL accel/gyro and nearby magnetometer for the Discovery kit’s sensing suite.
    x: 65
    y: 43
  - id: subghz
    label: Sub-GHz radio
    detail: SPSGRF-915 Sub-GHz transceiver module.
    x: 92
    y: 58
  - id: nfc
    label: NFC antenna
    detail: Printed NFC coil with M24SR dynamic tag.
    x: 10
    y: 72
  - id: tof
    label: Time-of-flight
    detail: VL53L0X laser ranging / gesture sensor.
    x: 78
    y: 72
  - id: pmod
    label: PMOD
    detail: 12-pin PMOD expansion connector.
    x: 30
    y: 87
  - id: power-hdr
    label: Power / analog headers
    detail: Arduino power rails (3V3, 5V, GND, VIN) and A0–A5 analog pins.
    x: 68
    y: 94
gallery:
  - src: ./example-captures.png
    caption: Captures streamed from the board. “hey_stm” utterances are on the top row, background noise and other speech on the bottom.
  - src: ./detect-flag.png
    caption: Live telemetry of PCM, energy, and the sound-detect flag around a trigger event.
  - src: ./energy-event.png
    caption: Sample and window energy during a loud acoustic event.
  - src: ./dfsdm-speech.png
    caption: DFSDM microphone samples over a longer capture with several speech bursts.
  - src: ./dfsdm-offset.png
    caption: Unfiltered microphone signal with an initial negative DC offset and its drift (to 0) over time.
  - src: ./confusion-matrix.png
    caption: Hold-out confusion matrix. Every wake word was detected, and 46 of 50 test clips were classified correctly.
---

## Overview

An end-to-end wake-word engine on the B-L475E-IOT01A discovery board (STM32L475VG, ARM Cortex-M4F at 80 MHz). Every peripheral is driven through direct register access, with no ST HAL, from microphone capture through on-chip filtering to a binary telemetry link. A host-side Python toolchain logs labeled captures, trains the classifier, and exports its weights back to C.

## Signal chain

1. **PDM to PCM.** The MP34DT01 MEMS microphone's 1-bit PDM stream is decimated in hardware by DFSDM filter 0 (Sinc3, FOSR = 64), producing 24-bit PCM samples.
2. **DC blocker.** A single-pole high-pass IIR removes drift and bias: `y[n] = x[n] − x[n−1] + R·y[n−1]` with `R = 0.995`.
3. **Energy envelope.** An exponential moving average tracks signal power: `E[n] = α·|y[n]| + (1 − α)·E[n−1]` with `α = 0.2`. Scrub a real capture in the [energy / detect scrubber](#energy-scrubber) below.
4. **Event state machine.** Energy above a threshold opens a 256-sample capture window. The capture is kept only if enough samples stay loud, and a quiet-abort path throws away mechanical bumps and clicks.

## Telemetry protocol

UART4 runs at 921,600 baud (8N2) so audio can stream without stalling the sampling loop. Two frame types share the link:

| Frame | Size | Contents |
| --- | --- | --- |
| Live telemetry | 13 bytes | Filtered sample (int32), energy (uint32), event flag (uint8), SysTick timestamp in ms (uint32) |
| Event dump | 1032 bytes | `0xFFFFFFFF` start marker, 256 × int32 samples, `0x00000000` end marker |

On the host, `serial_monitor.py` decodes frames and saves each dump as a labeled CSV, while `serial_plot.py` plots the waveform and energy envelope live. The [UART frame inspector](#uart-inspector) shows the live 13-byte frame for whatever sample the [energy / detect scrubber](#energy-scrubber) is on.

## Wake-word model

- **Dataset:** 200 captures recorded through the board itself: 100 “hey_stm” and 100 “other”.
- **Features:** an 82-dimensional vector per capture: 13 MFCCs plus their deltas and delta-deltas (mean and variance of each), along with RMS-energy and zero-crossing-rate statistics.
- **Training:** logistic regression with 3× train-time augmentation (time shift, gain scaling, Gaussian noise).
- **Export:** weights are written to a C header (`wake_word_model.h`), so scoring on the MCU reduces to an 82-term dot product plus a bias.

| Metric | Result |
| --- | --- |
| Hold-out test accuracy | 92.0% (50-clip stratified split) |
| 5-fold cross-validation | 93.5% ± 4.1% |
| Wake-word recall | 100% (25 of 25) |
