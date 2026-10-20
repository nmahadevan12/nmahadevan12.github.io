import { PRESETS, decode, hex32, regAbi, regName } from './rv32i';

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
  const panel = root.querySelector<HTMLElement>('[data-bitfield]');
  if (panel) mountBitfield(panel);
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

    for (const btn of presetsEl.querySelectorAll<HTMLElement>('.chip')) {
      btn.classList.toggle('is-on', Number(btn.dataset.word) === word);
    }

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
