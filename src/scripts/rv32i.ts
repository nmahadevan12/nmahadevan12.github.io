/** Browser port of the RV32I C emulator (Documents/RISCV32I + RISC-V-CPU). */

export const MEMORY_SIZE = 4096;

export type Format = 'R' | 'I' | 'S' | 'B' | 'U' | 'J' | '?';

export interface Decoded {
  instr: number;
  opcode: number;
  funct3: number;
  funct7: number;
  rd: number;
  rs1: number;
  rs2: number;
  imm: number;
  format: Format;
  mnemonic: string;
  fields: { name: string; lo: number; hi: number; value: number }[];
}

export interface Cpu {
  regs: Uint32Array;
  pc: number;
  memory: Uint8Array;
}

export interface StepResult {
  decoded: Decoded;
  wroteRegs: number[];
  memWrites: { addr: number; value: number }[];
  branched: boolean;
}

const ABI = [
  'zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2',
  's0', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5',
  'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7',
  's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6',
];

export function regName(i: number): string {
  return `x${i}`;
}

export function regAbi(i: number): string {
  return ABI[i] ?? `x${i}`;
}

export function hex32(n: number): string {
  return `0x${(n >>> 0).toString(16).padStart(8, '0').toUpperCase()}`;
}

export function createCpu(): Cpu {
  return { regs: new Uint32Array(32), pc: 0, memory: new Uint8Array(MEMORY_SIZE) };
}

export function storeWord(cpu: Cpu, addr: number, word: number): void {
  const a = addr % MEMORY_SIZE;
  const w = word >>> 0;
  cpu.memory[a] = w & 0xff;
  cpu.memory[(a + 1) % MEMORY_SIZE] = (w >>> 8) & 0xff;
  cpu.memory[(a + 2) % MEMORY_SIZE] = (w >>> 16) & 0xff;
  cpu.memory[(a + 3) % MEMORY_SIZE] = (w >>> 24) & 0xff;
}

export function loadWord(cpu: Cpu, addr: number): number {
  const a = addr % MEMORY_SIZE;
  return (
    cpu.memory[a] |
    (cpu.memory[(a + 1) % MEMORY_SIZE] << 8) |
    (cpu.memory[(a + 2) % MEMORY_SIZE] << 16) |
    (cpu.memory[(a + 3) % MEMORY_SIZE] << 24)
  ) >>> 0;
}

function sext(value: number, bits: number): number {
  const shift = 32 - bits;
  return (value << shift) >> shift;
}

function formatOf(opcode: number): Format {
  switch (opcode) {
    case 0x33:
      return 'R';
    case 0x13:
    case 0x03:
    case 0x67:
      return 'I';
    case 0x23:
      return 'S';
    case 0x63:
      return 'B';
    case 0x37:
    case 0x17:
      return 'U';
    case 0x6f:
      return 'J';
    default:
      return '?';
  }
}

/** Immediate extraction — same shapes as step_cpu in main.c. */
function immOf(instr: number, opcode: number): number {
  switch (opcode) {
    case 0x13:
    case 0x03:
    case 0x67:
      return sext((instr >>> 20) & 0xfff, 12);
    case 0x23: {
      const imm =
        ((instr >>> 7) & 0x1f) | (((instr >>> 25) & 0x7f) << 5);
      return sext(imm, 12);
    }
    case 0x63: {
      const imm =
        (((instr >>> 8) & 0xf) << 1) |
        (((instr >>> 25) & 0x3f) << 5) |
        (((instr >>> 7) & 1) << 11) |
        (((instr >>> 31) & 1) << 12);
      return sext(imm, 13);
    }
    case 0x37:
    case 0x17:
      return instr & 0xfffff000;
    case 0x6f: {
      const imm =
        (((instr >>> 21) & 0x3ff) << 1) |
        (((instr >>> 20) & 1) << 11) |
        (((instr >>> 12) & 0xff) << 12) |
        (((instr >>> 31) & 1) << 20);
      return sext(imm, 21);
    }
    default:
      return 0;
  }
}

