---
title: RISC-V RV32I Emulator
channel: RISC-V emulator
summary: An instruction-level RV32I emulator in C that serves as the golden reference model for a planned single-cycle SystemVerilog CPU.
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
  - Program correctness verified through register, PC, and memory state inspection in a C test harness
repo: https://github.com/nmahadevan12/RISC-V
---

## Overview

Before writing any RTL, I'm building a C model of the CPU that defines exactly what each instruction should do. The emulator decodes raw 32-bit instructions, generates immediates, updates the register file and program counter, and performs memory operations across a 4 KB unified address space. Once the SystemVerilog datapath exists, it will be checked against this model.

Try the [bitfield inspector](#bitfield-inspector) and [step debugger](#step-debugger) below — they use the same hand-assembled encodings as the C harness.

## Implemented so far

- **R-type:** `ADD`, `SUB`, `XOR`, `OR`, `AND`, `SLL`, `SRL`, `SRA`, `SLT`, `SLTU`
- **I-type:** `ADDI`, `XORI`, `ORI`, `ANDI`, `SLLI`, `SRLI`, `SRAI`, `SLTI`, `SLTIU`
- **Loads and stores:** `LB`, `LH`, `LW`, `LBU`, `LHU`, `SB`, `SH`, `SW`
- **Control flow:** `BEQ`, `BNE`, `BLT`, `BGE`, `BLTU`, `BGEU`, `JAL`, `JALR`

A test harness writes hand-assembled instruction words into memory, steps the CPU, and checks the resulting registers, program counter, and memory bytes, printing PASS or FAIL for each case. The interactive step debugger walks a few of those same sequences in the browser.

## Roadmap

- [ ] `LUI` and `AUIPC`
- [ ] `ECALL` / `EBREAK` and basic CSR support
- [ ] Run the official `riscv-tests` suite and load programs from `.bin` / `.elf` files
- [ ] Single-cycle SystemVerilog datapath: ALU, decoder, register file, control unit, and PC unit
- [ ] 4 KB RAM module in SystemVerilog
- [ ] Co-simulate the RTL against this C model
- [ ] Synthesize and run on an FPGA
