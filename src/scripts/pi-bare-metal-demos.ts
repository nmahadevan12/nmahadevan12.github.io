/** Interactive demos for the bare-metal Pi 3B blinky (BCM2837 GPIO + boot stub). */

const PERIPH_BASE = 0x3f00_0000;
const GPIO_BASE = PERIPH_BASE + 0x20_0000;
const GPFSEL1_ADDR = GPIO_BASE + 0x04;
const GPSET0_ADDR = GPIO_BASE + 0x1c;
const GPCLR0_ADDR = GPIO_BASE + 0x28;

/** Matches main.c: bits [23:21] = 001 for GPIO 17 output. */
const GPIO_17_OUT = 1 << 21;
const GPIO_17_PIN = 1 << 17;

const hex32 = (n: number) => `0x${(n >>> 0).toString(16).padStart(8, '0').toUpperCase()}`;

const bit = (word: number, i: number) => ((word >>> i) & 1) as 0 | 1;

type BootStep = {
  id: string;
  title: string;
  detail: string;
  code: string;
};

const BOOT_STEPS: BootStep[] = [
  {
    id: 'mpidr',
    title: 'Read MPIDR_EL1',
    detail: 'Only the affinity level-0 field matters here — cores are numbered 0–3.',
    code: 'mrs x0, mpidr_el1\nand x0, x0, #3',
  },
  {
    id: 'park',
    title: 'Park cores 1–3',
    detail: 'Non-zero core IDs jump to hang and sit in WFE. Core 0 continues.',
    code: 'cbnz x0, hang',
  },
  {
    id: 'stack',
    title: 'Set the stack',
    detail: 'SP points at _start (0x80000). The stack grows downward into free RAM below the image.',
    code: 'ldr x0, =_start\nmov sp, x0',
  },
  {
    id: 'bss',
    title: 'Zero .bss',
    detail: 'Walk [__bss_start, __bss_end) eight bytes at a time with str xzr.',
    code: '1: cmp x1, x2\nb.hs 2f\nstr xzr, [x1], #8\nb 1b',
  },
  {
    id: 'main',
    title: 'Call main',
    detail: 'Hand off to C. main configures GPFSEL1, then blinks GPSET0 / GPCLR0 forever.',
    code: '2: bl main',
  },
];

export function mountPiBareMetalDemos(root: HTMLElement) {
  mountBoot(root);
  mountGpio(root);
}

function mountBoot(root: HTMLElement) {
  const panel = root.querySelector<HTMLElement>('[data-boot-demo]');
  if (!panel) return;

  const stepsEl = panel.querySelector<HTMLElement>('[data-boot-steps]');
  const detailEl = panel.querySelector<HTMLElement>('[data-boot-detail]');
  const codeEl = panel.querySelector<HTMLElement>('[data-boot-code]');
  const coresEl = panel.querySelector<HTMLElement>('[data-cores]');
  const prevBtn = panel.querySelector<HTMLButtonElement>('[data-boot-prev]');
  const nextBtn = panel.querySelector<HTMLButtonElement>('[data-boot-next]');
  if (!stepsEl || !detailEl || !codeEl || !coresEl || !prevBtn || !nextBtn) return;

  let index = 0;

  const renderCores = (active: number) => {
    coresEl.innerHTML = '';
    for (let c = 0; c < 4; c++) {
      const el = document.createElement('div');
      el.className = 'core';
      const parked = active >= 1 && c > 0;
      const running = (active === 0 && c === 0) || (active >= 1 && c === 0);
      if (parked) el.dataset.state = 'parked';
      else if (running) el.dataset.state = 'run';
      else el.dataset.state = 'idle';
      el.innerHTML = `<strong>Core ${c}</strong><span>${parked ? 'WFE hang' : running ? 'running' : '—'}</span>`;
      coresEl.appendChild(el);
    }
  };

  const render = () => {
    const step = BOOT_STEPS[index];
    stepsEl.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((btn, i) => {
      if (i === index) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
      btn.dataset.active = i === index ? '1' : '0';
      btn.dataset.done = i < index ? '1' : '0';
    });
    detailEl.textContent = step.detail;
    codeEl.textContent = step.code;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === BOOT_STEPS.length - 1;
    renderCores(index);
  };

  stepsEl.innerHTML = '';
  BOOT_STEPS.forEach((step, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.step = step.id;
    btn.innerHTML = `<span class="n">${i + 1}</span><span class="t">${step.title}</span>`;
    btn.addEventListener('click', () => {
      index = i;
      render();
    });
    stepsEl.appendChild(btn);
  });

  prevBtn.addEventListener('click', () => {
    index = Math.max(0, index - 1);
    render();
  });
  nextBtn.addEventListener('click', () => {
    index = Math.min(BOOT_STEPS.length - 1, index + 1);
    render();
  });

  render();
}

