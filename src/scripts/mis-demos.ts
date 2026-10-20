/**
 * MIS interactive demo — 5-bit R-2R DC reference.
 *
 * Ladder:   V_R2R = 3.3 × code / 31          (0 … 3.3 V)
 * Stage 1:  V_mid = V_R2R × (1 + 20.3/10)    (≈ 0 … 10 V)
 * Stage 2:  Vout  = V_mid − 5                (−5 … +5 V)
 */

const DAC_LEVELS = 32;
const VDD = 3.3;
const GAIN = 1 + 20.3 / 10; // non-inverting ≈ 3.03 → 0–10 V
const OFFSET = 5; // difference amp subtracts 5 V

export function mountMisDemos(root: HTMLElement) {
  mountDac(root.querySelector<HTMLElement>('[data-dac-demo]')!);
}

function mountDac(root: HTMLElement) {
  if (!root) return;

  const codeRange = root.querySelector<HTMLInputElement>('[data-code-range]')!;
  const codeVal = root.querySelector<HTMLElement>('[data-code-val]')!;
  const sweepBtn = root.querySelector<HTMLButtonElement>('[data-sweep]')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-reset]')!;
  const elCode = root.querySelector<HTMLElement>('[data-r-code]')!;
  const elBin = root.querySelector<HTMLElement>('[data-r-bin]')!;
  const elLadder = root.querySelector<HTMLElement>('[data-r-ladder]')!;
  const elVout = root.querySelector<HTMLElement>('[data-r-vout]')!;
  const fill = root.querySelector<HTMLElement>('[data-volt-fill]')!;
  const needle = root.querySelector<HTMLElement>('[data-volt-needle]')!;
  const ladderFill = root.querySelector<HTMLElement>('[data-ladder-fill]')!;
  const ladderNeedle = root.querySelector<HTMLElement>('[data-ladder-needle]')!;
  const ladderV = root.querySelector<SVGElement>('[data-ladder-v]')!;
  const finalV = root.querySelector<SVGElement>('[data-final-v]')!;
  const stages = [...root.querySelectorAll<SVGGElement>('[data-stage]')];

  /** bits[0] = MSB (b4) … bits[4] = LSB (b0) */
  let bits = [0, 0, 0, 1, 0];
  let busy = false;

  const codeOf = () => bits.reduce((acc, b, i) => acc + (b << (4 - i)), 0);

  const setCode = (code: number) => {
    const c = Math.max(0, Math.min(DAC_LEVELS - 1, Math.round(code)));
    for (let i = 0; i < 5; i++) {
      bits[i] = (c >> (4 - i)) & 1;
    }
  };

  /** Ideal R-2R tap into the Pi 3.3 V domain. */
  const vLadder = (code: number) => (VDD * code) / (DAC_LEVELS - 1);

  /** After non-inverting gain (~0–10 V) and difference offset (−5 V). */
  const vOut = (code: number) => vLadder(code) * GAIN - OFFSET;

  const fmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} V`;

  const paintLadder = () => {
    stages.forEach((stage, i) => {
      const on = bits[i] === 1;
      const sw = stage.querySelector<SVGRectElement>('[data-sw]');
      const label = stage.querySelector<SVGElement>('[data-sw-label]');
      const leg = stage.querySelector<SVGLineElement>('[data-leg]');
      const series = stage.querySelector<SVGLineElement>('[data-series]');
      if (sw) {
        sw.setAttribute('fill', on ? '#e8f4fb' : '#f4f4f5');
        sw.setAttribute('stroke', on ? '#1b7db3' : '#d4d4d8');
      }
      if (label) {
        label.textContent = String(bits[i]);
        label.setAttribute('fill', on ? '#0f5f8a' : '#71717a');
      }
      if (leg) leg.setAttribute('stroke', on ? '#1b7db3' : '#d4d4d8');
      if (series) series.setAttribute('stroke', on ? '#93c5fd' : '#d4d4d8');
    });
  };

  const paint = () => {
    const code = codeOf();
    const vr = vLadder(code);
    const vo = vOut(code);

    elCode.textContent = String(code);
    elBin.textContent = bits.join('');
    elLadder.textContent = `${vr.toFixed(2)} V`;
    elVout.textContent = fmt(vo);
    codeVal.textContent = `${code} / 31`;
    codeRange.value = String(code);
    ladderV.textContent = `${vr.toFixed(2)} V`;
    finalV.textContent = fmt(vo);

    // Ladder bar: 0 … 3.3 V from the left
    const ladderPct = (vr / VDD) * 100;
    ladderFill.style.width = `${ladderPct}%`;
    ladderNeedle.style.left = `${ladderPct}%`;

    // Output bar: −5 … +5 V centered at 0
    const outPct = ((vo - -5) / 10) * 100;
    const zeroPct = 50;
    needle.style.left = `${outPct}%`;
    if (vo >= 0) {
      fill.style.left = `${zeroPct}%`;
      fill.style.width = `${outPct - zeroPct}%`;
    } else {
      fill.style.left = `${outPct}%`;
      fill.style.width = `${zeroPct - outPct}%`;
    }

    paintLadder();
  };

  stages.forEach((stage, i) => {
    stage.style.cursor = 'pointer';
    stage.setAttribute('tabindex', '0');
    stage.setAttribute('role', 'button');
    stage.setAttribute('aria-label', `Toggle bit b${4 - i}`);
    const toggle = () => {
      if (busy) return;
      bits[i] = bits[i] ? 0 : 1;
      paint();
    };
    stage.addEventListener('click', toggle);
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });

  codeRange.addEventListener('input', () => {
    if (busy) return;
    setCode(Number(codeRange.value));
    paint();
  });

  resetBtn.addEventListener('click', () => {
    if (busy) return;
    setCode(16);
    paint();
  });

  sweepBtn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    sweepBtn.disabled = true;
    resetBtn.disabled = true;
    codeRange.disabled = true;

    for (let c = 0; c < DAC_LEVELS; c++) {
      setCode(c);
      paint();
      await new Promise((r) => setTimeout(r, 55));
    }

    busy = false;
    sweepBtn.disabled = false;
    resetBtn.disabled = false;
    codeRange.disabled = false;
  });

  paint();
}
