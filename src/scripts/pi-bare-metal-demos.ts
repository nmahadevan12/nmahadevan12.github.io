/** Interactive demos for the bare-metal Pi 3B firmware (boot stub + AUX mini UART). */

const PERIPH_BASE = 0x3f00_0000;
const GPIO_BASE = PERIPH_BASE + 0x20_0000;
const UART_BASE = PERIPH_BASE + 0x215_000;

const GPFSEL1_ADDR = GPIO_BASE + 0x04;
const AUX_ENABLES_ADDR = UART_BASE + 0x04;
const AUX_MU_BAUD_ADDR = UART_BASE + 0x68;
const AUX_MU_CNTL_ADDR = UART_BASE + 0x60;
const AUX_MU_IO_ADDR = UART_BASE + 0x40;

/** Matches main.c. */
const MINI_UART = 1;
const BAUD_RATE = 270;
const DATA_BIT_SEL = 3;
const TRANSMIT_ENABLE = 1 << 1;
const MESSAGE = 'Hello Nikhil';

const hex32 = (n: number) => `0x${(n >>> 0).toString(16).padStart(8, '0').toUpperCase()}`;

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
    detail: 'Hand off to C. main brings up the AUX mini UART on GPIO 14, then transmits forever.',
    code: '2: bl main',
  },
];

export function mountPiBareMetalDemos(root: HTMLElement) {
  mountBoot(root);
  mountUart(root);
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

function mountUart(root: HTMLElement) {
  const panel = root.querySelector<HTMLElement>('[data-uart-demo]');
  if (!panel) return;

  const outEl = panel.querySelector<HTMLElement>('[data-uart-out]');
  const statusEl = panel.querySelector<HTMLElement>('[data-uart-status]');
  const logEl = panel.querySelector<HTMLElement>('[data-mmio-log]');
  const setupBtn = panel.querySelector<HTMLButtonElement>('[data-uart-setup]');
  const playBtn = panel.querySelector<HTMLButtonElement>('[data-uart-play]');
  const stepBtn = panel.querySelector<HTMLButtonElement>('[data-uart-step]');
  const resetBtn = panel.querySelector<HTMLButtonElement>('[data-uart-reset]');
  const auxEnHex = panel.querySelector<HTMLElement>('[data-aux-en-hex]');
  const baudHex = panel.querySelector<HTMLElement>('[data-baud-hex]');
  const gpfselHex = panel.querySelector<HTMLElement>('[data-gpfsel-hex]');
  const cntlHex = panel.querySelector<HTMLElement>('[data-cntl-hex]');
  if (
    !outEl ||
    !statusEl ||
    !logEl ||
    !setupBtn ||
    !playBtn ||
    !stepBtn ||
    !resetBtn ||
    !auxEnHex ||
    !baudHex ||
    !gpfselHex ||
    !cntlHex
  ) {
    return;
  }

  let auxEnables = 0;
  let baud = 0;
  let gpfsel1 = 0;
  let cntl = 0;
  let ready = false;
  let index = 0;
  let playing = false;
  let timer = 0;
  let line = '';

  const pushLog = (text: string) => {
    const row = document.createElement('div');
    row.textContent = text;
    logEl.prepend(row);
    while (logEl.children.length > 10) logEl.lastElementChild?.remove();
  };

  const render = () => {
    auxEnHex.textContent = hex32(auxEnables);
    baudHex.textContent = hex32(baud);
    gpfselHex.textContent = hex32(gpfsel1);
    cntlHex.textContent = hex32(cntl);
    outEl.textContent = line || ' ';
    statusEl.textContent = !ready ? 'idle' : playing ? 'transmitting' : 'ready';
    playBtn.textContent = playing ? 'Pause' : 'Transmit loop';
    playBtn.disabled = !ready;
    stepBtn.disabled = !ready;
  };

  const stopPlay = () => {
    playing = false;
    if (timer) window.clearInterval(timer);
    timer = 0;
    playBtn.textContent = 'Transmit loop';
    statusEl.textContent = ready ? 'ready' : 'idle';
  };

  const sendByte = () => {
    if (!ready) return;
    const ch = MESSAGE[index];
    pushLog(`${hex32(AUX_MU_IO_ADDR)} ← ${hex32(ch.charCodeAt(0))}  // '${ch}'`);
    line += ch;
    if (line.length > 72) line = line.slice(-72);
    index = (index + 1) % MESSAGE.length;
    if (index === 0) line += ' ';
    render();
  };

  setupBtn.addEventListener('click', () => {
    stopPlay();
    auxEnables |= MINI_UART;
    pushLog(`${hex32(AUX_ENABLES_ADDR)} |= ${hex32(MINI_UART)}  // enable mini UART`);
    cntl = 0;
    pushLog(`${hex32(AUX_MU_CNTL_ADDR)} ← 0  // disable TX/RX`);
    baud = BAUD_RATE;
    pushLog(`${hex32(AUX_MU_BAUD_ADDR)} ← ${hex32(BAUD_RATE)}  // 115200 @ 250 MHz`);
    pushLog(`AUX_MU_LCR ← ${hex32(DATA_BIT_SEL)}  // 8-bit`);
    gpfsel1 = (gpfsel1 & ~(7 << 12)) | (2 << 12);
    pushLog(`${hex32(GPFSEL1_ADDR)} ← ${hex32(gpfsel1)}  // GPIO14 Alt5 (TXD1)`);
    cntl = TRANSMIT_ENABLE;
    pushLog(`${hex32(AUX_MU_CNTL_ADDR)} ← ${hex32(TRANSMIT_ENABLE)}  // TX enable`);
    ready = true;
    index = 0;
    render();
  });

  playBtn.addEventListener('click', () => {
    if (!ready) return;
    if (playing) {
      stopPlay();
      render();
      return;
    }
    playing = true;
    statusEl.textContent = 'transmitting';
    playBtn.textContent = 'Pause';
    timer = window.setInterval(sendByte, 140);
  });

  stepBtn.addEventListener('click', () => {
    stopPlay();
    sendByte();
  });

  resetBtn.addEventListener('click', () => {
    stopPlay();
    auxEnables = 0;
    baud = 0;
    gpfsel1 = 0;
    cntl = 0;
    ready = false;
    index = 0;
    line = '';
    logEl.innerHTML = '';
    pushLog(`UART_BASE ${hex32(UART_BASE)}  ·  GPIO14 → GPFSEL1[14:12] = Alt5`);
    render();
  });

  pushLog(`UART_BASE ${hex32(UART_BASE)}  ·  GPIO14 → GPFSEL1[14:12] = Alt5`);
  render();
}
