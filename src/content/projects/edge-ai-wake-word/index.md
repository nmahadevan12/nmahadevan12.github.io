---
title: Edge AI Wake-Word Engine
channel: Wake-word engine
summary: Bare-metal STM32 mic capture and energy detect, with a host-trained MFCC classifier whose weights export to C for an on-chip score.
status: completed
statusLabel: Host-side complete, on-device port pending
areas: [embedded, signal]
start: 2026-08
end: 2026-08
platform: STM32L475VG (ARM Cortex-M4F) · B-L475E-IOT01A
featured: true
metric: 92% hold-out · 16% false-accept
tags: [ARM Cortex-M4, Bare-metal C, DFSDM, DSP, UART, Python]
highlights:
  - "Register-level C firmware with no HAL: RCC, GPIO, DFSDM, UART4, and SysTick configured directly, with a custom linker script and startup assembly"
  - Hardware PDM-to-PCM demodulation of the onboard MEMS microphone using DFSDM Sinc3 decimation (FOSR = 64)
  - DC-blocking IIR filter and EMA energy detector feeding an event state machine that isolates speech and rejects background noise
  - 921.6 kbps UART driver with SysTick interrupt-driven timestamping that streams framed audio to a host PC
  - "Host-trained MFCC logistic model — 92% hold-out accuracy, 100% wake-word recall (25/25), 16% false-accept rate on 25 negatives (precision ~86%)"
repo: https://github.com/nmahadevan12/Edge-AI-STM32
cover: ./board.png
coverAlt: STMicroelectronics B-L475E-IOT01A Discovery kit for IoT node (STM32L475)
coverCaption: B-L475E-IOT01A — markers cover the wake-word path (mics, MCU, ST-LINK), not the unused radios.
coverFit: contain
coverHotspots:
  - id: mics
    label: MEMS microphones
    detail: Dual MP34DT01 PDM mics — DFSDM turns the stream into 24-bit PCM for the energy detector.
    x: 62
    y: 14
  - id: mcu
    label: STM32L475VG
    detail: Arm Cortex-M4F at 80 MHz — runs bare-metal capture, filtering, and the exported linear score (MFCC features still from the host today).
    x: 52
    y: 48
  - id: stlink
    label: USB ST-LINK
    detail: On-board ST-LINK/V2-1 — flash, debug, and virtual COM for the 921.6 kbps UART telemetry.
    x: 80
    y: 5
  - id: reset
    label: RESET
    detail: Hardware reset for bring-up and flashing.
    x: 7
    y: 44
gallery:
  - src: ./example-captures.png
    caption: Captures streamed from the board. “hey_stm” utterances are on the top row, background noise and other speech on the bottom.
  - src: ./detect-flag.png
    caption: Live telemetry of PCM, energy, and the sound-detect flag around a trigger event.
  - src: ./dfsdm-speech.png
    caption: DFSDM microphone samples over a longer capture with several speech bursts.
  - src: ./confusion-matrix.png
    caption: Hold-out confusion matrix — 25/25 wake words recalled; all 4 errors are false accepts on the 25 negatives (16% FAR).
---

## Overview

A wake-word pipeline on the B-L475E-IOT01A (STM32L475VG, ARM Cortex-M4F at 80 MHz). Firmware is register-level C with no ST HAL: microphone capture, on-chip filtering, event windows, and a binary UART link. A host Python toolchain logs labeled captures, extracts MFCCs with librosa, trains a logistic classifier, and exports weights to a C header.

**What runs on the chip today:** PDM→PCM (DFSDM), DC block, energy envelope, event state machine, UART framing, and an 82-term dot-product score against exported weights. **What still runs on the host:** MFCC / delta feature extraction (librosa) used to build the training set and to evaluate the hold-out set. The exported score assumes an 82-D feature vector; porting MFCC generation to the M4 (with latency, RAM, and flash numbers) is the next step before calling this a fully on-device detector.

## Signal chain

1. **PDM to PCM.** The MP34DT01 MEMS microphone's 1-bit PDM stream is decimated in hardware by DFSDM filter 0 (Sinc3, FOSR = 64), producing 24-bit PCM samples. FOSR 64 was the board/app-note starting point that kept the output rate manageable for the UART stream without obvious aliasing on speech; I did not sweep alternate FOSR values.
2. **DC blocker.** A single-pole high-pass IIR removes drift and bias: `y[n] = x[n] − x[n−1] + R·y[n−1]` with `R = 0.995`. That pole sits close to DC so slow bias dies without eating much of the speech band; lower `R` cut too much energy from quiet utterances in early captures.
3. **Energy envelope.** An exponential moving average tracks signal power: `E[n] = α·|y[n]| + (1 − α)·E[n−1]` with `α = 0.2`. Smaller `α` lagged real speech onsets; larger `α` made mechanical bumps look like speech. Scrub a real capture in the [energy / detect scrubber](#energy-scrubber) below.
4. **Event state machine.** Energy above `ENERGY_LOUD` (**1500**) opens a 256-sample capture window. The capture is kept only if `loud_count >= DEBOUNCE_VAL` (**20**). A quiet-abort path throws away mechanical bumps and clicks. Constants live in `src/main.c`.

## Telemetry protocol

UART4 runs at 921,600 baud (8N2) so audio can stream without stalling the sampling loop. Two frame types share the link:

| Frame | Size | Contents |
| --- | --- | --- |
| Live telemetry | 13 bytes | Filtered sample (int32), energy (uint32), event flag (uint8), SysTick timestamp in ms (uint32) |
| Event dump | 1032 bytes | `0xFFFFFFFF` start marker, 256 × int32 samples, `0x00000000` end marker |

Markers are in-band and can collide with real samples (for example a sign-extended −1 or a run of zeros). The host parser does not hunt for markers in the PCM; it reads fixed-length frames after the live stream signals a dump, so a colliding sample cannot shift framing.

On the host, `serial_monitor.py` decodes frames and saves each dump as a labeled CSV, while `serial_plot.py` plots the waveform and energy envelope live. The [UART frame inspector](#uart-inspector) shows the live 13-byte frame for whatever sample the [energy / detect scrubber](#energy-scrubber) is on.

## Wake-word model

- **Dataset:** 200 captures recorded through the board itself: 100 “hey_stm” and 100 “other” (non-wake speech and background). Speaker count was not tracked; ambient false-accepts per hour were not measured.
- **Features (host):** an 82-dimensional vector per capture: 13 MFCCs plus their deltas and delta-deltas (mean and variance of each), along with RMS-energy and zero-crossing-rate statistics, via librosa.
- **Training:** logistic regression with 3× train-time augmentation (time shift, gain scaling, Gaussian noise).
- **On-device score:** weights land in `wake_word_model.h` as an 82-term dot product plus bias. That score is what the firmware can run; it does not yet include on-chip MFCC computation.

| Metric | Result |
| --- | --- |
| Hold-out test accuracy | 92.0% (50-clip stratified split) |
| 5-fold cross-validation | 93.5% ± 4.1% |
| Wake-word recall | 100% (25 of 25) |
| False accepts on negatives | 4 of 25 (16% FAR) |
| Precision | ≈ 86% (25 / 29 predicted wake) |

All four hold-out errors were false accepts. Accuracy alone overstates how safe the detector is for a wake word; recall is strong, precision and FAR are the numbers that matter for always-listening use, and they are not yet tuned against ambient audio hours.