function mnemonicOf(
  opcode: number,
  funct3: number,
  funct7: number,
  rd: number,
  rs1: number,
  rs2: number,
  imm: number,
): string {
  const x = regName;
  switch (opcode) {
    case 0x33: {
      const map: Record<number, Record<number, string>> = {
        0: { 0: 'add', 0x20: 'sub' },
        1: { 0: 'sll' },
        2: { 0: 'slt' },
        3: { 0: 'sltu' },
        4: { 0: 'xor' },
        5: { 0: 'srl', 0x20: 'sra' },
        6: { 0: 'or' },
        7: { 0: 'and' },
      };
      const name = map[funct3]?.[funct7] ?? `r?`;
      return `${name} ${x(rd)}, ${x(rs1)}, ${x(rs2)}`;
    }
    case 0x13: {
      if (funct3 === 1) return `slli ${x(rd)}, ${x(rs1)}, ${imm & 0x1f}`;
      if (funct3 === 5) {
        const name = funct7 === 0x20 ? 'srai' : 'srli';
        return `${name} ${x(rd)}, ${x(rs1)}, ${imm & 0x1f}`;
      }
      const names = ['addi', '', 'slti', 'sltiu', 'xori', '', 'ori', 'andi'];
      return `${names[funct3] ?? 'i?'} ${x(rd)}, ${x(rs1)}, ${imm}`;
    }
    case 0x03: {
      const names = ['lb', 'lh', 'lw', '', 'lbu', 'lhu'];
      return `${names[funct3] ?? 'load?'} ${x(rd)}, ${imm}(${x(rs1)})`;
    }
    case 0x23: {
      const names = ['sb', 'sh', 'sw'];
      return `${names[funct3] ?? 'store?'} ${x(rs2)}, ${imm}(${x(rs1)})`;
    }
    case 0x63: {
      const names = ['beq', 'bne', '', '', 'blt', 'bge', 'bltu', 'bgeu'];
      return `${names[funct3] ?? 'b?'} ${x(rs1)}, ${x(rs2)}, ${imm}`;
    }
    case 0x6f:
      return `jal ${x(rd)}, ${imm}`;
    case 0x67:
      return `jalr ${x(rd)}, ${imm}(${x(rs1)})`;
    case 0x37:
      return `lui ${x(rd)}, ${hex32(imm >>> 12)}`;
    case 0x17:
      return `auipc ${x(rd)}, ${hex32(imm >>> 12)}`;
    default:
      return `unknown`;
  }
}

function fieldsFor(format: Format, d: Omit<Decoded, 'fields' | 'mnemonic'>): Decoded['fields'] {
  switch (format) {
    case 'R':
      return [
        { name: 'funct7', lo: 25, hi: 31, value: d.funct7 },
        { name: 'rs2', lo: 20, hi: 24, value: d.rs2 },
        { name: 'rs1', lo: 15, hi: 19, value: d.rs1 },
        { name: 'funct3', lo: 12, hi: 14, value: d.funct3 },
        { name: 'rd', lo: 7, hi: 11, value: d.rd },
        { name: 'opcode', lo: 0, hi: 6, value: d.opcode },
      ];
    case 'I':
      return [
        { name: 'imm[11:0]', lo: 20, hi: 31, value: (d.instr >>> 20) & 0xfff },
        { name: 'rs1', lo: 15, hi: 19, value: d.rs1 },
        { name: 'funct3', lo: 12, hi: 14, value: d.funct3 },
        { name: 'rd', lo: 7, hi: 11, value: d.rd },
        { name: 'opcode', lo: 0, hi: 6, value: d.opcode },
      ];
    case 'S':
      return [
        { name: 'imm[11:5]', lo: 25, hi: 31, value: (d.instr >>> 25) & 0x7f },
        { name: 'rs2', lo: 20, hi: 24, value: d.rs2 },
        { name: 'rs1', lo: 15, hi: 19, value: d.rs1 },
        { name: 'funct3', lo: 12, hi: 14, value: d.funct3 },
        { name: 'imm[4:0]', lo: 7, hi: 11, value: (d.instr >>> 7) & 0x1f },
        { name: 'opcode', lo: 0, hi: 6, value: d.opcode },
      ];
    case 'B':
      return [
        { name: 'imm[12]', lo: 31, hi: 31, value: (d.instr >>> 31) & 1 },
        { name: 'imm[10:5]', lo: 25, hi: 30, value: (d.instr >>> 25) & 0x3f },
        { name: 'rs2', lo: 20, hi: 24, value: d.rs2 },
        { name: 'rs1', lo: 15, hi: 19, value: d.rs1 },
        { name: 'funct3', lo: 12, hi: 14, value: d.funct3 },
        { name: 'imm[4:1]', lo: 8, hi: 11, value: (d.instr >>> 8) & 0xf },
        { name: 'imm[11]', lo: 7, hi: 7, value: (d.instr >>> 7) & 1 },
        { name: 'opcode', lo: 0, hi: 6, value: d.opcode },
      ];
    case 'U':
      return [
        { name: 'imm[31:12]', lo: 12, hi: 31, value: (d.instr >>> 12) & 0xfffff },
        { name: 'rd', lo: 7, hi: 11, value: d.rd },
        { name: 'opcode', lo: 0, hi: 6, value: d.opcode },
      ];
    case 'J':
      return [
        { name: 'imm[20]', lo: 31, hi: 31, value: (d.instr >>> 31) & 1 },
        { name: 'imm[10:1]', lo: 21, hi: 30, value: (d.instr >>> 21) & 0x3ff },
        { name: 'imm[11]', lo: 20, hi: 20, value: (d.instr >>> 20) & 1 },
        { name: 'imm[19:12]', lo: 12, hi: 19, value: (d.instr >>> 12) & 0xff },
        { name: 'rd', lo: 7, hi: 11, value: d.rd },
        { name: 'opcode', lo: 0, hi: 6, value: d.opcode },
      ];
    default:
      return [{ name: 'instr', lo: 0, hi: 31, value: d.instr >>> 0 }];
  }
}

