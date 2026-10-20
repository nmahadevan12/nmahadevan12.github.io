---
title: RISC-V RV32I Emulator
channel: RISC-V emulator
summary: A C emulator of the RV32I instruction set — the golden model for a planned SystemVerilog CPU.
status: in-progress
areas: [architecture]
start: 2026-07
platform: RV32I · C, then SystemVerilog
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

Before writing any RTL, I'm building a C model of the CPU that defines exactly what each instruction should do. The emulator decodes raw 32-bit instructions, generates immediates, updates the register file and program counter, and performs memory operations across a 4 KB unified address space. Once the SystemVerilog datapath exists, it will be checked against this model.

**So far:** the R / I / load-store / branch / jump subset below runs through a stepped test harness (each case prints PASS or FAIL). `LUI` / `AUIPC`, CSRs, and the official `riscv-tests` suite are next — then a single-cycle SystemVerilog datapath co-simulated against this golden model.

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
