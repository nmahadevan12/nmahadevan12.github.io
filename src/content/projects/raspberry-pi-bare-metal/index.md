---
title: Bare-Metal Raspberry Pi 3B
channel: Bare-metal Pi
summary: "Booting a Raspberry Pi 3B with no operating system: a custom AArch64 boot stub and linker script, then GPIO driven through memory-mapped registers."
status: in-progress
areas: [embedded]
start: 2026-10
platform: BCM2837 (ARM Cortex-A53, AArch64)
draft: true
tags:
  - AArch64
  - Bare-metal
  - Raspberry Pi
highlights:
  - AArch64 boot stub that parks cores 1–3, sets up the stack, and zeroes .bss before calling main
  - Custom linker script producing a kernel8.img that the GPU firmware loads at 0x80000
  - GPIO 17 configured and toggled directly through the GPFSEL1, GPSET0, and GPCLR0 registers
---

## Overview

Starting from an SD card with only the Pi's GPU firmware files, this project brings up a Raspberry Pi 3B without Linux. The boot stub reads `MPIDR_EL1` so only core 0 continues, points the stack just below the `0x80000` load address, clears `.bss`, and jumps to C, where a blink loop drives GPIO 17 through the BCM2837's memory-mapped registers.
