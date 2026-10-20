---
title: Bare-Metal Raspberry Pi 3B
channel: Bare-metal Pi
summary: Bare-metal AArch64 firmware for a Raspberry Pi 3B — custom boot, then a GPIO blink with no OS.
status: in-progress
areas: [embedded]
start: 2026-10
platform: BCM2837 (ARM Cortex-A53, AArch64)
featured: true
metric: Personal · bare-metal AArch64 blink
tags:
  - AArch64
  - Bare-metal
  - Raspberry Pi
highlights:
  - AArch64 boot stub that parks cores 1–3, sets up the stack, and zeroes .bss before calling main
  - Custom linker script producing a kernel8.img that the GPU firmware loads at 0x80000
  - GPIO 17 configured and toggled directly through the GPFSEL1, GPSET0, and GPCLR0 registers
repo: https://github.com/nmahadevan12/raspberry-pi-3b-bare-metal
cover: ./rpi3b-cover.png
coverAlt: Raspberry Pi 3 Model B single-board computer
coverCaption: Raspberry Pi 3 Model B — the BCM2837 / Cortex-A53 board this firmware targets. Photo via Wikimedia Commons (CC BY-SA 4.0).
coverFit: contain
gallery:
  - src: ./oscope-delay1-stopped.jpg
    caption: Oscilloscope waveform (stopped) with delay = 1 — Freq 1.0526 MHz, Pk-Pk 2.05 V.
  - src: ./oscope-delay0-stopped.jpg
    caption: Oscilloscope waveform (stopped) with delay = 0 — Freq 7.02 MHz, Pk-Pk 1.89 V.
  - src: ./memory-map.png
    caption: Load map from linker.ld — kernel8.img at 0x80000, stack below _start, and the BCM2837 GPIO window used by main.c.
---

## Overview

Starting from an SD card with only the Pi's GPU firmware files, this project brings up a Raspberry Pi 3B without Linux. The boot stub reads `MPIDR_EL1` so only core 0 continues, points the stack just below the `0x80000` load address, clears `.bss`, and jumps to C, where a blink loop drives GPIO 17 through the BCM2837's memory-mapped registers.

Try the [boot stub walkthrough](#boot-stub) and [GPIO 17 blink](#gpio-blink) below — both follow the real `boot.S` and `main.c` from the repo.

## Boot path

1. **GPU firmware** on the FAT32 card (`bootcode.bin`, `start.elf`, `fixup.dat`) plus `config.txt` with `arm_64bit=1`.
2. **`kernel8.img`** linked at `0x80000` and copied to the card with `make flash`.
3. **Core 0** alone runs `_start` → stack → BSS clear → `main`; cores 1–3 sit in `WFE`.

## GPIO blink

`main` writes `GPFSEL1 = (1 << 21)` so pin 17's 3-bit field is `001` (output), then alternates `GPSET0` and `GPCLR0` with bit 17 set. With `delay = 1` the pin toggles near 1 MHz; with `delay = 0` it runs closer to 7 MHz (scope captures in the gallery). No HAL, no libc — just volatile MMIO at `0x3F200000`.