function mountGpio(root: HTMLElement) {
  const panel = root.querySelector<HTMLElement>('[data-gpio-demo]');
  if (!panel) return;

  const bitsEl = panel.querySelector<HTMLElement>('[data-gpfsel-bits]');
  const ledEl = panel.querySelector<HTMLElement>('[data-led]');
  const pinStateEl = panel.querySelector<HTMLElement>('[data-pin-state]');
  const logEl = panel.querySelector<HTMLElement>('[data-mmio-log]');
  const playBtn = panel.querySelector<HTMLButtonElement>('[data-gpio-play]');
  const stepBtn = panel.querySelector<HTMLButtonElement>('[data-gpio-step]');
  const resetBtn = panel.querySelector<HTMLButtonElement>('[data-gpio-reset]');
  const gpfselHex = panel.querySelector<HTMLElement>('[data-gpfsel-hex]');
  const setHex = panel.querySelector<HTMLElement>('[data-gpset-hex]');
  const clrHex = panel.querySelector<HTMLElement>('[data-gpclr-hex]');
  if (!bitsEl || !ledEl || !pinStateEl || !logEl || !playBtn || !stepBtn || !resetBtn || !gpfselHex || !setHex || !clrHex)
    return;

  let gpfsel1 = 0;
  let pinHigh = false;
  let configured = false;
  let phase: 'idle' | 'set' | 'clr' = 'idle';
  let playing = false;
  let timer = 0;

  const pushLog = (line: string) => {
    const row = document.createElement('div');
    row.textContent = line;
    logEl.prepend(row);
    while (logEl.children.length > 8) logEl.lastElementChild?.remove();
  };

  const renderBits = () => {
    bitsEl.innerHTML = '';
    // Show GPFSEL1 fields for GPIO 10–19 (3 bits each), highlight 17.
    for (let pin = 19; pin >= 10; pin--) {
      const lo = (pin - 10) * 3;
      const field = document.createElement('button');
      field.type = 'button';
      field.className = 'field';
      field.dataset.pin = String(pin);
      if (pin === 17) field.dataset.focus = '1';
      const b0 = bit(gpfsel1, lo);
      const b1 = bit(gpfsel1, lo + 1);
      const b2 = bit(gpfsel1, lo + 2);
      const mode = (b0 | (b1 << 1) | (b2 << 2)) & 0x7;
      field.title = `GPIO ${pin} → GPFSEL1[${lo + 2}:${lo}]`;
      field.innerHTML = `
        <span class="pin">GPIO ${pin}</span>
        <span class="bits" aria-hidden="true">
          <i data-on="${b2}">${b2}</i><i data-on="${b1}">${b1}</i><i data-on="${b0}">${b0}</i>
        </span>
        <span class="mode">${mode === 1 ? 'OUT' : mode === 0 ? 'IN' : `fn${mode}`}</span>
      `;
      if (pin === 17) {
        field.addEventListener('click', () => {
          // Match main.c: assign GPIO_17_OUT (clears other mode bits in this write).
          gpfsel1 = GPIO_17_OUT;
          configured = true;
          pushLog(`${hex32(GPFSEL1_ADDR)} ← ${hex32(gpfsel1)}  // GPFSEL1 = GPIO_17_OUT`);
          render();
        });
      } else {
        field.disabled = true;
      }
      bitsEl.appendChild(field);
    }
  };

  const renderLed = () => {
    ledEl.dataset.on = pinHigh && configured ? '1' : '0';
    ledEl.dataset.armed = configured ? '1' : '0';
    pinStateEl.textContent = !configured ? 'not configured' : pinHigh ? 'HIGH (set)' : 'LOW (clear)';
  };

  const renderRegs = () => {
    gpfselHex.textContent = hex32(gpfsel1);
    setHex.textContent = phase === 'set' ? hex32(GPIO_17_PIN) : hex32(0);
    clrHex.textContent = phase === 'clr' ? hex32(GPIO_17_PIN) : hex32(0);
  };

  const render = () => {
    renderBits();
    renderLed();
    renderRegs();
    playBtn.textContent = playing ? 'Pause' : 'Blink';
    stepBtn.disabled = !configured;
    playBtn.disabled = !configured;
  };

  const doSet = () => {
    phase = 'set';
    pinHigh = true;
    pushLog(`${hex32(GPSET0_ADDR)} ← ${hex32(GPIO_17_PIN)}  // GPSET0`);
    render();
  };

  const doClr = () => {
    phase = 'clr';
    pinHigh = false;
    pushLog(`${hex32(GPCLR0_ADDR)} ← ${hex32(GPIO_17_PIN)}  // GPCLR0`);
    render();
  };

  const stepOnce = () => {
    if (!configured) return;
    if (phase === 'idle' || phase === 'clr') doSet();
    else doClr();
  };

  const stopPlay = () => {
    playing = false;
    if (timer) window.clearInterval(timer);
    timer = 0;
    playBtn.textContent = 'Blink';
  };

  playBtn.addEventListener('click', () => {
    if (!configured) return;
    if (playing) {
      stopPlay();
      return;
    }
    playing = true;
    playBtn.textContent = 'Pause';
    // Slowed way down vs the firmware's tiny delay++ so the LED is visible.
    timer = window.setInterval(stepOnce, 420);
  });

  stepBtn.addEventListener('click', () => {
    stopPlay();
    stepOnce();
  });

  resetBtn.addEventListener('click', () => {
    stopPlay();
    gpfsel1 = 0;
    pinHigh = false;
    configured = false;
    phase = 'idle';
    logEl.innerHTML = '';
    pushLog('Registers cleared — click GPIO 17 (or Configure) to match main.c');
    render();
  });

  panel.querySelector<HTMLButtonElement>('[data-gpio-config]')?.addEventListener('click', () => {
    gpfsel1 = GPIO_17_OUT;
    configured = true;
    pushLog(`${hex32(GPFSEL1_ADDR)} ← ${hex32(gpfsel1)}  // GPFSEL1 = GPIO_17_OUT`);
    render();
  });

  pushLog(`GPIO_BASE ${hex32(GPIO_BASE)}  ·  pin 17 → GPFSEL1[23:21]`);
  render();
}
