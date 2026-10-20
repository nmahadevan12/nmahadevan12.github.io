---
title: RISC-V RV32I Emulator
channel: RISC-V emulator
summary: Work-in-progress C model of part of RV32I — not yet able to run compiled code or riscv-tests.
status: in-progress
areas: [architecture]
start: 2026-07
platform: RV32I · C, then SystemVerilog
featured: false
tags:
  - Computer architecture
  - C Programming
  - RISC-V CPU
highlights:
  - Fetch, decode, and execute for the RV32I ALU, load/store, branch, and jump instructions
  - 32 × 32-bit register file with x0 hardwired to zero, little-endian fetch, and 4 KB of byte-addressable memory
  - Immediate generation with sign extension for the I, S, B, U, and J formats
  - Hand-assembled test programs stepped in a C harness — PASS/FAIL on registers, PC, and memory after each case
repo: https://github.com/nmahadevan12/RISC-V
gallery:
  - src: ./cpu-datapath.png
    caption: One step of the C model — PC and 4 KB memory feed fetch, then decode and immediate generation, then execute against the register file (with x0 forced to 0).
---

## Overview

A C golden model for a planned SystemVerilog CPU. It decodes raw 32-bit instructions, generates immediates, updates the register file and PC, and does memory ops in a 4 KB address space.

**Honest scope:** this is early. There is no `LUI` / `AUIPC` yet, so it cannot run normal compiled binaries. Tests are hand-assembled words in a stepped harness — not the official `riscv-tests` suite — and there is no RTL or co-sim yet. The useful signal for this project will be passing `riscv-tests` and checking RTL against this model; until then it stays a roadmap piece, not a finished architecture demo.

Try the [instruction bitfield inspector](#bitfield-inspector) below — click bits, pick a preset, or type your own 32-bit word to see how an instruction is decoded.

## Implemented so far

- **R-type:** `ADD`, `SUB`, `XOR`, `OR`, `AND`, `SLL`, `SRL`, `SRA`, `SLT`, `SLTU`
- **I-type:** `ADDI`, `XORI`, `ORI`, `ANDI`, `SLLI`, `SRLI`, `SRAI`, `SLTI`, `SLTIU`
- **Loads and stores:** `LB`, `LH`, `LW`, `LBU`, `LHU`, `SB`, `SH`, `SW`
- **Control flow:** `BEQ`, `BNE`, `BLT`, `BGE`, `BLTU`, `BGEU`, `JAL`, `JALR`

A test harness writes hand-assembled instruction words into memory, steps the CPU, and checks the resulting registers, program counter, and memory bytes, printing PASS or FAIL for each case. The bitfield inspector below uses those same encodings.

## Roadmap

- [ ] `LUI` and `AUIPC`
- [ ] `ECALL` / `EBREAK` and basic CSR support
- [ ] Run the official `riscv-tests` suite and load programs from `.bin` / `.elf` files
- [ ] Single-cycle SystemVerilog datapath: ALU, decoder, register file, control unit, and PC unit
- [ ] 4 KB RAM module in SystemVerilog
- [ ] Co-simulate the RTL against this C model
- [ ] Synthesize and run on an FPGA
