import {
  PRESETS,
  PROGRAMS,
  createCpu,
  decode,
  hex32,
  loadProgram,
  loadWord,
  regAbi,
  regName,
  step,
  type Cpu,
  type Program,
} from './rv32i';

const FIELD_COLORS: Record<string, string> = {
  opcode: '#2563eb',
  rd: '#16a34a',
  funct3: '#ca8a04',
  rs1: '#ea580c',
  rs2: '#db2777',
  funct7: '#7c3aed',
  'imm[11:0]': '#0891b2',
  'imm[11:5]': '#0891b2',
  'imm[4:0]': '#0891b2',
  'imm[12]': '#0891b2',
  'imm[10:5]': '#0891b2',
  'imm[4:1]': '#0891b2',
  'imm[11]': '#0891b2',
  'imm[31:12]': '#0891b2',
  'imm[20]': '#0891b2',
  'imm[10:1]': '#0891b2',
  'imm[19:12]': '#0891b2',
  instr: '#64748b',
};

function fieldColor(name: string): string {
  return FIELD_COLORS[name] ?? '#64748b';
}

function fieldForBit(fields: { name: string; lo: number; hi: number }[], bit: number): string {
  return fields.find((f) => bit >= f.lo && bit <= f.hi)?.name ?? '';
}

export function mountRiscVDemos(root: HTMLElement): void {
  mountBitfield(root.querySelector<HTMLElement>('[data-bitfield]')!);
  mountStepper(root.querySelector<HTMLElement>('[data-stepper]')!);
}

function mountBitfield(root: HTMLElement): void {
  const bitsEl = root.querySelector<HTMLElement>('[data-bits]');
  const fieldsEl = root.querySelector<HTMLElement>('[data-fields]');
  const mnemonicEl = root.querySelector<HTMLElement>('[data-mnemonic]');
  const hexInput = root.querySelector<HTMLInputElement>('[data-hex]');
  const formatEl = root.querySelector<HTMLElement>('[data-format]');
  const presetsEl = root.querySelector<HTMLElement>('[data-presets]');
  if (!bitsEl || !fieldsEl || !mnemonicEl || !hexInput || !formatEl || !presetsEl) return;

  let active = 'opcode';
  let word = PRESETS[0].word;

  presetsEl.innerHTML = PRESETS.map(
    (p) =>
      `<button type="button" class="chip" data-word="${p.word}">${p.label}</button>`,
  ).join('');

  const paint = () => {
    const d = decode(word);
    hexInput.value = hex32(word);
    mnemonicEl.textContent = d.mnemonic;
    formatEl.textContent = `${d.format}-type`;

    bitsEl.innerHTML = Array.from({ length: 32 }, (_, i) => {
      const bit = 31 - i;
      const name = fieldForBit(d.fields, bit);
      const on = name === active;
      const bitVal = (word >>> bit) & 1;
      return `<button type="button" class="bit${on ? ' is-on' : ''}" data-field="${name}" style="--c:${fieldColor(name)}" title="bit ${bit} · ${name}" aria-label="Bit ${bit}">${bitVal}<span>${bit}</span></button>`;
    }).join('');

    fieldsEl.innerHTML = d.fields
      .map((f) => {
        const on = f.name === active;
        let detail = `0x${f.value.toString(16).toUpperCase()} · ${f.value}`;
        if (f.name === 'rd' || f.name === 'rs1' || f.name === 'rs2') {
          detail = `${regName(f.value)} (${regAbi(f.value)})`;
        }
        if (f.name.startsWith('imm')) {
          detail = `${hex32(d.imm)} (signed ${d.imm})`;
        }
        return `<button type="button" class="field${on ? ' is-on' : ''}" data-field="${f.name}" style="--c:${fieldColor(f.name)}">
          <span class="fname">${f.name}</span>
          <span class="fbits">[${f.hi}:${f.lo}]</span>
          <span class="fval">${detail}</span>
        </button>`;
      })
      .join('');
  };

  const setWord = (next: number) => {
    word = next >>> 0;
    const d = decode(word);
    active = d.fields[d.fields.length - 1]?.name ?? 'opcode';
    paint();
  };

  bitsEl.addEventListener('click', (event) => {
    const btn = (event.target as Element).closest<HTMLElement>('.bit');
    if (!btn?.dataset.field) return;
    active = btn.dataset.field;
    paint();
  });

  fieldsEl.addEventListener('click', (event) => {
    const btn = (event.target as Element).closest<HTMLElement>('.field');
    if (!btn?.dataset.field) return;
    active = btn.dataset.field;
    paint();
  });

  presetsEl.addEventListener('click', (event) => {
    const btn = (event.target as Element).closest<HTMLButtonElement>('[data-word]');
    if (!btn) return;
    setWord(Number(btn.dataset.word));
  });

  hexInput.addEventListener('change', () => {
    const raw = hexInput.value.trim().replace(/^0x/i, '');
    const parsed = Number.parseInt(raw, 16);
    if (Number.isFinite(parsed)) setWord(parsed);
    else paint();
  });

  setWord(word);
}