export function decode(instr: number): Decoded {
  const word = instr >>> 0;
  const opcode = word & 0x7f;
  const funct3 = (word >>> 12) & 0x07;
  const funct7 = (word >>> 25) & 0x7f;
  const rd = (word >>> 7) & 0x1f;
  const rs1 = (word >>> 15) & 0x1f;
  const rs2 = (word >>> 20) & 0x1f;
  const imm = immOf(word, opcode);
  const format = formatOf(opcode);
  const base = { instr: word, opcode, funct3, funct7, rd, rs1, rs2, imm, format };
  return {
    ...base,
    mnemonic: mnemonicOf(opcode, funct3, funct7, rd, rs1, rs2, imm),
    fields: fieldsFor(format, base),
  };
}

/**
 * One instruction step. PC semantics match the harness expectations
 * (taken branch / JAL land on target; fall-through advances by 4) —
 * the cleaned-up model noted in tests.c, not the duplicate +4 still in main.c.
 */
export function step(cpu: Cpu): StepResult {
  const fetchPc = cpu.pc % MEMORY_SIZE;
  const instr = loadWord(cpu, fetchPc);
  const d = decode(instr);
  const wroteRegs: number[] = [];
  const memWrites: { addr: number; value: number }[] = [];
  let branched = false;
  let nextPc = (fetchPc + 4) % MEMORY_SIZE;

  const writeReg = (rd: number, value: number) => {
    if (rd === 0) return;
    cpu.regs[rd] = value >>> 0;
    wroteRegs.push(rd);
  };

  const writeMem = (addr: number, value: number) => {
    const a = ((addr % MEMORY_SIZE) + MEMORY_SIZE) % MEMORY_SIZE;
    cpu.memory[a] = value & 0xff;
    memWrites.push({ addr: a, value: value & 0xff });
  };

  const { opcode, funct3, funct7, rd, rs1, rs2, imm } = d;
  const r1 = cpu.regs[rs1] >>> 0;
  const r2 = cpu.regs[rs2] >>> 0;

  switch (opcode) {
    case 0x33: {
      let result = 0;
      switch (funct3) {
        case 0:
          result = funct7 === 0 ? r1 + r2 : r1 - r2;
          break;
        case 1:
          result = r1 << (r2 & 0x1f);
          break;
        case 2:
          result = (r1 | 0) < (r2 | 0) ? 1 : 0;
          break;
        case 3:
          result = r1 < r2 ? 1 : 0;
          break;
        case 4:
          result = r1 ^ r2;
          break;
        case 5:
          result = funct7 === 0 ? r1 >>> (r2 & 0x1f) : (r1 | 0) >> (r2 & 0x1f);
          break;
        case 6:
          result = r1 | r2;
          break;
        case 7:
          result = r1 & r2;
          break;
      }
      writeReg(rd, result);
      break;
    }
    case 0x13: {
      let result = 0;
      switch (funct3) {
        case 0:
          result = r1 + imm;
          break;
        case 1:
          result = r1 << (imm & 0x1f);
          break;
        case 2:
          result = (r1 | 0) < imm ? 1 : 0;
          break;
        case 3:
          result = r1 < (imm >>> 0) ? 1 : 0;
          break;
        case 4:
          result = r1 ^ imm;
          break;
        case 5:
          result = funct7 === 0x20 ? (r1 | 0) >> (imm & 0x1f) : r1 >>> (imm & 0x1f);
          break;
        case 6:
          result = r1 | imm;
          break;
        case 7:
          result = r1 & imm;
          break;
      }
      writeReg(rd, result);
      break;
    }
    case 0x03: {
      const addr = (r1 + imm) | 0;
      const a = ((addr % MEMORY_SIZE) + MEMORY_SIZE) % MEMORY_SIZE;
      switch (funct3) {
        case 0: {
          const b = cpu.memory[a];
          writeReg(rd, b & 0x80 ? b | 0xffffff00 : b);
          break;
        }
        case 1: {
          const h = cpu.memory[a] | (cpu.memory[(a + 1) % MEMORY_SIZE] << 8);
          writeReg(rd, h & 0x8000 ? h | 0xffff0000 : h);
          break;
        }
        case 2:
          writeReg(rd, loadWord(cpu, a));
          break;
        case 4:
          writeReg(rd, cpu.memory[a]);
          break;
        case 5:
          writeReg(rd, cpu.memory[a] | (cpu.memory[(a + 1) % MEMORY_SIZE] << 8));
          break;
      }
      break;
    }
    case 0x23: {
      const addr = (r1 + imm) | 0;
      if (funct3 === 0) writeMem(addr, r2);
      else if (funct3 === 1) {
        writeMem(addr, r2);
        writeMem(addr + 1, r2 >>> 8);
      } else if (funct3 === 2) {
        writeMem(addr, r2);
        writeMem(addr + 1, r2 >>> 8);
        writeMem(addr + 2, r2 >>> 16);
        writeMem(addr + 3, r2 >>> 24);
      }
      break;
    }
    case 0x63: {
      let take = false;
      switch (funct3) {
        case 0:
          take = r1 === r2;
          break;
        case 1:
          take = r1 !== r2;
          break;
        case 4:
          take = (r1 | 0) < (r2 | 0);
          break;
        case 5:
          take = (r1 | 0) >= (r2 | 0);
          break;
        case 6:
          take = r1 < r2;
          break;
        case 7:
          take = r1 >= r2;
          break;
      }
      if (take) {
        nextPc = (fetchPc + imm) % MEMORY_SIZE;
        branched = true;
      }
      break;
    }
    case 0x6f:
      writeReg(rd, fetchPc + 4);
      nextPc = (fetchPc + imm) % MEMORY_SIZE;
      branched = true;
      break;
    case 0x67:
      writeReg(rd, fetchPc + 4);
      nextPc = ((r1 + imm) & ~1) % MEMORY_SIZE;
      branched = true;
      break;
    case 0x37:
      writeReg(rd, imm);
      break;
    case 0x17:
      writeReg(rd, fetchPc + imm);
      break;
  }

  cpu.regs[0] = 0;
  cpu.pc = ((nextPc % MEMORY_SIZE) + MEMORY_SIZE) % MEMORY_SIZE;
  return { decoded: d, wroteRegs, memWrites, branched };
}

