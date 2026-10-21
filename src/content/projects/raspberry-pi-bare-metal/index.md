---
title: Bare-Metal Raspberry Pi 3B
channel: Bare-metal Pi
summary: Bare-metal AArch64 firmware for a Raspberry Pi 3B — custom boot, then AUX mini UART TX on GPIO 14 with no OS.
status: in-progress
areas: [embedded]
start: 2026-10
platform: BCM2837 (ARM Cortex-A53, AArch64)
featured: true
metric: Personal · mini UART @ 115200
tags:
  - AArch64
  - Bare-metal
  - Raspberry Pi
  - UART
highlights:
  - AArch64 boot stub that parks cores 1–3, sets up the stack, and zeroes .bss before calling main
  - Custom linker script producing a kernel8.img that the GPU firmware loads at 0x80000
  - AUX mini UART at 115200 8N1 on GPIO 14 (TXD1 / Alt5), driven through BCM2837 MMIO — no HAL, no libc
repo: https://github.com/nmahadevan12/raspberry-pi-3b-bare-metal
cover: ./rpi3b-cover.png
coverAlt: Raspberry Pi 3 Model B single-board computer
coverCaption: Raspberry Pi 3 Model B — the BCM2837 / Cortex-A53 board this firmware targets. Photo via Wikimedia Commons (CC BY-SA 4.0).
coverFit: contain
gallery:
  - src: ./memory-map.png
    caption: Load map from the current kernel8.map — 485-byte image at 0x80000 (boot stub, miniUartSetup / Transmit / Pointer, main, rodata string) and the AUX mini UART MMIO window at 0x3F215000.
---

## Overview

Starting from an SD card with only the Pi's GPU firmware files, this project brings up a Raspberry Pi 3B without Linux. The boot stub reads `MPIDR_EL1` so only core 0 continues, points the stack just below the `0x80000` load address, clears `.bss`, and jumps to C. `main` then enables the AUX mini UART, locks baud for 115200 at a 250 MHz core clock, puts GPIO 14 in Alt5 (TXD1), and loops transmitting a string over the wire.

Try the [boot stub walkthrough](#boot-stub) and [mini UART TX](#mini-uart) below — both follow the real `boot.S` and `main.c` from the repo.

## Boot path

1. **GPU firmware** on the FAT32 card (`bootcode.bin`, `start.elf`, `fixup.dat`) plus `config.txt` with `arm_64bit=1`, `enable_uart=1`, and `core_freq=250`.
2. **`kernel8.img`** linked at `0x80000` and copied to the card with `make flash`.
3. **Core 0** alone runs `_start` → stack → BSS clear → `main`; cores 1–3 sit in `WFE`.

## Mini UART

`miniUartSetup` enables the AUX mini UART, disables TX while baud and line control are programmed, sets GPIO 14's GPFSEL1 field to Alt5 (TXD1), then enables transmit. Baud is locked with `AUX_MU_BAUD = 270` and `core_freq=250` in `config.txt`:

`250 MHz / (8 × 271) ≈ 115,313` — about 0.1% off 115200.

`miniUartPointer` walks a `char *` until NUL and calls `miniUartTransmit` for each byte, waiting on `AUX_MU_LSR` bit 5 (TX empty) before writing `AUX_MU_IO`. `main` passes a local string into that helper and loops with a software delay. A host serial monitor (`make monitor`) reads the line at 115200 8N1 — Pi GPIO14 → adapter RX, shared GND.