function mountStepper(root: HTMLElement): void {
  const programEl = root.querySelector<HTMLElement>('[data-programs]');
  const disasmEl = root.querySelector<HTMLElement>('[data-disasm]');
  const regsEl = root.querySelector<HTMLElement>('[data-regs]');
  const memEl = root.querySelector<HTMLElement>('[data-mem]');
  const pcEl = root.querySelector<HTMLElement>('[data-pc]');
  const statusEl = root.querySelector<HTMLElement>('[data-status]');
  const stepBtn = root.querySelector<HTMLButtonElement>('[data-step]');
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-reset]');
  if (!programEl || !disasmEl || !regsEl || !memEl || !pcEl || !statusEl || !stepBtn || !resetBtn) {
    return;
  }

  const cpu: Cpu = createCpu();
  let program: Program = PROGRAMS[0];
  let lastWrote = new Set<number>();
  let lastMem = new Set<number>();

  const memWindowStart = (hint: number) => (hint >= 90 && hint <= 120 ? 96 : 0);

  programEl.innerHTML = PROGRAMS.map(
    (p) =>
      `<button type="button" class="chip" data-prog="${p.id}">${p.title}</button>`,
  ).join('');

  const paint = (note?: string) => {
    pcEl.textContent = hex32(cpu.pc);
    statusEl.textContent = note ?? `Loaded “${program.title}”. Step through your harness encodings.`;

    disasmEl.innerHTML = program.words
      .map((word, i) => {
        const addr = i * 4;
        const d = decode(word);
        const on = cpu.pc === addr;
        return `<div class="line${on ? ' is-pc' : ''}"><span class="addr">${hex32(addr)}</span><span class="hex">${hex32(word)}</span><span class="asm">${d.mnemonic}</span></div>`;
      })
      .join('');

    regsEl.innerHTML = Array.from({ length: 32 }, (_, i) => {
      const hot = lastWrote.has(i);
      return `<div class="reg${hot ? ' is-hot' : ''}${i === 0 ? ' is-zero' : ''}" title="${regAbi(i)}">
        <span class="rn">${regName(i)}</span>
        <span class="rv">${hex32(cpu.regs[i])}</span>
      </div>`;
    }).join('');

    const base = program.regs?.[2] ?? 0;
    const windowStart = Math.max(0, Math.min(memWindowStart(base), 4096 - 16));
    memEl.innerHTML = Array.from({ length: 16 }, (_, i) => {
      const addr = windowStart + i;
      const hot = lastMem.has(addr);
      return `<div class="byte${hot ? ' is-hot' : ''}"><span class="ma">${hex32(addr).slice(6)}</span><span class="mv">${cpu.memory[addr].toString(16).padStart(2, '0').toUpperCase()}</span></div>`;
    }).join('');
  };
  const reset = (next = program) => {
    program = next;
    lastWrote = new Set();
    lastMem = new Set();
    loadProgram(cpu, program);
    for (const btn of programEl.querySelectorAll<HTMLElement>('.chip')) {
      btn.classList.toggle('is-on', btn.dataset.prog === program.id);
    }
    paint(program.blurb);
  };

  programEl.addEventListener('click', (event) => {
    const btn = (event.target as Element).closest<HTMLButtonElement>('[data-prog]');
    if (!btn?.dataset.prog) return;
    const next = PROGRAMS.find((p) => p.id === btn.dataset.prog);
    if (next) reset(next);
  });

  stepBtn.addEventListener('click', () => {
    // Halt if PC is past the loaded program and word is 0 (nop-ish unused).
    if (cpu.pc >= program.words.length * 4 && loadWord(cpu, cpu.pc) === 0) {
      paint('PC is past the program — hit Reset to reload.');
      return;
    }
    const beforePc = cpu.pc;
    const result = step(cpu);
    lastWrote = new Set(result.wroteRegs);
    lastMem = new Set(result.memWrites.map((m) => m.addr));
    const writes =
      result.wroteRegs.length > 0
        ? ` · wrote ${result.wroteRegs.map((r) => `${regName(r)}=${hex32(cpu.regs[r])}`).join(', ')}`
        : '';
    const branch = result.branched ? ' · control transfer' : '';
    paint(`${hex32(beforePc)}: ${result.decoded.mnemonic}${writes}${branch}`);
  });

  resetBtn.addEventListener('click', () => reset());

  reset(program);
}