/** Preset encodings from tests.c / main.c. */
export const PRESETS: { label: string; word: number; note: string }[] = [
  { label: 'ADDI x1,x2,20', word: 0x01410093, note: 'I-type · from main / tests' },
  { label: 'ADD x3,x1,x2', word: 0x002081b3, note: 'R-type' },
  { label: 'SUB x3,x1,x2', word: 0x402081b3, note: 'R-type · funct7=0x20' },
  { label: 'SW x1,0(x2)', word: 0x00112023, note: 'S-type' },
  { label: 'LW x3,0(x2)', word: 0x00012183, note: 'I-type load' },
  { label: 'BEQ x1,x2,+8', word: 0x00208463, note: 'B-type' },
  { label: 'JAL x1,+16', word: 0x010000ef, note: 'J-type' },
  { label: 'ADDI x0,x0,5', word: 0x00500013, note: 'x0 stays hardwired 0' },
];

export interface Program {
  id: string;
  title: string;
  blurb: string;
  words: number[];
  regs?: Record<number, number>;
}

export const PROGRAMS: Program[] = [
  {
    id: 'addi-add',
    title: 'ADDI → ADD',
    blurb: 'x2 starts at 11. ADDI writes x1=31, then ADD puts 42 in x3.',
    words: [0x01410093, 0x002081b3],
    regs: { 2: 11 },
  },
  {
    id: 'sw-lw',
    title: 'SW → LW',
    blurb: 'Store 0xA1B2C3D4 at mem[100], then load it back into x3.',
    words: [0x00112023, 0x00012183],
    regs: { 1: 0xa1b2c3d4, 2: 100 },
  },
  {
    id: 'beq',
    title: 'BEQ taken',
    blurb: 'Equal regs take the +8 branch so PC lands on 0x08 (skipping the gap).',
    words: [0x00208463, 0x00000013, 0x00100093],
    regs: { 1: 9, 2: 9 },
  },
  {
    id: 'jal',
    title: 'JAL link',
    blurb: 'JAL x1, +16 links return address 4 into x1 and jumps to 0x10.',
    words: [0x010000ef],
  },
];

export function loadProgram(cpu: Cpu, program: Program): void {
  cpu.regs.fill(0);
  cpu.memory.fill(0);
  cpu.pc = 0;
  if (program.regs) {
    for (const [r, v] of Object.entries(program.regs)) {
      cpu.regs[Number(r)] = v >>> 0;
    }
  }
  cpu.regs[0] = 0;
  program.words.forEach((word, i) => storeWord(cpu, i * 4, word));
}
